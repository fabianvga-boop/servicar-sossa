import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { ConfirmarSalida } from '../../core/guards/confirmar-salida.guard';
import {
  ETIQUETAS,
  EstadoOrden,
  EstadoServicioOrden,
  EstadoUsuario,
  EstadoZonaVehiculo,
  OrigenRepuesto,
} from '../../core/models/enums';
import { Proforma } from '../../core/models/finanzas.model';
import { Repuesto } from '../../core/models/inventario.model';
import {
  TipoCarroceria,
  Usuario,
  VehiculoFoto,
  VehiculoZona,
} from '../../core/models/personas.model';
import {
  OrdenDetalle as OrdenDetalleModel,
  OrdenRepuesto,
  OrdenServicio,
  SugerenciaDiagnostico,
  SugerenciaRepuesto,
  SugerenciaServicio,
  TipoServicio,
} from '../../core/models/taller.model';
import { AuthService } from '../../core/services/auth.service';
import { urlArchivo } from '../../core/services/api-base';
import { ContadoresService } from '../../core/services/contadores.service';
import { ComisionesService, ProformasService } from '../../core/services/finanzas.service';
import { RepuestosService } from '../../core/services/inventario.service';
import { NotificacionService } from '../../core/services/notificacion.service';
import { OrdenesService } from '../../core/services/ordenes.service';
import { DiagnosticosService, TiposServicioService } from '../../core/services/taller.service';
import { UsuariosService } from '../../core/services/usuarios.service';
import { VehiculosService } from '../../core/services/vehiculos.service';
import { Confirmacion } from '../../shared/components/confirmacion';
import { DiagramaVehiculo } from '../../shared/components/diagrama-vehiculo';
import { InsigniaEstado } from '../../shared/components/insignia-estado';
import { Migas } from '../../shared/components/migas';
import { Modal } from '../../shared/components/modal';
import { Paso, Pasos } from '../../shared/components/pasos';
import { Placa } from '../../shared/components/placa';
import { OpcionSelector, SelectorBusqueda } from '../../shared/components/selector-busqueda';
import { SiTieneRol } from '../../shared/directives/si-tiene-rol';
import { BolivianosPipe } from '../../shared/pipes/bolivianos.pipe';

/** Un requisito que la orden debe cumplir para poder avanzar de etapa. */
interface Requisito {
  etiqueta: string;
  cumplido: boolean;
  ayuda: string;
}

/**
 * Servicios típicos que no tienen sentido sin el repuesto que usan (cambio de
 * aceite sin aceite, de pastillas sin pastillas...). Se detecta por palabra
 * clave en el nombre del servicio en vez de agregar un campo al catálogo: así
 * también funciona con servicios de texto libre, sin pedirle al administrador
 * que configure nada de más.
 */
const PALABRAS_CLAVE_REPUESTO: Record<string, string> = {
  aceite: 'aceite',
  filtro: 'filtro',
  bateria: 'batería',
  bujia: 'bujías',
  pastilla: 'pastillas de freno',
  disco: 'disco de freno',
  valvula: 'válvulas',
  correa: 'correa',
  amortiguador: 'amortiguador',
  llanta: 'llanta',
  neumatico: 'neumático',
  embrague: 'embrague',
  clutch: 'embrague',
  rodamiento: 'rodamiento',
  radiador: 'refrigerante',
};

/**
 * Rango de tildes sueltas que deja `normalize('NFD')` al separar cada letra
 * de su acento (U+0300–U+036F). Se arma con `fromCharCode` para que el código
 * fuente quede en ASCII puro y nadie lo rompa al reindentar o recodificar.
 */
const DIACRITICOS_SERVICIO = new RegExp(
  `[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`,
  'g',
);

/** Sin acentos y en minúsculas, para que "batería"/"bateria" avisen igual. */
function repuestoSugeridoPara(nombreServicio: string): string | null {
  const normalizado = nombreServicio.toLowerCase().normalize('NFD').replace(DIACRITICOS_SERVICIO, '');

  for (const [clave, etiqueta] of Object.entries(PALABRAS_CLAVE_REPUESTO)) {
    if (normalizado.includes(clave)) return etiqueta;
  }
  return null;
}

/** USU022-USU025 — detalle de la orden: mecánicos, servicios, repuestos y cierre. */
@Component({
  selector: 'app-orden-detalle',
  imports: [
    FormsModule,
    RouterLink,
    DatePipe,
    Modal,
    Confirmacion,
    InsigniaEstado,
    Migas,
    Pasos,
    Placa,
    SelectorBusqueda,
    SiTieneRol,
    BolivianosPipe,
    DiagramaVehiculo,
  ],
  templateUrl: './orden-detalle.html',
  styleUrl: './orden-detalle.css',
  host: {
    // Cierre de la pestaña/navegador: el guard de ruta no alcanza a interceptarlo.
    '(window:beforeunload)': 'alCerrarPestania($event)',
  },
})
export class OrdenDetalle implements ConfirmarSalida {
  /** Llega de la ruta `/ordenes/:id` vía withComponentInputBinding. */
  readonly id = input.required<string>();

