import { Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { EstadoOrden } from '../../core/models/enums';
import { Orden } from '../../core/models/taller.model';
import { urlArchivo } from '../../core/services/api-base';
import { OrdenesService } from '../../core/services/ordenes.service';
import { VehiculosService } from '../../core/services/vehiculos.service';
import { EstadoTabla } from '../../shared/components/estado-tabla';
import { InsigniaEstado } from '../../shared/components/insignia-estado';
import { Modal } from '../../shared/components/modal';
import { Placa } from '../../shared/components/placa';
import { SiTieneRol } from '../../shared/directives/si-tiene-rol';
import { BolivianosPipe } from '../../shared/pipes/bolivianos.pipe';

/** Una columna del tablero: un estado real de la orden y sus tarjetas. */
interface Columna {
  estado: EstadoOrden;
  etiqueta: string;
  /** La columna de cierre agrupa el trabajo terminado; el resto no se apaga. */
  atenuada?: boolean;
}

/**
 * Cuatro de los cinco valores reales de EstadoOrden tienen columna propia —
 * "Diagnóstico" no es un estado de la orden: el diagnóstico pasa ANTES de que
 * la orden exista (ver módulo Diagnósticos), así que esa etapa no tiene
 * tarjeta propia acá; "En proceso" cubre tanto el diagnóstico técnico como la
 * reparación en sí, que es la granularidad real que maneja el backend.
 * "Cerrada" queda separada de "Finalizada" porque cerrar dispara comisiones y
 * descuenta stock — es un hito real, no un matiz visual.
 *
 * "Cancelada" queda AFUERA del tablero a propósito: es trabajo que no se hizo,
 * no algo que siga avanzando por las columnas, así que competir por el mismo
 * espacio que las órdenes activas solo agrega tarjetas muertas a la vista.
 * Vive en el botón "Canceladas" (ver `canceladas` más abajo).
 */
const COLUMNAS: Columna[] = [
  { estado: EstadoOrden.Abierta, etiqueta: 'En espera' },
  { estado: EstadoOrden.EnProceso, etiqueta: 'En proceso' },
  { estado: EstadoOrden.Finalizada, etiqueta: 'Finalizada' },
  { estado: EstadoOrden.Cerrada, etiqueta: 'Cerrada', atenuada: true },
];

/**
 * USU021 — tablero de órdenes de trabajo.
 *
 * No se crean aquí: toda orden nace de un diagnóstico (ver módulo
 * Diagnósticos, botón "Generar orden"), así ninguna queda sin un motivo de
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
  imports: [RouterLink, EstadoTabla, InsigniaEstado, Modal, Placa, SiTieneRol, BolivianosPipe],
  templateUrl: './ordenes-lista.html',
  styleUrl: './ordenes-lista.css',
})
export class OrdenesLista {
  private readonly servicio = inject(OrdenesService);
  private readonly vehiculosService = inject(VehiculosService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly ordenes = signal<Orden[]>([]);
  protected readonly cargando = signal(true);

  /** Portada por vehículo (mismas fotos que gestiona el módulo Vehículos). */
  protected readonly fotosPorVehiculo = signal<Map<string, string | null>>(new Map());
  protected readonly urlArchivo = urlArchivo;

  protected readonly buscar = signal('');
  protected readonly desde = signal('');
  protected readonly hasta = signal('');

  /** Llega por ?estado= desde un acceso directo del panel: resalta la columna. */
  protected readonly columnaDestacada = signal<EstadoOrden | null>(null);

  protected readonly EstadoOrden = EstadoOrden;
  protected readonly columnas = COLUMNAS;

  /** Cuántos avatares entran antes de resumir el resto en un "+N". */
  private readonly MAX_AVATARES = 3;

  /**
   * Iniciales de un nombre completo: "Hector Vega" → "HV". Con un solo
   * nombre usa sus dos primeras letras para no dejar un círculo con una
   * sola letra perdida.
   */
  protected iniciales(nombre: string): string {
    const partes = nombre.trim().split(/\s+/).filter(Boolean);
    if (partes.length === 0) return '—';

    return partes.length === 1
      ? partes[0].slice(0, 2).toUpperCase()
      : (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
  }

  protected mecanicosVisibles(orden: Orden): Orden['mecanicos'] {
    // `?? []` cubre la ventana de un despliegue: el frontend puede quedar
    // arriba antes que la API y recibir todavía respuestas sin `mecanicos`.
    return (orden.mecanicos ?? []).slice(0, this.MAX_AVATARES);
  }

  protected mecanicosRestantes(orden: Orden): number {
    return Math.max(0, (orden.mecanicos ?? []).length - this.MAX_AVATARES);
  }

  /** Si la API todavía no manda la lista, cae al conteo que sí manda. */
  protected tieneMecanicos(orden: Orden): boolean {
    return (orden.mecanicos ?? []).length > 0 || orden.cantidadMecanicos > 0;
  }

  // --- Filtro (búsqueda + rango de fechas) ------------------------------------

  /** Búsqueda por código, cliente o placa, más el rango de fechas. */
  protected readonly filtradas = computed<Orden[]>(() => {
    const texto = this.buscar().trim().toLowerCase();
    const desde = this.desde();
    const hasta = this.hasta();

    return this.ordenes().filter((o) => {
      if (texto) {
        const coincide =
          o.ordenId.toLowerCase().includes(texto) ||
          o.nombreCliente.toLowerCase().includes(texto) ||
          o.placaVehiculo.toLowerCase().includes(texto);

        if (!coincide) return false;
      }

      // Las fechas llegan en ISO: comparar los diez primeros caracteres evita
      // que el huso horario mueva una orden al día anterior.
      const dia = o.fechaCreacion.slice(0, 10);
      if (desde && dia < desde) return false;
      if (hasta && dia > hasta) return false;

      return true;
    });
  });

  /** Cada columna con sus tarjetas, más recientes primero. */
  protected readonly tablero = computed(() =>
    this.columnas.map((columna) => ({
      ...columna,
      ordenes: this.filtradas()
        .filter((o) => o.estado === columna.estado)
        .sort((a, b) => b.fechaCreacion.localeCompare(a.fechaCreacion)),
    })),
  );

  protected readonly totalFiltrado = computed(() => this.filtradas().length);

  // --- Canceladas (fuera del tablero) -----------------------------------------

  protected readonly modalCanceladasAbierto = signal(false);

  protected readonly canceladas = computed(() =>
    this.filtradas()
      .filter((o) => o.estado === EstadoOrden.Cancelada)
      .sort((a, b) => b.fechaCreacion.localeCompare(a.fechaCreacion)),
  );

  // --- Indicadores -----------------------------------------------------------

  /** Se calculan sobre lo filtrado: acompañan lo que el usuario está mirando. */
  protected readonly activas = computed(
    () =>
      this.filtradas().filter(
        (o) => o.estado === EstadoOrden.Abierta || o.estado === EstadoOrden.EnProceso,
      ).length,
  );

  protected readonly listasParaEntregar = computed(
    () => this.filtradas().filter((o) => o.estado === EstadoOrden.Finalizada).length,
  );

  protected readonly conRetraso = computed(
    () => this.filtradas().filter((o) => this.diasRetraso(o) > 0).length,
  );

  // --- Retraso ---------------------------------------------------------------

  /**
   * Días vencidos sobre la fecha estimada de entrega. Solo cuenta mientras la
   * orden sigue en el taller: una cerrada o cancelada ya no puede atrasarse.
   */
  protected diasRetraso(orden: Orden): number {
    if (!orden.fechaEstimada) return 0;
    if (orden.estado !== EstadoOrden.Abierta && orden.estado !== EstadoOrden.EnProceso) return 0;

    const estimada = new Date(orden.fechaEstimada);
    const hoy = new Date();
    estimada.setHours(0, 0, 0, 0);
    hoy.setHours(0, 0, 0, 0);

    const dias = Math.floor((hoy.getTime() - estimada.getTime()) / 86_400_000);
    return dias > 0 ? dias : 0;
  }

  constructor() {
    // El acceso directo del panel llega con ?estado=2 ("Órdenes por cerrar").
    // El tablero ya muestra todos los estados a la vez, así que en vez de
    // filtrar el resto fuera de vista, resalta y centra esa columna.
    const desdeUrl = this.ruta.snapshot.queryParamMap.get('estado');
    if (desdeUrl !== null) {
      const estado = Number(desdeUrl) as EstadoOrden;
      this.columnaDestacada.set(estado);
      afterNextRender(() => this.centrarColumna(estado));
      setTimeout(() => this.columnaDestacada.set(null), 2500);
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
  }

  /**
   * Trae la primera foto de cada vehículo distinto entre las órdenes cargadas
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
      const mapa = new Map<string, string | null>();
      vehiculoIds.forEach((id, i) => mapa.set(id, listas[i][0]?.url ?? null));
      this.fotosPorVehiculo.set(mapa);
    });
  }

  /** Portada del vehículo de la orden, o null si no tiene fotos cargadas. */
  protected fotoPortada(orden: Orden): string | null {
    return this.fotosPorVehiculo().get(orden.vehiculoId) ?? null;
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

  // --- Tarjeta -----------------------------------------------------------------

  protected abrirDetalle(orden: Orden): void {
    this.router.navigate(['/ordenes', orden.ordenId]);
  }

  /** Solo tiene sentido cobrar trabajo terminado (misma regla que Proformas). */
  protected sePuedeFacturar(orden: Orden): boolean {
    return orden.estado === EstadoOrden.Finalizada || orden.estado === EstadoOrden.Cerrada;
  }
}
