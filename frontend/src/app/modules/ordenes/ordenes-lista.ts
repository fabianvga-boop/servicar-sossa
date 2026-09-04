import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { EstadoOrden } from '../../core/models/enums';
import { Orden } from '../../core/models/taller.model';
import { AuthService } from '../../core/services/auth.service';
import { OrdenesService } from '../../core/services/ordenes.service';
import { PreferenciasService } from '../../core/services/preferencias.service';
import { EstadoTabla } from '../../shared/components/estado-tabla';
import { InsigniaEstado } from '../../shared/components/insignia-estado';
import { BolivianosPipe } from '../../shared/pipes/bolivianos.pipe';

const CLAVE_FILTRO = 'ordenes.estado';
const CLAVE_FILAS = 'ordenes.filas';

/** Columnas por las que se puede ordenar el listado. */
type CampoOrden = 'fechaCreacion' | 'total';

/**
 * USU021 — listado de órdenes de trabajo.
 *
 * No se crean aquí: toda orden nace de un diagnóstico (ver módulo
 * Diagnósticos, botón "Generar orden"), así ninguna queda sin un motivo de
 * ingreso registrado y no se duplica trabajo sobre el mismo vehículo.
 *
 * El estado se filtra en el servidor (es el filtro que el panel usa como
 * acceso directo); búsqueda, rango de fechas, orden y paginación trabajan
 * sobre la lista ya recibida. Mientras el backend devuelva la tabla entera
 * eso alcanza y evita un viaje por cada tecla.
 */
@Component({
  selector: 'app-ordenes-lista',
  imports: [RouterLink, DatePipe, EstadoTabla, InsigniaEstado, BolivianosPipe],
  templateUrl: './ordenes-lista.html',
  styleUrl: './ordenes-lista.css',
  // Un clic en cualquier parte cierra el menú de fila abierto; el propio
  // botón detiene la propagación para no cerrarse a sí mismo al abrirse.
  host: { '(document:click)': 'cerrarMenu()' },
})
export class OrdenesLista {
  private readonly servicio = inject(OrdenesService);
  private readonly preferencias = inject(PreferenciasService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);

  protected readonly ordenes = signal<Orden[]>([]);
  protected readonly cargando = signal(true);
  protected readonly estadoFiltro = signal('');

  protected readonly buscar = signal('');
  protected readonly desde = signal('');
  protected readonly hasta = signal('');

  protected readonly campoOrden = signal<CampoOrden>('fechaCreacion');
  protected readonly ascendente = signal(false);

  protected readonly pagina = signal(1);
  protected readonly filasPorPagina = signal(10);

  /** Orden cuyo menú de acciones está desplegado. */
  protected readonly menuAbierto = signal<string | null>(null);

  protected readonly EstadoOrden = EstadoOrden;
  protected readonly opcionesFilas = [10, 20, 50];

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

  // --- Filtro, orden y página ------------------------------------------------

  /** Búsqueda por código, cliente o placa, más el rango de fechas. */
  private readonly filtradas = computed<Orden[]>(() => {
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

  protected readonly ordenadas = computed<Orden[]>(() => {
    const campo = this.campoOrden();
    const signo = this.ascendente() ? 1 : -1;

    return [...this.filtradas()].sort((a, b) => {
      const comparacion =
        campo === 'total' ? a.total - b.total : a.fechaCreacion.localeCompare(b.fechaCreacion);

      return comparacion * signo;
    });
  });

  protected readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.ordenadas().length / this.filasPorPagina())),
  );

  protected readonly paginadas = computed<Orden[]>(() => {
    const inicio = (this.pagina() - 1) * this.filasPorPagina();
    return this.ordenadas().slice(inicio, inicio + this.filasPorPagina());
  });

  /** Índice del primer y último registro visible, para el pie de la tabla. */
  protected readonly desdeVisible = computed(() =>
    this.ordenadas().length === 0 ? 0 : (this.pagina() - 1) * this.filasPorPagina() + 1,
  );

  protected readonly hastaVisible = computed(() =>
    Math.min(this.pagina() * this.filasPorPagina(), this.ordenadas().length),
  );

  protected readonly totalFiltrado = computed(() => this.ordenadas().length);

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
    // El acceso directo del panel llega con ?estado=2; si no viene nada, se
    // recupera el último filtro que el usuario dejó puesto.
    const desdeUrl = this.ruta.snapshot.queryParamMap.get('estado');
    this.estadoFiltro.set(desdeUrl ?? this.preferencias.leer(CLAVE_FILTRO, ''));
    this.filasPorPagina.set(Number(this.preferencias.leer(CLAVE_FILAS, '10')) || 10);

    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);

    const estado = this.estadoFiltro();

    this.servicio
      .getAll({ estado: estado === '' ? undefined : (Number(estado) as EstadoOrden) })
      .subscribe({
        next: (lista) => {
          this.ordenes.set(lista);
          this.cargando.set(false);
        },
        error: () => this.cargando.set(false),
      });
  }

  protected onFiltrarEstado(valor: string): void {
    this.estadoFiltro.set(valor);
    this.preferencias.guardar(CLAVE_FILTRO, valor);
    this.pagina.set(1);
    this.cargar();
  }

  /** Cualquier filtro que cambie devuelve a la primera página. */
  protected onBuscar(valor: string): void {
    this.buscar.set(valor);
    this.pagina.set(1);
  }

  protected onDesde(valor: string): void {
    this.desde.set(valor);
    this.pagina.set(1);
  }

  protected onHasta(valor: string): void {
    this.hasta.set(valor);
    this.pagina.set(1);
  }

  protected limpiarFechas(): void {
    this.desde.set('');
    this.hasta.set('');
    this.pagina.set(1);
  }

  /** Clic en un encabezado: alterna la dirección si ya se ordena por él. */
  protected ordenarPor(campo: CampoOrden): void {
    if (this.campoOrden() === campo) {
      this.ascendente.update((v) => !v);
    } else {
      this.campoOrden.set(campo);
      this.ascendente.set(false);
    }

    this.pagina.set(1);
  }

  protected irA(pagina: number): void {
    this.pagina.set(Math.min(Math.max(1, pagina), this.totalPaginas()));
  }

  protected cambiarFilas(valor: string): void {
    this.filasPorPagina.set(Number(valor));
    this.preferencias.guardar(CLAVE_FILAS, valor);
    this.pagina.set(1);
  }

  // --- Fila y menú -----------------------------------------------------------

  protected abrirDetalle(orden: Orden): void {
    this.router.navigate(['/ordenes', orden.ordenId]);
  }

  /** El clic del botón no debe llegar al documento ni abrir la fila. */
  protected alternarMenu(evento: Event, ordenId: string): void {
    evento.stopPropagation();
    this.menuAbierto.update((abierto) => (abierto === ordenId ? null : ordenId));
  }

  protected cerrarMenu(): void {
    this.menuAbierto.set(null);
  }

  /** Solo tiene sentido cobrar trabajo terminado (misma regla que Facturas). */
  protected sePuedeFacturar(orden: Orden): boolean {
    return orden.estado === EstadoOrden.Finalizada || orden.estado === EstadoOrden.Cerrada;
  }
}