  private readonly servicio = inject(OrdenesService);
  private readonly usuariosService = inject(UsuariosService);
  private readonly tiposServicioService = inject(TiposServicioService);
  private readonly diagnosticosService = inject(DiagnosticosService);
  private readonly repuestosService = inject(RepuestosService);
  private readonly vehiculosService = inject(VehiculosService);
  private readonly comisionesService = inject(ComisionesService);
  private readonly proformasService = inject(ProformasService);
  private readonly notificacion = inject(NotificacionService);
  private readonly contadores = inject(ContadoresService);
  protected readonly auth = inject(AuthService);

  protected readonly orden = signal<OrdenDetalleModel | null>(null);
  protected readonly cargando = signal(true);
  protected readonly procesando = signal(false);

  // Fotos del vehículo (mismas que gestiona el módulo Vehículos): acá se ven
  // nada más, de sólo lectura — subir o borrar sigue viviendo en Vehículos.
  protected readonly fotosVehiculo = signal<VehiculoFoto[]>([]);
  protected readonly galeriaAbierta = signal(false);
  protected readonly urlArchivo = urlArchivo;

  // Diagrama vectorial del vehículo (USU022-025): zonas marcadas sobre la
  // silueta, para anotar daños/observaciones sin depender solo de texto libre.
  protected readonly tipoCarroceriaVehiculo = signal<TipoCarroceria>('Generico');
  protected readonly diagramaSvgUrlVehiculo = signal<string | null>(null);

  // Diagnóstico asistido: sugerencias de servicios/repuestos/precio para la
  // orden, calculadas a partir de la falla del diagnóstico que la originó.
  protected readonly sugerenciaOrden = signal<SugerenciaDiagnostico | null>(null);
  protected readonly zonasVehiculo = signal<VehiculoZona[]>([]);
  protected readonly zonaEditando = signal<string | null>(null);
  protected readonly guardandoZona = signal(false);
  protected readonly diagramaAbierto = signal(false);
  protected readonly EstadoZonaVehiculo = EstadoZonaVehiculo;
  protected nuevaZona = {
    estado: EstadoZonaVehiculo.Atencion,
    detalle: '',
  };

  protected readonly mecanicos = signal<Usuario[]>([]);
  protected readonly catalogo = signal<TipoServicio[]>([]);
  protected readonly repuestos = signal<Repuesto[]>([]);

  // Escribir menos: nombres/descripciones libres ya usados antes en cualquier orden.
  protected readonly nombresServicioLibreSugeridos = signal<string[]>([]);
  protected readonly descripcionesRepuestoLibreSugeridas = signal<string[]>([]);

  /**
   * Proforma/proforma de cobro de la orden, si ya se emitió. Alimenta el estado
   * de cobro del Resumen: ¿ya pagó el cliente o queda saldo? Es la pregunta
   * clave al entregar el auto. Null mientras no exista documento de cobro.
   */
  protected readonly proforma = signal<Proforma | null>(null);

  /**
   * Mecánicos con porcentaje de comisión configurado (> 0). Sirve solo para
   * avisar al asignar: si un mecánico no está acá, se puede asignar igual pero
   * no generará comisión al cerrar mientras no se le configure el porcentaje.
   */
  protected readonly mecanicosConComision = signal<Set<string>>(new Set());
  private readonly configComisionCargada = signal(false);

  /** true si el mecánico no genera comisión hoy (sin `%` configurado). */
  protected sinComisionConfigurada(mecanicoId: string): boolean {
    // Mientras la config no cargó, no se avisa nada para no dar un falso positivo.
    return this.configComisionCargada() && !this.mecanicosConComision().has(mecanicoId);
  }

  // Diálogos
  protected readonly panelMecanico = signal(false);
  protected readonly panelServicio = signal(false);
  protected readonly panelRepuesto = signal(false);
  protected readonly porCerrar = signal(false);
  protected readonly porCancelar = signal(false);

  // Formularios simples: son de un solo uso y no justifican un FormGroup.
  protected mecanicoSeleccionado = '';
  protected nuevoServicio = {
    delCatalogo: true,
    servicioId: '',
    nombreLibre: '',
    mecanicoId: '',
    descripcion: '',
    precio: null as number | null,
  };
  protected nuevoRepuesto = {
    origen: OrigenRepuesto.Inventario,
    repuestoId: '',
    descripcion: '',
    cantidad: 1,
    precioUnitario: null as number | null,
  };

