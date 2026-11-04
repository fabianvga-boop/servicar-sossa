import { Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { EstadoOrden, EstadoProforma } from '../../core/models/enums';
import { Proforma } from '../../core/models/finanzas.model';
import { Orden } from '../../core/models/taller.model';
import { AuthService } from '../../core/services/auth.service';
import { ProformasService } from '../../core/services/finanzas.service';
import { OrdenesService } from '../../core/services/ordenes.service';
import { VehiculosService } from '../../core/services/vehiculos.service';
import { EstadoTabla } from '../../shared/components/estado-tabla';
import { coincidePorPalabras } from '../../shared/busqueda';
import { Portada, TarjetaOrden } from './tarjeta-orden';

/** Una columna del tablero: un estado real de la orden y sus tarjetas. */
interface Columna {
  estado: EstadoOrden;
  etiqueta: string;
  /** Color del punto junto al título, el mismo de la insignia del estado. */
  tono: 'azul' | 'naranja' | 'verde';
}

/** El tablero de lo que sigue en el taller y tres listas aparte. */
type Vista = 'activas' | 'cobrar' | 'cerradas' | 'canceladas';

/**
 * El tablero muestra el trabajo que sigue en el taller, en las tres etapas
 * que maneja el backend. "Diagnóstico" no es un estado de la orden: el
 * diagnóstico pasa ANTES de que la orden exista (ver módulo Diagnósticos), y
 * "En proceso" cubre tanto la revisión técnica como la reparación en sí.
 *
 * Las cerradas y las canceladas van en su propia pestaña: ya no avanzan, así
 * que no compiten por espacio con lo activo. "Cerrada" sigue separada de
 * "Finalizada" porque cerrar dispara comisiones y descuenta stock — es un
 * hito real, no un matiz visual.
 */
const COLUMNAS: Columna[] = [
  { estado: EstadoOrden.Abierta, etiqueta: 'En espera', tono: 'azul' },
  { estado: EstadoOrden.EnProceso, etiqueta: 'En proceso', tono: 'naranja' },
  { estado: EstadoOrden.Finalizada, etiqueta: 'Finalizada', tono: 'verde' },
];

/**
 * USU021 — tablero de órdenes de trabajo.
 *
 * No se crean aquí: toda orden nace de un diagnóstico (ver módulo
 * Diagnósticos, respuesta del cliente), así ninguna queda sin un motivo de
 * ingreso registrado y no se duplica trabajo sobre el mismo vehículo.
 *
 * Las tarjetas se pueden ABRIR (van al detalle) pero no se arrastran entre
 * columnas: cambiar de estado dispara reglas reales (cerrar calcula
 * comisiones y descuenta stock, con validaciones propias) que ya viven en
 * el detalle de la orden. Reimplementar eso como un simple "soltar acá"
 * duplicaría esa lógica de negocio fuera de donde está probada — si se
 * quiere arrastrar para cambiar de estado, ese cruce hay que construirlo
 * llamando a las mismas validaciones del detalle, no por fuera de ellas.
 */
@Component({
  selector: 'app-ordenes-lista',
  imports: [RouterLink, EstadoTabla, TarjetaOrden],
  templateUrl: './ordenes-lista.html',
  styleUrl: './ordenes-lista.css',
})
export class OrdenesLista {
  private readonly servicio = inject(OrdenesService);
  private readonly vehiculosService = inject(VehiculosService);
  private readonly proformasService = inject(ProformasService);
  private readonly ruta = inject(ActivatedRoute);
  protected readonly auth = inject(AuthService);

  protected readonly ordenes = signal<Orden[]>([]);
  protected readonly cargando = signal(true);

  /** Portada por vehículo (mismas fotos que gestiona el módulo Vehículos). */
  protected readonly portadas = signal<Map<string, Portada>>(new Map());

  /**
   * Proforma vigente de cada orden, para saber qué falta cobrar. Solo la pide
   * el Administrador, que es quien cobra; hasta que llega no se ofrece cobrar
   * nada, para no mostrar "Emitir proforma" en una orden que ya la tiene.
   */
  protected readonly proformas = signal<Map<string, Proforma>>(new Map());
  protected readonly proformasCargadas = signal(false);

  protected readonly vista = signal<Vista>('activas');
  protected readonly buscar = signal('');
  protected readonly desde = signal('');
  protected readonly hasta = signal('');

  /** Llega por ?estado= desde un acceso directo del panel: resalta la columna. */
  protected readonly columnaDestacada = signal<EstadoOrden | null>(null);

  protected readonly columnas = COLUMNAS;

  // --- Filtro (búsqueda + rango de fechas) ------------------------------------

  /**
   * Búsqueda por palabras en código, cliente, placa y vehículo ("Corolla
   * Vega"), más el rango de fechas.
   */
  protected readonly filtradas = computed<Orden[]>(() => {
    const texto = this.buscar();
    const desde = this.desde();
    const hasta = this.hasta();

    return this.ordenes().filter((o) => {
      if (
        !coincidePorPalabras(texto, o.ordenId, o.nombreCliente, o.placaVehiculo, o.descripcionVehiculo)
      )
        return false;

      // Las fechas llegan en ISO: comparar los diez primeros caracteres evita
      // que el huso horario mueva una orden al día anterior.
      const dia = o.fechaCreacion.slice(0, 10);
      if (desde && dia < desde) return false;
      if (hasta && dia > hasta) return false;

      return true;
    });
  });

  /** Cada columna del tablero con sus tarjetas, las más recientes primero. */
  protected readonly tablero = computed(() =>
    this.columnas.map((columna) => ({
      ...columna,
      ordenes: this.filtradas()
        .filter((o) => o.estado === columna.estado)
        .sort(masRecienteMovida),
    })),
  );

  protected readonly cantidadActivas = computed(() =>
    this.tablero().reduce((suma, columna) => suma + columna.ordenes.length, 0),
  );

  /** Trabajo terminado que falta cobrar: sin proforma, o con saldo pendiente. */
  protected readonly porCobrar = computed(() =>
    this.filtradas()
      .filter((o) => this.mostrarCobro(o) && !this.proformaDe(o)?.estaSaldada)
      .sort(masRecienteMovida),
  );

  /** Las cerradas (y las canceladas) por la fecha en que se cerraron: la última arriba. */
  protected readonly cerradas = computed(() =>
    this.filtradas()
      .filter((o) => o.estado === EstadoOrden.Cerrada)
      .sort(masRecienteMovida),
  );

  protected readonly canceladas = computed(() =>
    this.filtradas()
      .filter((o) => o.estado === EstadoOrden.Cancelada)
      .sort(masRecienteMovida),
  );

  /** Las tarjetas de la pestaña elegida, cuando no es el tablero. */
  protected readonly lista = computed(() => {
    switch (this.vista()) {
      case 'cobrar':
        return this.porCobrar();
      case 'cerradas':
        return this.cerradas();
      case 'canceladas':
        return this.canceladas();
      default:
        return [];
    }
  });

  protected readonly mensajeVacio = computed(() => {
    switch (this.vista()) {
      case 'cobrar':
        return 'No queda nada por cobrar: cada orden terminada tiene su proforma pagada.';
      case 'cerradas':
        return 'Todavía no hay órdenes cerradas.';
      default:
        return 'No hay órdenes canceladas.';
    }
  });

  protected readonly hayFiltro = computed(
    () => this.buscar().length > 0 || this.desde().length > 0 || this.hasta().length > 0,
  );

  constructor() {
    // El acceso directo del panel llega con ?estado=2 ("Órdenes por cerrar"):
    // resalta y centra esa columna del tablero. Una cerrada o cancelada abre
    // directamente su pestaña.
    const desdeUrl = this.ruta.snapshot.queryParamMap.get('estado');
    if (desdeUrl !== null) {
      const estado = Number(desdeUrl) as EstadoOrden;

      if (estado === EstadoOrden.Cerrada) {
        this.vista.set('cerradas');
      } else if (estado === EstadoOrden.Cancelada) {
        this.vista.set('canceladas');
      } else {
        this.columnaDestacada.set(estado);
        afterNextRender(() => this.centrarColumna(estado));
        setTimeout(() => this.columnaDestacada.set(null), 2500);
      }
    }

    this.cargar();
  }

  private centrarColumna(estado: EstadoOrden): void {
    document
      .querySelector(`[data-columna-estado="${estado}"]`)
      ?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  protected cargar(): void {
    this.cargando.set(true);

    this.servicio.getAll().subscribe({
      next: (lista) => {
        this.ordenes.set(lista);
        this.cargando.set(false);
        this.cargarPortadas(lista);
      },
      error: () => this.cargando.set(false),
    });

    if (this.auth.esAdministrador()) this.cargarProformas();
  }

  /**
   * Las proformas vigentes en una sola consulta (el tope de 500 sobra para un
   * taller). Si falla, las tarjetas no ofrecen cobrar en vez de ofrecerlo de más.
   */
  private cargarProformas(): void {
    this.proformasService
      .getAll({ estado: EstadoProforma.Emitida, tamanoPagina: 500 })
      .pipe(catchError(() => of(null)))
      .subscribe((resultado) => {
        if (!resultado) return;
        this.proformas.set(new Map(resultado.items.map((p) => [p.ordenId, p])));
        this.proformasCargadas.set(true);
      });
  }

  /**
   * Trae las fotos de cada vehículo distinto entre las órdenes cargadas
   * (varias órdenes suelen compartir el mismo vehículo, así que se pide una
   * sola vez por placa, no por orden). Es solo de vistazo para la tarjeta: si
   * un vehículo no tiene fotos o la carga falla, su tarjeta cae al ícono de
   * auto en vez de romper el tablero.
   */
  private cargarPortadas(ordenes: Orden[]): void {
    const vehiculoIds = [...new Set(ordenes.map((o) => o.vehiculoId))];
    if (vehiculoIds.length === 0) return;

    forkJoin(
      vehiculoIds.map((id) =>
        this.vehiculosService.getFotos(id).pipe(catchError(() => of([]))),
      ),
    ).subscribe((listas) => {
      const mapa = new Map<string, Portada>();
      vehiculoIds.forEach((id, i) => {
        const fotos = listas[i];
        if (fotos.length > 0) mapa.set(id, { url: fotos[0].url, cantidad: fotos.length });
      });
      this.portadas.set(mapa);
    });
  }

  /** Portada del vehículo de la orden, o null si no tiene fotos cargadas. */
  protected portada(orden: Orden): Portada | null {
    return this.portadas().get(orden.vehiculoId) ?? null;
  }

  protected proformaDe(orden: Orden): Proforma | null {
    return this.proformas().get(orden.ordenId) ?? null;
  }

  /**
   * Se cobra el trabajo terminado (misma regla que Proformas) que tiene monto:
   * una revisión técnica sin costo no deja nada que cobrar.
   */
  protected mostrarCobro(orden: Orden): boolean {
    return (
      this.proformasCargadas() &&
      (orden.estado === EstadoOrden.Finalizada || orden.estado === EstadoOrden.Cerrada) &&
      orden.total > 0
    );
  }

  protected onBuscar(valor: string): void {
    this.buscar.set(valor);
  }

  protected onDesde(valor: string): void {
    this.desde.set(valor);
  }

  protected onHasta(valor: string): void {
    this.hasta.set(valor);
  }

  protected limpiarFechas(): void {
    this.desde.set('');
    this.hasta.set('');
  }
}

/** La fecha que cuenta para ordenar: la de cierre si la tiene, si no la de creación. */
export function masRecienteMovida(a: Orden, b: Orden): number {
  return (b.fechaCierre ?? b.fechaCreacion).localeCompare(a.fechaCierre ?? a.fechaCreacion);
}