  protected readonly EstadoOrden = EstadoOrden;
  protected readonly EstadoServicioOrden = EstadoServicioOrden;
  protected readonly OrigenRepuesto = OrigenRepuesto;
  protected readonly ETIQUETAS = ETIQUETAS;
  protected readonly origenesRepuesto = [
    OrigenRepuesto.Inventario,
    OrigenRepuesto.ClienteTrae,
    OrigenRepuesto.CompraExterna,
  ];

  protected readonly migas = computed(() => [
    { etiqueta: 'Órdenes de trabajo', ruta: '/ordenes' },
    { etiqueta: this.orden()?.ordenId ?? 'Detalle' },
  ]);

  /** Mecánicos y datos generales se pueden tocar mientras la orden siga abierta. */
  protected readonly editable = computed(() => {
    const estado = this.orden()?.estado;
    return estado === EstadoOrden.Abierta || estado === EstadoOrden.EnProceso;
  });

  /**
   * Servicios y repuestos solo se cargan una vez iniciado el trabajo: mientras
   * la orden está Abierta el administrador solo arma el equipo de mecánicos.
   * Espeja `EsEditableParaTrabajo` del backend.
   */
  protected readonly editableTrabajo = computed(() => this.orden()?.estado === EstadoOrden.EnProceso);

  /**
   * Marcar el avance de un servicio se permite también con la orden Finalizada:
   * es registro de trabajo, no un cambio en el contenido de la orden. Espeja la
   * regla del backend y evita que una orden finalizada con servicios pendientes
   * quede sin forma de completarse ni cerrarse.
   */
  protected readonly puedeAvanzarServicios = computed(() => {
    const estado = this.orden()?.estado;
    return (
      estado === EstadoOrden.Abierta ||
      estado === EstadoOrden.EnProceso ||
      estado === EstadoOrden.Finalizada
    );
  });

  protected readonly puedeGestionar = computed(() => this.auth.esAdministrador());

  /** El backend rechaza el cierre si queda algún servicio sin completar. */
  protected readonly serviciosPendientes = computed(
    () =>
      this.orden()?.servicios.filter((s) => s.estado !== EstadoServicioOrden.Completado).length ??
      0,
  );

  // --- Guía visual del flujo -----------------------------------------------

  /** Etapas de la orden como stepper; Cancelada queda fuera del recorrido. */
  protected readonly pasos = computed<Paso[]>(() => {
    const estado = this.orden()?.estado ?? EstadoOrden.Abierta;
    const etapas: { etiqueta: string; valor: EstadoOrden }[] = [
      { etiqueta: 'Abierta', valor: EstadoOrden.Abierta },
      { etiqueta: 'En proceso', valor: EstadoOrden.EnProceso },
      { etiqueta: 'Finalizada', valor: EstadoOrden.Finalizada },
      { etiqueta: 'Cerrada', valor: EstadoOrden.Cerrada },
    ];

    // Una orden cancelada se congela donde estaba: ninguna etapa queda "actual".
    const cancelada = estado === EstadoOrden.Cancelada;
    // Cerrada es un final exitoso: la última etapa se marca como completada
    // (verde con tilde), no como "actual" (marcador de marca). El rojo/marca
    // queda reservado para el aviso de Cancelada, que no alarma en un cierre OK.
    const cerradaExitosa = estado === EstadoOrden.Cerrada;

    return etapas.map((etapa) => ({
      etiqueta: etapa.etiqueta,
      completado: !cancelada && (estado > etapa.valor || cerradaExitosa),
      actual: !cancelada && !cerradaExitosa && estado === etapa.valor,
    }));
  });

  protected readonly cancelada = computed(() => this.orden()?.estado === EstadoOrden.Cancelada);

  /**
   * Requisitos de la etapa actual, en forma de checklist.
   *
   * Sin esto el usuario descubre lo que falta recién cuando el backend rechaza
   * la acción; acá lo ve antes de intentarlo.
   */
  protected readonly requisitos = computed<Requisito[]>(() => {
    const orden = this.orden();
    if (!orden) return [];

    switch (orden.estado) {
      case EstadoOrden.Abierta:
        return [
          {
            etiqueta: 'Asignar al menos un mecánico',
            cumplido: orden.mecanicos.length > 0,
            ayuda: 'El responsable del trabajo debe quedar registrado antes de empezar.',
          },
        ];

      case EstadoOrden.EnProceso:
        return [
          {
            etiqueta: 'Cargar los servicios ejecutados',
            cumplido: orden.servicios.length > 0,
            ayuda: 'Sin servicios la orden no proforma nada ni genera comisiones.',
          },
          {
            etiqueta: 'Completar todos los servicios',
            cumplido: orden.servicios.length > 0 && this.serviciosPendientes() === 0,
            ayuda: 'Marque cada servicio como Completado a medida que termine.',
          },
        ];

      case EstadoOrden.Finalizada:
        return [
          {
            etiqueta: 'Completar todos los servicios',
            cumplido: this.serviciosPendientes() === 0,
            ayuda: 'El cierre calcula comisiones: exige el trabajo terminado.',
          },
        ];

      default:
        return [];
    }
  });

  protected readonly requisitosPendientes = computed(
    () => this.requisitos().filter((r) => !r.cumplido).length,
  );

  /**
   * Motivo por el que no se puede tocar el detalle, o cadena vacía si sí se
   * puede. Alimenta el `title` de los botones deshabilitados: un botón que
   * desaparece no enseña nada, uno gris con explicación sí.
   */
  protected readonly motivoBloqueoTrabajo = computed(() => {
    const estado = this.orden()?.estado;

    if (estado === EstadoOrden.Abierta)
      return 'Inicie el trabajo para poder cargar servicios y repuestos.';

    if (estado === EstadoOrden.EnProceso) return '';

    return `La orden está ${EstadoOrden[estado ?? EstadoOrden.Abierta]} y ya no admite cambios.`;
  });

  protected readonly motivoBloqueoMecanicos = computed(() =>
    this.editable() ? '' : 'La orden ya no admite cambios en el equipo de mecánicos.',
  );

  /** Mecánicos aún no asignados, para no ofrecer duplicados en el selector. */
  protected readonly mecanicosDisponibles = computed(() => {
    const asignados = new Set(this.orden()?.mecanicos.map((m) => m.mecanicoId) ?? []);
    return this.mecanicos().filter((m) => !asignados.has(m.usuarioId));
  });

  // --- Opciones para los selectores con búsqueda ---------------------------

  protected readonly opcionesMecanico = computed<OpcionSelector[]>(() =>
    this.mecanicosDisponibles().map((m) => ({
      valor: m.usuarioId,
      etiqueta: m.nombreCompleto,
      detalle: m.usuarioId,
    })),
  );

  protected readonly opcionesAsignados = computed<OpcionSelector[]>(
    () =>
      this.orden()?.mecanicos.map((m) => ({
        valor: m.mecanicoId,
        etiqueta: m.nombreMecanico,
      })) ?? [],
  );

  protected readonly opcionesCatalogo = computed<OpcionSelector[]>(() =>
    this.catalogo().map((s) => ({
      valor: s.servicioId,
      etiqueta: s.nombre,
      detalle: `Bs ${s.precioBase.toFixed(2)}`,
    })),
  );

  protected readonly opcionesRepuesto = computed<OpcionSelector[]>(() =>
    this.repuestos().map((r) => ({
      valor: r.repuestoId,
      etiqueta: r.nombre,
      detalle: `stock ${r.stockActual}`,
      deshabilitada: r.stockActual === 0,
      razonDeshabilitada: 'Sin stock disponible',
    })),
  );

  /**
   * Iniciales para el avatar del mecánico. Es solo presentación: deriva un par
   * de letras del nombre ya cargado, sin tocar datos ni lógica.
   */
  protected iniciales(nombre: string | null | undefined): string {
    const partes = (nombre ?? '').trim().split(/\s+/).filter(Boolean);
    if (partes.length === 0) return '—';

    return partes.length === 1
      ? partes[0].slice(0, 2).toUpperCase()
      : (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
  }

  constructor() {
    // `id` es un input de ruta: Angular recién lo asigna después del
    // constructor, así que leerlo aquí directamente dispararía NG0950.
    // `effect()` espera a que el signal tenga valor y además recarga solo
    // si el usuario navega de una orden a otra sin recargar la página.
    effect(() => this.cargar(this.id()));

    if (this.auth.esAdministrador()) {
      this.usuariosService.getAll(undefined, 1, 500).subscribe((resultado) =>
        // El administrador (dueño) también trabaja vehículos cuando el taller se
        // satura, así que ambos roles pueden asignarse como trabajadores.
        this.mecanicos.set(
          resultado.items.filter(
            (u) =>
              (u.nombreRol === 'Mecanico' || u.nombreRol === 'Administrador') &&
              u.estado === EstadoUsuario.Activo,
          ),
        ),
      );
      this.tiposServicioService
        .getAll(undefined, true, 1, 500)
        .subscribe((resultado) => this.catalogo.set(resultado.items));
      this.repuestosService
        .getAll({ tamanoPagina: 500 })
        .subscribe((resultado) => this.repuestos.set(resultado.items));

      this.servicio
        .nombresServicioLibre()
        .subscribe((nombres) => this.nombresServicioLibreSugeridos.set(nombres));
      this.servicio
        .descripcionesRepuestoLibre()
        .subscribe((descripciones) =>
          this.descripcionesRepuestoLibreSugeridas.set(descripciones),
        );

      // Porcentajes configurados: solo para avisar al asignar un mecánico sin comisión.
      this.comisionesService.getConfiguraciones().subscribe((configs) => {
        this.mecanicosConComision.set(
          new Set(configs.filter((c) => c.porcentaje > 0).map((c) => c.mecanicoId)),
        );
        this.configComisionCargada.set(true);
      });
    }
  }

  private cargar(id: string): void {
    this.cargando.set(true);
    this.fotosVehiculo.set([]);
    this.proforma.set(null);
    this.sugerenciaOrden.set(null);

    this.servicio.getById(id).subscribe({
      next: (orden) => {
        this.orden.set(orden);
        this.cargando.set(false);

        // Solo de vistazo acá; si no hay fotos o falla la carga, el
        // encabezado muestra el ícono de vehículo sin foto y ya — no vale la
        // pena molestar con un aviso de error por una carga secundaria.
        this.vehiculosService
          .getFotos(orden.vehiculoId)
          .pipe(catchError(() => of([] as VehiculoFoto[])))
          .subscribe((fotos) => this.fotosVehiculo.set(fotos));

        // Diagrama: tipo de carrocería (para elegir la silueta) y las zonas ya marcadas.
        this.vehiculosService
          .getById(orden.vehiculoId)
          .pipe(catchError(() => of(null)))
          .subscribe((vehiculo) => {
            if (!vehiculo) return;
            this.tipoCarroceriaVehiculo.set(vehiculo.tipoCarroceria);
            this.diagramaSvgUrlVehiculo.set(vehiculo.diagramaSvgUrl ?? null);
          });

        this.vehiculosService
          .getZonas(orden.vehiculoId)
          .pipe(catchError(() => of([] as VehiculoZona[])))
          .subscribe((zonas) => this.zonasVehiculo.set(zonas));

        // Estado de cobro: se consulta la proforma de la orden si existe. Es
        // una carga secundaria; si falla, el Resumen simplemente no muestra el
        // badge de cobro en vez de romper la vista.
        this.proformasService
          .getAll({ ordenId: id })
          .pipe(
            map((resultado) => resultado.items[0] ?? null),
            catchError(() => of(null)),
          )
          .subscribe((proforma) => this.proforma.set(proforma));

        // Diagnóstico asistido: solo tiene sentido mientras se puede seguir
        // agregando servicios/repuestos (orden abierta/en proceso).
        const editable = orden.estado === EstadoOrden.Abierta || orden.estado === EstadoOrden.EnProceso;

        if (orden.diagnosticoId && editable) {
          this.diagnosticosService
            .sugerenciasPorId(orden.diagnosticoId)
            .pipe(catchError(() => of(null)))
            .subscribe((sugerencia) => {
              this.sugerenciaOrden.set(
                sugerencia && sugerencia.basadoEnCasos > 0 ? sugerencia : null,
              );
            });
        }
      },
      error: () => this.cargando.set(false),
    });
  }

  /** Imprime la orden como nota de entrega (el CSS de impresión oculta el cromo). */
  protected imprimir(): void {
    window.print();
  }

  protected abrirGaleriaVehiculo(): void {
    if (this.fotosVehiculo().length === 0) return;
    this.galeriaAbierta.set(true);
  }

  // --- Diagrama vectorial (zonas) ---------------------------------------------

  protected onZonaClick(zona: string): void {
    this.zonaEditando.set(zona);
    this.nuevaZona = { estado: EstadoZonaVehiculo.Atencion, detalle: '' };
  }

  protected cancelarZona(): void {
    this.zonaEditando.set(null);
  }

  protected cerrarDiagrama(): void {
    this.diagramaAbierto.set(false);
    this.zonaEditando.set(null);
  }

  protected guardarZona(): void {
    const orden = this.orden();
    const zona = this.zonaEditando();
    if (!orden || !zona) return;

    this.guardandoZona.set(true);

    this.vehiculosService
      .registrarZona(orden.vehiculoId, {
        zona,
        estado: this.nuevaZona.estado,
        detalle: this.nuevaZona.detalle || null,
        ordenId: orden.ordenId,
      })
      .subscribe({
        next: (nueva) => {
          this.zonasVehiculo.update((lista) => [nueva, ...lista]);
          this.guardandoZona.set(false);
          this.zonaEditando.set(null);
          this.notificacion.exito('Zona registrada en el diagrama.');
        },
        error: () => this.guardandoZona.set(false),
      });
  }

  /** Todas las operaciones del detalle devuelven la orden completa actualizada. */
  private aplicar(mensaje: string) {
    return {
      next: (orden: OrdenDetalleModel) => {
        this.orden.set(orden);
        this.notificacion.exito(mensaje);
        this.procesando.set(false);
        this.cerrarPaneles();
        // Los badges de la barra lateral cuentan órdenes activas y stock bajo.
        this.contadores.refrescar();
      },
      error: () => this.procesando.set(false),
    };
  }

  /**
   * Igual que `aplicar`, pero el aviso ofrece deshacer. Se usa al quitar un
   * servicio o repuesto: la acción ya se ejecutó, y revertirla es volver a
   * crearlo con los mismos datos.
   */
  private aplicarConDeshacer(mensaje: string, revertir: () => void) {
    return {
      next: (orden: OrdenDetalleModel) => {
        this.orden.set(orden);
        this.notificacion.deshacer(mensaje, revertir);
        this.procesando.set(false);
        this.cerrarPaneles();
        this.contadores.refrescar();
      },
      error: () => this.procesando.set(false),
    };
  }

  private cerrarPaneles(): void {
    this.panelMecanico.set(false);
    this.panelServicio.set(false);
    this.panelRepuesto.set(false);
    this.porCerrar.set(false);
    this.porCancelar.set(false);
  }

  // --- Estado de la orden --------------------------------------------------

  protected iniciar(): void {
    this.procesando.set(true);
    this.servicio
      .cambiarEstado(this.id(), EstadoOrden.EnProceso)
      .subscribe(this.aplicar('Orden marcada en proceso. Ya puede cargar servicios y repuestos.'));
  }

  protected finalizar(): void {
    this.procesando.set(true);
    this.servicio
      .cambiarEstado(this.id(), EstadoOrden.Finalizada)
      .subscribe(this.aplicar('Orden finalizada. Ya se puede cerrar y facturar.'));
  }

  protected cerrarOrden(): void {
    this.procesando.set(true);
    this.servicio
      .cambiarEstado(this.id(), EstadoOrden.Cerrada)
      .subscribe(this.aplicar('Orden cerrada: stock descontado y comisiones calculadas.'));
  }

  protected cancelarOrden(): void {
    this.procesando.set(true);
    this.servicio
      .cambiarEstado(this.id(), EstadoOrden.Cancelada)
      .subscribe(this.aplicar('Orden cancelada.'));
  }

  // --- Mecánicos (USU022) --------------------------------------------------

  protected asignarMecanico(): void {
    if (!this.mecanicoSeleccionado) return;

    // Se capturan antes de limpiar la selección, para el aviso posterior.
    const mecanicoId = this.mecanicoSeleccionado;
    const nombre =
      this.mecanicos().find((m) => m.usuarioId === mecanicoId)?.nombreCompleto ?? 'El mecánico';
    const sinComision = this.sinComisionConfigurada(mecanicoId);

    this.procesando.set(true);

    const aplicar = this.aplicar('Mecánico asignado.');
    this.servicio.asignarMecanico(this.id(), mecanicoId).subscribe({
      next: (orden) => {
        aplicar.next(orden);
        // Aviso no bloqueante: se asignó igual, pero conviene configurar el %.
        if (sinComision) {
          this.notificacion.advertencia(
            `${nombre} no tiene porcentaje de comisión configurado: no generará comisión ` +
              'al cerrar la orden mientras no se lo configure en Comisiones → Porcentajes.',
          );
        }
      },
      error: aplicar.error,
    });

    this.mecanicoSeleccionado = '';
  }

  protected quitarMecanico(mecanicoId: string): void {
    this.procesando.set(true);

    this.servicio.quitarMecanico(this.id(), mecanicoId).subscribe(
      this.aplicarConDeshacer('Mecánico desasignado.', () => {
        this.procesando.set(true);
        this.servicio
          .asignarMecanico(this.id(), mecanicoId)
          .subscribe(this.aplicar('Se restauró la asignación del mecánico.'));
      }),
    );
  }

  // --- Servicios (USU023) --------------------------------------------------

  /**
   * Por lo general un solo mecánico trabaja el vehículo: se lo preselecciona
   * para no hacer elegir de nuevo a quien ya está asignado a la orden. Si hay
   * dos (el caso de saturación), queda el selector para indicar cuál hizo el
   * trabajo.
   */
  /** Diagnóstico asistido: abre el panel de servicio con la sugerencia ya cargada. */
  protected abrirPanelServicioSugerido(sugerencia: SugerenciaServicio): void {
    this.abrirPanelServicio();
    this.nuevoServicio.delCatalogo = !!sugerencia.servicioId;
    this.nuevoServicio.servicioId = sugerencia.servicioId ?? '';
    this.nuevoServicio.nombreLibre = sugerencia.servicioId ? '' : sugerencia.nombre;
    this.nuevoServicio.precio = sugerencia.precioPromedio;
  }

  /** Diagnóstico asistido: abre el panel de repuesto con la sugerencia ya cargada. */
  protected abrirPanelRepuestoSugerido(sugerencia: SugerenciaRepuesto): void {
    this.nuevoRepuesto = {
      origen: sugerencia.repuestoId ? OrigenRepuesto.Inventario : OrigenRepuesto.CompraExterna,
      repuestoId: sugerencia.repuestoId ?? '',
      descripcion: sugerencia.repuestoId ? '' : sugerencia.nombre,
      cantidad: 1,
      precioUnitario: sugerencia.precioUnitarioPromedio,
    };
    this.panelRepuesto.set(true);
  }

  protected abrirPanelServicio(): void {
    const asignados = this.orden()?.mecanicos ?? [];

    this.nuevoServicio = {
      delCatalogo: true,
      servicioId: '',
      nombreLibre: '',
      mecanicoId: asignados.length === 1 ? asignados[0].mecanicoId : '',
      descripcion: '',
      precio: null,
    };

    this.panelServicio.set(true);
  }

  /** Al cambiar el origen se limpian los campos que dejan de aplicar. */
  protected cambiarOrigenServicio(delCatalogo: boolean): void {
    this.nuevoServicio.delCatalogo = delCatalogo;
    this.nuevoServicio.servicioId = '';
    this.nuevoServicio.nombreLibre = '';
    this.nuevoServicio.precio = null;
  }

  protected onServicioSeleccionado(servicioId: string): void {
    // Propone el precio base del catálogo; el usuario puede ajustarlo.
    const servicio = this.catalogo().find((s) => s.servicioId === servicioId);
    this.nuevoServicio.precio = servicio?.precioBase ?? null;
  }

  protected agregarServicio(): void {
    const { delCatalogo, servicioId, nombreLibre, mecanicoId, descripcion, precio } =
      this.nuevoServicio;

    if (!mecanicoId) {
      this.notificacion.advertencia('Seleccione el mecánico responsable.');
      return;
    }

    if (delCatalogo && !servicioId) {
      this.notificacion.advertencia('Seleccione el servicio del catálogo.');
      return;
    }

    if (!delCatalogo && !nombreLibre.trim()) {
      this.notificacion.advertencia('Describa el servicio a realizar.');
      return;
    }

    if (!delCatalogo && (precio == null || precio <= 0)) {
      this.notificacion.advertencia('Indique el precio cobrado por el servicio.');
      return;
    }

    this.procesando.set(true);

    this.servicio
      .agregarServicio(this.id(), {
        servicioId: delCatalogo ? servicioId : null,
        nombreLibre: delCatalogo ? null : nombreLibre.trim(),
        mecanicoId,
        descripcion: descripcion || null,
        precio,
      })
      .subscribe(this.aplicar('Servicio agregado a la orden.'));

    this.nuevoServicio = {
      delCatalogo: true,
      servicioId: '',
      nombreLibre: '',
      mecanicoId: '',
      descripcion: '',
      precio: null,
    };
  }

  /**
   * Aviso pendiente de confirmar: se intentó marcar en proceso o completar un
   * servicio que típicamente necesita un repuesto (cambio de aceite,
   * pastillas, batería…) y la orden todavía no tiene ninguno cargado. No
   * bloquea — el mecánico puede confirmar igual si ya lo tiene a mano y lo va
   * a cargar después.
   */
  protected readonly avisoRepuestoServicio = signal<{
    ordenServicioId: string;
    nombreServicio: string;
    repuestoSugerido: string;
    estado: EstadoServicioOrden;
  } | null>(null);

  protected avanzarServicio(ordenServicioId: string, estado: EstadoServicioOrden): void {
    if (estado === EstadoServicioOrden.EnProceso || estado === EstadoServicioOrden.Completado) {
      const servicio = this.orden()?.servicios.find((s) => s.ordenServicioId === ordenServicioId);
      const repuestoSugerido = servicio ? repuestoSugeridoPara(servicio.nombreServicio) : null;
      const sinRepuestosCargados = (this.orden()?.repuestos.length ?? 0) === 0;

      if (servicio && repuestoSugerido && sinRepuestosCargados) {
        this.avisoRepuestoServicio.set({
          ordenServicioId,
          nombreServicio: servicio.nombreServicio,
          repuestoSugerido,
          estado,
        });
        return;
      }
    }

    this.ejecutarAvanceServicio(ordenServicioId, estado);
  }

  /** El mecánico confirmó que continúa igual sin registrar antes el repuesto. */
  protected confirmarAvanceSinRepuesto(): void {
    const aviso = this.avisoRepuestoServicio();
    if (!aviso) return;
    this.avisoRepuestoServicio.set(null);
    this.ejecutarAvanceServicio(aviso.ordenServicioId, aviso.estado);
  }

  private ejecutarAvanceServicio(ordenServicioId: string, estado: EstadoServicioOrden): void {
    this.procesando.set(true);
    this.servicio
      .cambiarEstadoServicio(this.id(), ordenServicioId, estado)
      .subscribe(this.aplicar('Estado del servicio actualizado.'));
  }

  protected quitarServicio(servicio: OrdenServicio): void {
    this.procesando.set(true);

    this.servicio.quitarServicio(this.id(), servicio.ordenServicioId).subscribe(
      this.aplicarConDeshacer(`Se quitó «${servicio.nombreServicio}» de la orden.`, () => {
        this.procesando.set(true);
        this.servicio
          .agregarServicio(this.id(), {
            servicioId: servicio.servicioId ?? null,
            nombreLibre: servicio.servicioId ? null : servicio.nombreServicio,
            mecanicoId: servicio.mecanicoId,
            diagnosticoId: servicio.diagnosticoId ?? null,
            descripcion: servicio.descripcion ?? null,
            precio: servicio.precio,
          })
          .subscribe(this.aplicar('Servicio restaurado en la orden.'));
      }),
    );
  }

  // --- Repuestos -----------------------------------------------------------

  protected onRepuestoSeleccionado(repuestoId: string): void {
    const repuesto = this.repuestos().find((r) => r.repuestoId === repuestoId);
    this.nuevoRepuesto.precioUnitario = repuesto?.precioVenta ?? null;
  }

  /** Al cambiar el origen se limpian los campos que dejan de aplicar. */
  protected cambiarOrigenRepuesto(origen: OrigenRepuesto): void {
    this.nuevoRepuesto.origen = origen;
    this.nuevoRepuesto.repuestoId = '';
    this.nuevoRepuesto.descripcion = '';
    // El que trae el cliente no se cobra; los demás parten sin precio propuesto.
    this.nuevoRepuesto.precioUnitario = null;
  }

  protected agregarRepuesto(): void {
    const { origen, repuestoId, descripcion, cantidad, precioUnitario } = this.nuevoRepuesto;

    if (cantidad < 1) {
      this.notificacion.advertencia('Indique una cantidad válida.');
      return;
    }

    if (origen === OrigenRepuesto.Inventario && !repuestoId) {
      this.notificacion.advertencia('Seleccione el repuesto del inventario.');
      return;
    }

    if (origen !== OrigenRepuesto.Inventario && !descripcion.trim()) {
      this.notificacion.advertencia('Describa el repuesto que no proviene del inventario.');
      return;
    }

    if (origen === OrigenRepuesto.CompraExterna && (precioUnitario == null || precioUnitario <= 0)) {
      this.notificacion.advertencia('Indique el costo del repuesto de compra externa.');
      return;
    }

    this.procesando.set(true);

    this.servicio
      .agregarRepuesto(this.id(), {
        origen,
        repuestoId: origen === OrigenRepuesto.Inventario ? repuestoId : null,
        descripcion: origen === OrigenRepuesto.Inventario ? null : descripcion.trim(),
        cantidad,
        // El que trae el cliente va sin cargo; la compra externa a su costo.
        precioUnitario: origen === OrigenRepuesto.ClienteTrae ? 0 : precioUnitario,
      })
      .subscribe(this.aplicar('Repuesto agregado a la orden.'));

    this.nuevoRepuesto = {
      origen: OrigenRepuesto.Inventario,
      repuestoId: '',
      descripcion: '',
      cantidad: 1,
      precioUnitario: null,
    };
  }

  protected quitarRepuesto(consumo: OrdenRepuesto): void {
    this.procesando.set(true);

    this.servicio.quitarRepuesto(this.id(), consumo.ordenRepuestoId).subscribe(
      this.aplicarConDeshacer(`Se quitó «${consumo.nombreRepuesto}» de la orden.`, () => {
        this.procesando.set(true);
        this.servicio
          .agregarRepuesto(this.id(), {
            origen: consumo.origen,
            repuestoId: consumo.repuestoId ?? null,
            descripcion:
              consumo.origen === OrigenRepuesto.Inventario ? null : consumo.nombreRepuesto,
            cantidad: consumo.cantidad,
            precioUnitario: consumo.precioUnitario,
          })
          .subscribe(this.aplicar('Repuesto restaurado en la orden.'));
      }),
    );
  }

  // --- Protección de salida (CAPA 1.3) --------------------------------------

  /** Cualquier panel abierto puede tener datos tipeados que se perderían al salir. */
  hayCambiosSinGuardar(): boolean {
    return (
      this.panelMecanico() ||
      this.panelServicio() ||
      this.panelRepuesto() ||
      this.porCerrar() ||
      this.porCancelar() ||
      this.avisoRepuestoServicio() !== null
    );
  }

  protected alCerrarPestania(evento: BeforeUnloadEvent): void {
    if (!this.hayCambiosSinGuardar()) return;

    evento.preventDefault();
    evento.returnValue = '';
  }
}
