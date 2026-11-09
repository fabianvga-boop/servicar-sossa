import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { ConfirmarSalida } from '../../core/guards/confirmar-salida.guard';
import {
  AccionAuditoria,
  ETIQUETAS,
  EstadoProforma,
  EstadoOrden,
  EstadoServicioOrden,
  EstadoUsuario,
  EstadoZonaVehiculo,
  NivelCompatibilidad,
  OrigenRepuesto,
} from '../../core/models/enums';
import { Proforma } from '../../core/models/finanzas.model';
import { Repuesto, RepuestoParaVehiculo } from '../../core/models/inventario.model';
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
import { Auditoria } from '../../core/models/auditoria.model';
import { AuditoriaService } from '../../core/services/auditoria.service';
import { DIAGNOSTICO_ASISTIDO } from '../../core/funciones-activas';
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
import { DiagramaVehiculo, etiquetaZona } from '../../shared/components/diagrama-vehiculo';
import { Migas } from '../../shared/components/migas';
import { Modal } from '../../shared/components/modal';
import { Cajon } from '../../shared/components/cajon';
import { coincidePorPalabras } from '../../shared/busqueda';
import { prepararFoto } from '../../shared/fotos';
import { CorregirOrden } from './corregir-orden';
import { Paso } from '../../shared/components/pasos';
import { Placa } from '../../shared/components/placa';
import { estiloOrden } from '../../shared/estilo-estado';
import {
  MarcaOpcion,
  OpcionSelector,
  SelectorBusqueda,
} from '../../shared/components/selector-busqueda';
import { TextoResaltado } from '../../shared/components/texto-resaltado';
import { SiTieneRol } from '../../shared/directives/si-tiene-rol';
import { BolivianosPipe } from '../../shared/pipes/bolivianos.pipe';

/** Un requisito que la orden debe cumplir para poder avanzar de etapa. */
interface Requisito {
  etiqueta: string;
  cumplido: boolean;
  ayuda: string;
}

/** La próxima acción de la orden, para el recuadro "Siguiente paso". */
interface SiguientePaso {
  tipo:
    | 'asignar'
    | 'iniciar'
    | 'esperar'
    | 'agregarServicio'
    | 'registrarRepuesto'
    | 'completar'
    | 'finalizar'
    | 'cerrar'
    | 'emitir'
    | 'cobrar'
    | 'listo'
    | 'cancelada';
  titulo: string;
  detalle: string;
  /** El servicio al que apunta el botón, cuando hay uno solo. */
  servicio?: OrdenServicio;
}

/**
 * Si un repuesto del inventario corresponde al servicio para el que se
 * registra, según las categorías que lleva el servicio en el catálogo.
 * "libre": no hay nada que controlar (servicio sin categorías o repuesto sin
 * categoría).
 */
type EncajeCategoria = 'corresponde' | 'otra' | 'libre';

/**
 * Cómo se ve cada tipo de registro en el Historial: color, ícono y una
 * palabra. Se distingue de un vistazo qué se agregó, qué se quitó y, sobre
 * todo, qué fue una excepción.
 */
const ESTILO_HISTORIAL: Record<
  AccionAuditoria,
  { etiqueta: string; tono: 'verde' | 'azul' | 'naranja' | 'roja' | 'gris'; icono: string }
> = {
  [AccionAuditoria.Crear]: { etiqueta: 'Agregó', tono: 'verde', icono: 'M12 5v14M5 12h14' },
  [AccionAuditoria.Editar]: {
    etiqueta: 'Editó',
    tono: 'azul',
    icono: 'M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z',
  },
  [AccionAuditoria.Eliminar]: {
    etiqueta: 'Quitó',
    tono: 'gris',
    icono: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
  },
  [AccionAuditoria.Anular]: { etiqueta: 'Anuló', tono: 'roja', icono: 'M18 6 6 18M6 6l12 12' },
  [AccionAuditoria.Ajustar]: {
    etiqueta: 'Ajustó',
    tono: 'naranja',
    icono: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  },
  [AccionAuditoria.CambiarEstado]: {
    etiqueta: 'Cambio de estado',
    tono: 'azul',
    icono: 'M5 12h14M13 6l6 6-6 6',
  },
  [AccionAuditoria.Excepcion]: {
    etiqueta: 'Excepción',
    tono: 'roja',
    icono: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  },
};

/** Repuesto de otra categoría que el Administrador quiere registrar igual. */
interface ExcepcionCategoria {
  repuesto: string;
  servicio: string;
  lleva: string;
}

/**
 * Servicios típicos que no tienen sentido sin el repuesto que usan (cambio de
 * aceite sin aceite, de pastillas sin pastillas...). Los del catálogo traen su
 * propia marca "usa repuestos"; esta lista solo la propone para un servicio
 * fuera de catálogo según su nombre, y el Administrador puede cambiarla.
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
    CorregirOrden,
    FormsModule,
    RouterLink,
    TextoResaltado,
    DatePipe,
    Modal,
    Cajon,
    Confirmacion,
    Migas,
    Placa,
    SelectorBusqueda,
    SiTieneRol,
    BolivianosPipe,
    DiagramaVehiculo,
  ],
  templateUrl: './orden-detalle.html',
  styleUrls: ['./orden-detalle.css', './orden-trabajo.css', './orden-jerarquia.css'],
  host: {
    // Cierre de la pestaña/navegador: el guard de ruta no alcanza a interceptarlo.
    '(window:beforeunload)': 'alCerrarPestania($event)',
    // Un clic fuera del menú "Más" lo cierra.
    '(document:click)': 'alHacerClic($event)',
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
  private readonly auditoriaService = inject(AuditoriaService);
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
  protected readonly panelCorregir = signal(false);

  /** Corrección en la línea: el servicio o repuesto que se está editando. */
  protected readonly editandoServicio = signal<OrdenServicio | null>(null);
  protected readonly editandoRepuesto = signal<OrdenRepuesto | null>(null);
  protected edicion = { precio: 0, descripcion: '', cantidad: 1, precioUnitario: 0 };

  // Formularios simples: son de un solo uso y no justifican un FormGroup.
  protected mecanicoSeleccionado = '';
  /** Obligatorio solo al sumar un segundo mecánico (excepción). */
  protected motivoExcepcionMecanico = '';
  protected nuevoServicio = this.servicioVacio();
  protected nuevoRepuesto = this.repuestoVacio();

  protected readonly EstadoOrden = EstadoOrden;
  protected readonly AccionAuditoria = AccionAuditoria;
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

  /** Lo exclusivo del Administrador: asignar mecánicos, cancelar, cerrar, excepciones. */
  protected readonly puedeGestionar = computed(() => this.auth.esAdministrador());

  /**
   * Trabajar la orden (servicios, repuestos, iniciar y finalizar): el
   * Administrador o el mecánico asignado a ella. Espeja la regla del backend.
   */
  protected readonly puedeTrabajar = computed(
    () =>
      this.auth.esAdministrador() ||
      (this.orden()?.mecanicos.some((m) => m.mecanicoId === this.auth.usuarioId()) ?? false),
  );

  /** Historial de la orden (Administrador): todo lo registrado sobre ella en Auditoría. */
  protected readonly historial = signal<Auditoria[]>([]);
  protected readonly ESTILO_HISTORIAL = ESTILO_HISTORIAL;

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
            etiqueta: 'Asignar el mecánico de la orden',
            cumplido: orden.mecanicos.length > 0,
            ayuda: 'Una orden la trabaja un solo mecánico: debe quedar registrado antes de empezar.',
          },
        ];

      case EstadoOrden.EnProceso:
        return [
          {
            etiqueta: 'Cargar los servicios ejecutados',
            cumplido: orden.servicios.length > 0,
            ayuda: 'Sin servicios la orden no cobra nada ni genera comisiones.',
          },
          ...(orden.servicios.some((s) => s.requiereRepuesto)
            ? [
                {
                  etiqueta: 'Registrar el repuesto de los servicios que lo usan',
                  cumplido: this.serviciosSinRepuesto().length === 0,
                  ayuda: 'Un cambio de aceite o de batería no se completa sin su repuesto registrado.',
                },
              ]
            : []),
          {
            etiqueta: 'Completar todos los servicios',
            cumplido: orden.servicios.length > 0 && this.serviciosPendientes() === 0,
            ayuda: 'Marque cada servicio como Completado a medida que termine, uno a la vez.',
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

  // --- Cabecera: avance y siguiente paso --------------------------------------

  /** Menú "Más" de la cabecera: fotos, estado del vehículo, corregir o cancelar. */
  protected readonly menuMas = signal(false);

  protected alHacerClic(evento: MouseEvent): void {
    if (!(evento.target as HTMLElement | null)?.closest('.menu-mas')) this.menuMas.set(false);
  }

  /** Avance en cinco pasos; el último, Cobrada, sale de la proforma saldada. */
  protected readonly etapas = computed(() => {
    const estado = this.orden()?.estado ?? EstadoOrden.Abierta;
    const cobrada = !!this.proformaVigente()?.estaSaldada;
    const actual =
      estado === EstadoOrden.Cancelada ? -1 : estado === EstadoOrden.Cerrada ? (cobrada ? 5 : 4) : estado;

    return ['Abierta', 'En proceso', 'Finalizada', 'Cerrada', 'Cobrada'].map((nombre, i) => ({
      nombre,
      estado: i < actual ? 'hecho' : i === actual ? 'actual' : '',
    }));
  });

  protected textoEstado(estado: EstadoOrden): string {
    return ['En espera', 'En proceso', 'Finalizada', 'Cerrada', 'Cancelada'][estado] ?? '';
  }

  protected readonly serviciosCompletados = computed(
    () => this.orden()?.servicios.filter((s) => s.estado === EstadoServicioOrden.Completado).length ?? 0,
  );

  /** Nombres de los mecánicos de la orden, para la línea de la cabecera. */
  protected readonly nombresMecanicos = computed(() =>
    (this.orden()?.mecanicos ?? []).map((m) => m.nombreMecanico).join(', '),
  );

  /** Foto del repuesto del inventario, si la tiene. */
  protected fotoRepuesto(consumo: OrdenRepuesto): string | null {
    if (!consumo.repuestoId) return null;
    return this.repuestos().find((r) => r.repuestoId === consumo.repuestoId)?.fotoUrl ?? null;
  }

  /** "Compatible" o "Uso general" según la clasificación para este vehículo. */
  protected compatibilidadDe(consumo: OrdenRepuesto): 'Compatible' | 'Uso general' | null {
    if (!consumo.repuestoId) return null;
    const nivel = this.clasificacionRepuestos()?.find((c) => c.repuesto.repuestoId === consumo.repuestoId)?.nivel;
    if (nivel === NivelCompatibilidad.Compatible) return 'Compatible';
    if (nivel === NivelCompatibilidad.Universal) return 'Uso general';
    return null;
  }

  // --- Estado del vehículo (columna lateral) ---------------------------------

  protected readonly kilometrajeVehiculo = signal<number | null>(null);
  protected readonly etiquetaZona = etiquetaZona;

  /** Las zonas marcadas con algo (la última marca de cada una que no esté "Bien"). */
  protected readonly zonasMarcadas = computed(() => {
    const ultimas = new Map<string, VehiculoZona>();
    for (const z of [...this.zonasVehiculo()].sort((a, b) => b.fechaRegistro.localeCompare(a.fechaRegistro))) {
      if (!ultimas.has(z.zona)) ultimas.set(z.zona, z);
    }
    return [...ultimas.values()].filter((z) => z.estado !== 'Ok');
  });

  protected textoZona(estado: string): string {
    return estado === 'Atencion' ? 'Atención' : estado === 'EnReparacion' ? 'En reparación' : 'Bien';
  }

  /** El historial se muestra corto; el resto, a pedido. */
  protected readonly verTodoHistorial = signal(false);
  protected readonly historialVisible = computed(() =>
    this.verTodoHistorial() ? this.historial() : this.historial().slice(0, 5),
  );

  protected readonly estiloOrden = estiloOrden;

  /**
   * Lo único que hay que hacer ahora con la orden, con su botón. Reemplaza a
   * la lista de requisitos: en vez de leer qué falta, se ve la próxima acción.
   */
  protected readonly siguientePaso = computed<SiguientePaso | null>(() => {
    const o = this.orden();
    if (!o) return null;
    const admin = this.puedeGestionar();

    switch (o.estado) {
      case EstadoOrden.Cancelada:
        return { tipo: 'cancelada', titulo: 'Orden cancelada', detalle: 'No se puede reabrir ni cobrar.' };

      case EstadoOrden.Abierta:
        if (o.mecanicos.length === 0) {
          return admin
            ? {
                tipo: 'asignar',
                titulo: 'Asignar el mecánico de la orden',
                detalle: 'Una orden la trabaja un solo mecánico: debe quedar registrado antes de empezar.',
              }
            : { tipo: 'esperar', titulo: 'Falta asignar el mecánico', detalle: 'Lo asigna el Administrador.' };
        }
        return admin
          ? {
              tipo: 'iniciar',
              titulo: 'Iniciar el trabajo',
              detalle: 'Con el trabajo iniciado se cargan los servicios y los repuestos.',
            }
          : { tipo: 'esperar', titulo: 'Esperando que se inicie el trabajo', detalle: 'El Administrador inicia el trabajo.' };

      case EstadoOrden.EnProceso:
        return this.pasoDelTrabajo(o, 'finalizar');

      case EstadoOrden.Finalizada:
        if (this.serviciosPendientes() > 0) return this.pasoDelTrabajo(o, 'cerrar');
        return admin
          ? {
              tipo: 'cerrar',
              titulo: 'Cerrar la orden',
              detalle: 'Al cerrarla se descuenta el stock de los repuestos y se calculan las comisiones.',
            }
          : { tipo: 'esperar', titulo: 'Trabajo terminado', detalle: 'El Administrador cierra la orden y la cobra.' };

      default: {
        const bs = new BolivianosPipe();
        const f = this.proformaVigente();
        if (!admin) return { tipo: 'listo', titulo: 'Orden cerrada', detalle: 'El trabajo quedó registrado.' };
        if (!f) {
          return o.total > 0
            ? { tipo: 'emitir', titulo: 'Emitir la proforma para cobrar', detalle: `Total de la orden: ${bs.transform(o.total)}.` }
            : { tipo: 'listo', titulo: 'Orden cerrada', detalle: 'No hay monto que cobrar.' };
        }
        if (!f.estaSaldada) {
          return {
            tipo: 'cobrar',
            titulo: `Cobrar el saldo de ${bs.transform(f.saldoPendiente)}`,
            detalle: `Proforma ${f.proformaId} · cobrado ${bs.transform(f.totalPagado)} de ${bs.transform(f.total)}.`,
          };
        }
        return { tipo: 'listo', titulo: 'Orden cobrada', detalle: `Proforma ${f.proformaId} pagada por completo.` };
      }
    }
  });

  private pasoDelTrabajo(o: OrdenDetalleModel, final: 'finalizar' | 'cerrar'): SiguientePaso {
    if (o.servicios.length === 0) {
      return {
        tipo: 'agregarServicio',
        titulo: 'Cargar los servicios que se harán',
        detalle: 'Sin servicios la orden no cobra nada ni genera comisiones.',
      };
    }

    const sinRepuesto = this.serviciosSinRepuesto()[0];
    if (sinRepuesto) {
      return {
        tipo: 'registrarRepuesto',
        titulo: `Registrar el repuesto de ${sinRepuesto.nombreServicio}`,
        detalle: 'Un servicio que usa repuestos no se completa sin el suyo registrado.',
        servicio: sinRepuesto,
      };
    }

    const pendientes = o.servicios.filter((s) => s.estado !== EstadoServicioOrden.Completado);
    const boton = final === 'finalizar' ? 'Finalizar trabajo' : 'Cerrar orden';
    if (pendientes.length === 1) {
      return {
        tipo: 'completar',
        titulo: `Completar el servicio ${pendientes[0].nombreServicio} para poder ${final}`,
        detalle: `Es el único servicio pendiente. Al completarlo se habilita ${boton}.`,
        servicio: pendientes[0],
      };
    }
    if (pendientes.length > 1) {
      return {
        tipo: 'completar',
        titulo: `Completar los ${pendientes.length} servicios pendientes para poder ${final}`,
        detalle: 'Marque cada servicio como completado a medida que termine, uno a la vez.',
      };
    }
    return { tipo: 'finalizar', titulo: 'Finalizar el trabajo', detalle: 'Todos los servicios están completos.' };
  }

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

  /**
   * Una orden la trabaja un solo mecánico: con uno ya asignado, sumar otro es
   * una excepción que pide motivo (y queda en Auditoría).
   */
  protected readonly asignarEsExcepcion = computed(() => (this.orden()?.mecanicos.length ?? 0) > 0);

  /** Repuestos registrados para un servicio de la orden. */
  protected repuestosDe(servicio: OrdenServicio): OrdenRepuesto[] {
    return this.orden()?.repuestos.filter((r) => r.ordenServicioId === servicio.ordenServicioId) ?? [];
  }

  /** "Aceite 10w40 × 4, Filtro × 1": lo que se usó en el servicio. */
  protected resumenRepuestosDe(servicio: OrdenServicio): string {
    return this.repuestosDe(servicio)
      .map((r) => `${r.nombreRepuesto} × ${r.cantidad}`)
      .join(', ');
  }

  /** Servicios que usan repuestos, sin completar y todavía sin ninguno registrado. */
  protected readonly serviciosSinRepuesto = computed(
    () =>
      this.orden()?.servicios.filter(
        (s) =>
          s.requiereRepuesto &&
          s.estado !== EstadoServicioOrden.Completado &&
          this.repuestosDe(s).length === 0,
      ) ?? [],
  );

  /** Para elegir a qué servicio corresponde el repuesto que se agrega. */
  protected readonly opcionesServicioRepuesto = computed<OpcionSelector[]>(
    () =>
      this.orden()?.servicios.map((s) => ({
        valor: s.ordenServicioId,
        etiqueta: s.nombreServicio,
        detalle: s.requiereRepuesto
          ? this.repuestosDe(s).length > 0
            ? 'usa repuestos'
            : 'falta su repuesto'
          : ETIQUETAS.estadoServicioOrden[s.estado],
      })) ?? [],
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

  /** Con el precio va lo que incluye el servicio (Catálogo), para elegir el correcto. */
  protected readonly opcionesCatalogo = computed<OpcionSelector[]>(() =>
    this.catalogo().map((s) => {
      const incluye = s.descripcion?.trim();
      const precio = new BolivianosPipe().transform(s.precioBase);
      return {
        valor: s.servicioId,
        etiqueta: s.nombre,
        detalle: incluye ? `${precio} · ${recortar(incluye, 90)}` : precio,
      };
    }),
  );

  /**
   * Repuestos clasificados para el vehículo de la orden (compatibles,
   * universales, no indicados). Mientras no llega, o si falla, el selector
   * cae a la lista simple del inventario.
   */
  protected readonly clasificacionRepuestos = signal<RepuestoParaVehiculo[] | null>(null);

  /** Repuesto no indicado para este vehículo que espera confirmación para agregarse. */
  protected readonly avisoRepuestoIncompatible = signal<RepuestoParaVehiculo | null>(null);

  /**
   * Servicio de la orden elegido en "Para el servicio" del panel de repuesto.
   * Es un signal (y no solo el ngModel) para que la lista de repuestos se
   * reordene en cuanto cambia.
   */
  protected readonly servicioRepuesto = signal('');

  protected readonly servicioDelRepuesto = computed(
    () => this.orden()?.servicios.find((s) => s.ordenServicioId === this.servicioRepuesto()) ?? null,
  );

  /** "Bujías" o "Aceite de motor, Filtro de aceite". */
  protected llevaDe(servicio: OrdenServicio): string {
    return servicio.categorias.map((c) => c.nombre).join(', ');
  }

  private encaje(repuesto: Repuesto, servicio: OrdenServicio | null): EncajeCategoria {
    if (!servicio || servicio.categorias.length === 0 || !repuesto.categoriaId) return 'libre';
    return servicio.categorias.some((c) => c.categoriaId === repuesto.categoriaId)
      ? 'corresponde'
      : 'otra';
  }

  protected readonly opcionesRepuesto = computed<OpcionSelector[]>(() => {
    const servicio = this.servicioDelRepuesto();
    const esAdministrador = this.auth.esAdministrador();

    // Ya vienen ordenados: compatibles, universales y al final los no indicados.
    const base =
      this.clasificacionRepuestos()?.map(({ repuesto, nivel }) => ({
        repuesto,
        nivel: nivel as NivelCompatibilidad | null,
      })) ??
      this.repuestos().map((repuesto) => ({ repuesto, nivel: null as NivelCompatibilidad | null }));

    // Con un servicio que lleva categorías, arriba van los que le corresponden
    // y al final los de otra categoría. El orden anterior se respeta dentro de
    // cada grupo (sort es estable).
    const peso: Record<EncajeCategoria, number> = { corresponde: 0, libre: 1, otra: 2 };
    const conEncaje = base.map((o) => ({ ...o, encaje: this.encaje(o.repuesto, servicio) }));
    if (servicio && servicio.categorias.length > 0) conEncaje.sort((a, b) => peso[a.encaje] - peso[b.encaje]);

    const controla = !!servicio && servicio.categorias.length > 0;

    return conEncaje.map(({ repuesto: r, encaje, nivel }) => {
      const otra = encaje === 'otra';
      const marcas: MarcaOpcion[] = [];

      // 1. Si sirve para el servicio elegido (solo si el servicio lleva categorías).
      if (encaje === 'corresponde') marcas.push({ texto: '✓ Para este servicio', tono: 'verde' });
      else if (otra) marcas.push({ texto: `✖ No corresponde: es ${r.nombreCategoria}`, tono: 'roja' });
      else if (controla && !r.categoriaId) marcas.push({ texto: 'Sin categoría', tono: 'gris' });
      // Sin servicio que controle, la categoría igual orienta: "Aceite de motor".
      if (!controla && r.nombreCategoria) marcas.push({ texto: r.nombreCategoria, tono: 'azul' });

      // 2. Si calza en el vehículo de la orden.
      if (nivel === NivelCompatibilidad.Compatible) marcas.push({ texto: '✓ Compatible con el vehículo', tono: 'verde' });
      else if (nivel === NivelCompatibilidad.NoIndicado) marcas.push({ texto: '⚠ No indicado para este vehículo', tono: 'naranja' });
      else if (nivel === NivelCompatibilidad.Universal) marcas.push({ texto: 'Uso general', tono: 'gris' });

      // 3. Cuánto queda.
      if (r.stockActual === 0) marcas.push({ texto: 'Sin stock', tono: 'roja' });
      else if (r.stockBajo) marcas.push({ texto: `Stock bajo: ${r.stockActual}`, tono: 'naranja' });
      else marcas.push({ texto: `Stock: ${r.stockActual}`, tono: 'gris' });

      return {
        valor: r.repuestoId,
        etiqueta: r.nombre,
        miniatura: { url: r.fotoUrl ? urlArchivo(r.fotoUrl) : null },
        marcas,
        detalle: new BolivianosPipe().transform(r.precioVenta),
        // El mecánico no puede registrar un repuesto de otra categoría; el
        // Administrador sí, escribiendo el motivo (se le pide al agregar).
        deshabilitada: r.stockActual === 0 || (otra && !esAdministrador),
        razonDeshabilitada:
          r.stockActual === 0
            ? 'Sin stock disponible'
            : `“${servicio?.nombreServicio}” lleva ${servicio ? this.llevaDe(servicio) : ''}. Solo el Administrador puede registrar otra categoría.`,
      };
    });
  });

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
      .subscribe((descripciones) => this.descripcionesRepuestoLibreSugeridas.set(descripciones));

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
        this.cargarHistorial(orden.ordenId);

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
            this.kilometrajeVehiculo.set(vehiculo.kilometraje ?? null);
            this.tipoCarroceriaVehiculo.set(vehiculo.tipoCarroceria);
            this.diagramaSvgUrlVehiculo.set(vehiculo.diagramaSvgUrl ?? null);
          });

        // Repuestos ordenados por compatibilidad con este vehículo.
        this.repuestosService
          .paraVehiculo(orden.vehiculoId)
          .pipe(catchError(() => of(null)))
          .subscribe((clasificados) => this.clasificacionRepuestos.set(clasificados));

        this.vehiculosService
          .getZonas(orden.vehiculoId)
          .pipe(catchError(() => of([] as VehiculoZona[])))
          .subscribe((zonas) => this.zonasVehiculo.set(zonas));

        // Estado de cobro: se consulta la proforma de la orden si existe. Es
        // una carga secundaria; si falla, el Resumen simplemente no muestra el
        // badge de cobro en vez de romper la vista.
        // Las proformas son del Administrador: al mecánico la API le responde 403.
        if (this.auth.esAdministrador()) {
          this.proformasService
            .getAll({ ordenId: id })
            .pipe(
              map((resultado) => resultado.items[0] ?? null),
              catchError(() => of(null)),
            )
            .subscribe((proforma) => this.proforma.set(proforma));
        }

        // Diagnóstico asistido: solo tiene sentido mientras se puede seguir
        // agregando servicios/repuestos (orden abierta/en proceso).
        const editable = orden.estado === EstadoOrden.Abierta || orden.estado === EstadoOrden.EnProceso;

        if (DIAGNOSTICO_ASISTIDO && orden.diagnosticoId && editable) {
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

  /** Lo registrado en Auditoría sobre esta orden, del más reciente al más antiguo. */
  private cargarHistorial(ordenId: string): void {
    if (!this.auth.esAdministrador()) return;

    this.auditoriaService
      .getAll({ entidad: 'Orden', entidadId: ordenId, pagina: 1, tamanoPagina: 30 })
      .pipe(catchError(() => of(null)))
      .subscribe((resultado) => this.historial.set(resultado?.items ?? []));
  }

  /** Todas las operaciones del detalle devuelven la orden completa actualizada. */
  /**
   * @param alExito lo que se limpia solo si el servidor aceptó: ante un error
   *   (stock insuficiente, por ejemplo) el formulario conserva lo cargado.
   */
  private aplicar(mensaje: string, alExito?: () => void) {
    return {
      next: (orden: OrdenDetalleModel) => {
        alExito?.();
        this.orden.set(orden);
        this.cargarHistorial(orden.ordenId);
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
        this.cargarHistorial(orden.ordenId);
        this.notificacion.deshacer(mensaje, revertir);
        this.procesando.set(false);
        this.cerrarPaneles();
        this.contadores.refrescar();
      },
      error: () => this.procesando.set(false),
    };
  }

  private cerrarPaneles(): void {
    this.panelCorregir.set(false);
    this.editandoServicio.set(null);
    this.editandoRepuesto.set(null);
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
      .subscribe(this.aplicar('Orden finalizada. Ya se puede cerrar y emitir la proforma.'));
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

  // --- Corrección (solo Administrador) ----------------------------------------

  /** Proforma vigente (no anulada) de la orden, si la hay. */
  protected readonly proformaVigente = computed(() => {
    const f = this.proforma();
    return f && f.estado === EstadoProforma.Emitida ? f : null;
  });

  protected abrirCorregir(): void {
    this.panelCorregir.set(true);
  }

  /** Tras revertir pagos desde Corregir orden: el saldo de la proforma cambió. */
  protected recargarProforma(ordenId: string): void {
    this.proformasService
      .getAll({ ordenId })
      .pipe(
        map((resultado) => resultado.items[0] ?? null),
        catchError(() => of(null)),
      )
      .subscribe((proforma) => this.proforma.set(proforma));
  }

  protected corregirOrden(motivoEscrito: string): void {
    const motivo = motivoEscrito.trim();
    if (!motivo) {
      this.notificacion.advertencia('Escriba el motivo de la corrección.');
      return;
    }

    this.procesando.set(true);
    this.servicio.corregir(this.id(), motivo).subscribe({
      next: (orden) => {
        this.aplicar('Orden reabierta: corrija lo necesario y vuelva a finalizarla.').next(orden);
        // La proforma pudo quedar anulada: se vuelve a consultar el estado de cobro.
        this.proformasService
          .getAll({ ordenId: orden.ordenId })
          .pipe(
            map((resultado) => resultado.items[0] ?? null),
            catchError(() => of(null)),
          )
          .subscribe((proforma) => this.proforma.set(proforma));
      },
      error: () => this.procesando.set(false),
    });
  }

  protected abrirEditarServicio(servicio: OrdenServicio): void {
    this.edicion = { ...this.edicion, precio: servicio.precio, descripcion: servicio.descripcion ?? '' };
    this.editandoServicio.set(servicio);
  }

  protected guardarServicioEditado(): void {
    const servicio = this.editandoServicio();
    if (!servicio) return;

    if (this.edicion.precio == null || this.edicion.precio < 0) {
      this.notificacion.advertencia('Indique un precio válido.');
      return;
    }

    this.procesando.set(true);
    this.servicio
      .editarServicio(this.id(), servicio.ordenServicioId, {
        precio: this.edicion.precio,
        descripcion: this.edicion.descripcion.trim() || null,
      })
      .subscribe(this.aplicar('Servicio corregido.'));
  }

  protected abrirEditarRepuesto(repuesto: OrdenRepuesto): void {
    this.edicion = {
      ...this.edicion,
      cantidad: repuesto.cantidad,
      precioUnitario: repuesto.precioUnitario,
    };
    this.editandoRepuesto.set(repuesto);
  }

  protected guardarRepuestoEditado(): void {
    const repuesto = this.editandoRepuesto();
    if (!repuesto) return;

    if (!this.edicion.cantidad || this.edicion.cantidad < 1) {
      this.notificacion.advertencia('Indique una cantidad válida.');
      return;
    }

    this.procesando.set(true);
    this.servicio
      .editarRepuesto(this.id(), repuesto.ordenRepuestoId, {
        cantidad: this.edicion.cantidad,
        // El precio lo corrige solo el Administrador (el backend lo ignora si no).
        precioUnitario: this.puedeGestionar() ? this.edicion.precioUnitario : null,
      })
      .subscribe(this.aplicar('Repuesto corregido.'));
  }

  // --- Mecánicos (USU022) --------------------------------------------------

  protected abrirPanelMecanico(): void {
    this.mecanicoSeleccionado = '';
    this.motivoExcepcionMecanico = '';
    this.panelMecanico.set(true);
  }

  protected asignarMecanico(): void {
    if (!this.mecanicoSeleccionado) return;

    const excepcion = this.asignarEsExcepcion();
    const motivo = this.motivoExcepcionMecanico.trim();

    if (excepcion && !motivo) {
      this.notificacion.advertencia('Escriba el motivo de la excepción para sumar otro mecánico.');
      return;
    }

    // Se capturan antes de limpiar la selección, para el aviso posterior.
    const mecanicoId = this.mecanicoSeleccionado;
    const nombre =
      this.mecanicos().find((m) => m.usuarioId === mecanicoId)?.nombreCompleto ?? 'El mecánico';
    const sinComision = this.sinComisionConfigurada(mecanicoId);

    this.procesando.set(true);

    const aplicar = this.aplicar(
      excepcion
        ? 'Mecánico asignado como excepción: quedó registrado en Auditoría.'
        : 'Mecánico asignado.',
    );
    this.servicio.asignarMecanico(this.id(), mecanicoId, excepcion ? motivo : null).subscribe({
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
    this.motivoExcepcionMecanico = '';
  }

  protected quitarMecanico(mecanicoId: string): void {
    this.procesando.set(true);

    this.servicio.quitarMecanico(this.id(), mecanicoId).subscribe(
      this.aplicarConDeshacer('Mecánico desasignado.', () => {
        this.procesando.set(true);
        // Si la orden quedó con otro mecánico, restaurar es volver a la
        // excepción que ya existía: el backend pide motivo igual.
        const quedanOtros = (this.orden()?.mecanicos.length ?? 0) > 0;
        this.servicio
          .asignarMecanico(this.id(), mecanicoId, quedanOtros ? 'Se deshizo la desasignación.' : null)
          .subscribe(this.aplicar('Se restauró la asignación del mecánico.'));
      }),
    );
  }

  // --- Servicios (USU023) --------------------------------------------------

  private servicioVacio() {
    return {
      delCatalogo: true,
      servicioId: '',
      nombreLibre: '',
      mecanicoId: '',
      descripcion: '',
      precio: null as number | null,
      /** Solo fuera de catálogo; los del catálogo traen su propia marca. */
      requiereRepuesto: false,
      /** Si el Administrador tocó la casilla, ya no se la propone según el nombre. */
      requiereRepuestoTocado: false,
    };
  }

  /** Servicio del catálogo elegido en el panel, para avisar si usa repuestos. */
  protected servicioCatalogoElegido(): TipoServicio | null {
    return this.catalogo().find((s) => s.servicioId === this.nuevoServicio.servicioId) ?? null;
  }

  /** Mientras se escribe el nombre libre, propone la marca "usa repuestos". */
  protected onNombreLibreCambiado(nombre: string): void {
    if (this.nuevoServicio.requiereRepuestoTocado) return;
    this.nuevoServicio.requiereRepuesto = repuestoSugeridoPara(nombre) !== null;
  }

  protected onRequiereRepuestoCambiado(valor: boolean): void {
    this.nuevoServicio.requiereRepuesto = valor;
    this.nuevoServicio.requiereRepuestoTocado = true;
  }

  /** Diagnóstico asistido: abre el panel de servicio con la sugerencia ya cargada. */
  protected abrirPanelServicioSugerido(sugerencia: SugerenciaServicio): void {
    this.abrirPanelServicio();
    this.nuevoServicio.delCatalogo = !!sugerencia.servicioId;
    this.nuevoServicio.servicioId = sugerencia.servicioId ?? '';
    this.nuevoServicio.nombreLibre = sugerencia.servicioId ? '' : sugerencia.nombre;
    this.nuevoServicio.precio = sugerencia.precioPromedio;
    if (!sugerencia.servicioId) this.onNombreLibreCambiado(sugerencia.nombre);
  }

  /** Diagnóstico asistido: abre el panel de repuesto con la sugerencia ya cargada. */
  protected abrirPanelRepuestoSugerido(sugerencia: SugerenciaRepuesto): void {
    this.abrirPanelRepuesto();
    this.nuevoRepuesto.origen = sugerencia.repuestoId
      ? OrigenRepuesto.Inventario
      : OrigenRepuesto.CompraExterna;
    this.nuevoRepuesto.repuestoId = sugerencia.repuestoId ?? '';
    this.nuevoRepuesto.descripcion = sugerencia.repuestoId ? '' : sugerencia.nombre;
    this.nuevoRepuesto.precioUnitario = sugerencia.precioUnitarioPromedio;
  }

  /**
   * El servicio lo ejecuta el mecánico de la orden: se lo preselecciona y no
   * hay que elegirlo. Solo si la orden tiene más de uno (excepción) aparece el
   * selector para indicar cuál hizo el trabajo.
   */
  protected abrirPanelServicio(): void {
    const asignados = this.orden()?.mecanicos ?? [];

    this.nuevoServicio = this.servicioVacio();
    this.nuevoServicio.mecanicoId = asignados.length === 1 ? asignados[0].mecanicoId : '';
    this.buscarServicio.set('');
    this.filtroServicios.set('todos');
    this.ultimoAgregado.set(null);
    this.servicioLibre.set(false);

    this.panelServicio.set(true);
  }

  /** Al cambiar el origen se limpian los campos que dejan de aplicar. */
  protected cambiarOrigenServicio(delCatalogo: boolean): void {
    this.nuevoServicio.delCatalogo = delCatalogo;
    this.nuevoServicio.servicioId = '';
    this.nuevoServicio.nombreLibre = '';
    this.nuevoServicio.precio = null;
    this.nuevoServicio.requiereRepuesto = false;
    this.nuevoServicio.requiereRepuestoTocado = false;
  }

  protected onServicioSeleccionado(servicioId: string): void {
    // Propone el precio base del catálogo; el usuario puede ajustarlo.
    const servicio = this.catalogo().find((s) => s.servicioId === servicioId);
    this.nuevoServicio.precio = servicio?.precioBase ?? null;
  }

  protected agregarServicio(): void {
    const { delCatalogo, servicioId, nombreLibre, mecanicoId, descripcion, precio, requiereRepuesto } =
      this.nuevoServicio;

    // Con un solo mecánico en la orden ya viene elegido; solo hay que
    // indicarlo cuando la orden tiene más de uno (excepción).
    if (this.puedeGestionar() && !mecanicoId && (this.orden()?.mecanicos.length ?? 0) > 1) {
      this.notificacion.advertencia('Indique cuál de los mecánicos ejecuta el servicio.');
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
        // El backend asigna al mecánico su propio servicio; solo el Administrador elige.
        mecanicoId: this.puedeGestionar() ? mecanicoId || null : null,
        descripcion: descripcion || null,
        precio,
        requiereRepuesto: delCatalogo ? null : requiereRepuesto,
      })
      .subscribe(
        this.aplicar('Servicio agregado a la orden.', () => {
          this.nuevoServicio = this.servicioVacio();
        }),
      );
  }

  /**
   * Servicio que se intentó completar sin su repuesto registrado. El diálogo
   * lleva a registrarlo; el Administrador también puede completarlo igual con
   * un motivo, que queda en Auditoría.
   */
  protected readonly faltaRepuesto = signal<OrdenServicio | null>(null);
  protected readonly mostrarExcepcionRepuesto = signal(false);
  protected motivoSinRepuesto = '';

  /**
   * Mismas reglas que el backend, para avisar antes de enviar:
   * un mecánico trabaja un servicio a la vez, y un servicio que usa repuestos
   * no se completa sin registrar el que se usó.
   */
  protected avanzarServicio(ordenServicioId: string, estado: EstadoServicioOrden): void {
    const servicio = this.orden()?.servicios.find((s) => s.ordenServicioId === ordenServicioId);
    if (!servicio) return;

    const arranca =
      estado === EstadoServicioOrden.EnProceso ||
      (estado === EstadoServicioOrden.Completado && servicio.estado === EstadoServicioOrden.Pendiente);

    if (arranca) {
      const enCurso = this.orden()?.servicios.find(
        (s) =>
          s.ordenServicioId !== ordenServicioId &&
          s.mecanicoId === servicio.mecanicoId &&
          s.estado === EstadoServicioOrden.EnProceso,
      );

      if (enCurso) {
        this.notificacion.advertencia(
          `Primero termine “${enCurso.nombreServicio}”, que está en proceso. Recién después puede ` +
            `${estado === EstadoServicioOrden.EnProceso ? 'iniciar' : 'completar'} “${servicio.nombreServicio}”.`,
        );
        return;
      }
    }

    if (
      estado === EstadoServicioOrden.Completado &&
      servicio.requiereRepuesto &&
      this.repuestosDe(servicio).length === 0
    ) {
      this.motivoSinRepuesto = '';
      this.mostrarExcepcionRepuesto.set(false);
      this.faltaRepuesto.set(servicio);
      return;
    }

    this.procesando.set(true);
    this.servicio
      .cambiarEstadoServicio(this.id(), ordenServicioId, estado)
      .subscribe(this.aplicar('Estado del servicio actualizado.'));
  }

  /** Desde el aviso: abre el panel de repuesto ya apuntando a ese servicio. */
  protected registrarRepuestoPara(servicio: OrdenServicio): void {
    this.faltaRepuesto.set(null);
    this.abrirPanelRepuesto(servicio);
  }

  /** Excepción del Administrador: completar sin repuesto, con motivo. */
  protected completarSinRepuesto(servicio: OrdenServicio): void {
    const motivo = this.motivoSinRepuesto.trim();

    if (!motivo) {
      this.notificacion.advertencia('Escriba el motivo para completar el servicio sin repuesto.');
      return;
    }

    this.procesando.set(true);
    this.servicio
      .cambiarEstadoServicio(this.id(), servicio.ordenServicioId, EstadoServicioOrden.Completado, motivo)
      .subscribe({
        next: (orden) => {
          this.faltaRepuesto.set(null);
          this.aplicar('Servicio completado como excepción: quedó registrado en Auditoría.').next(orden);
        },
        error: () => this.procesando.set(false),
      });
  }

  protected quitarServicio(servicio: OrdenServicio): void {
    this.procesando.set(true);

    this.servicio.quitarServicio(this.id(), servicio.ordenServicioId).subscribe(
      this.aplicarConDeshacer(`Se quitó “${servicio.nombreServicio}” de la orden.`, () => {
        this.procesando.set(true);
        this.servicio
          .agregarServicio(this.id(), {
            servicioId: servicio.servicioId ?? null,
            nombreLibre: servicio.servicioId ? null : servicio.nombreServicio,
            mecanicoId: servicio.mecanicoId,
            diagnosticoId: servicio.diagnosticoId ?? null,
            descripcion: servicio.descripcion ?? null,
            precio: servicio.precio,
            requiereRepuesto: servicio.servicioId ? null : servicio.requiereRepuesto,
          })
          .subscribe(this.aplicar('Servicio restaurado en la orden.'));
      }),
    );
  }

  // --- Repuestos -----------------------------------------------------------

  private repuestoVacio() {
    return {
      origen: OrigenRepuesto.Inventario,
      repuestoId: '',
      descripcion: '',
      cantidad: 1,
      precioUnitario: null as number | null,
      /** Servicio de la orden para el que se usa (vacío = ninguno en particular). */
      ordenServicioId: '',
    };
  }

  /**
   * Abre el panel de repuesto. Si se llega desde un servicio, queda asociado a
   * él; si no, se propone el único servicio que todavía espera su repuesto.
   */
  protected abrirPanelRepuesto(servicio?: OrdenServicio): void {
    const pendientes = this.serviciosSinRepuesto();

    this.nuevoRepuesto = this.repuestoVacio();
    this.nuevoRepuesto.ordenServicioId =
      servicio?.ordenServicioId ?? (pendientes.length === 1 ? pendientes[0].ordenServicioId : '');
    this.servicioRepuesto.set(this.nuevoRepuesto.ordenServicioId);
    this.motivoCategoria = '';
    this.buscarRepuesto.set('');

    this.panelRepuesto.set(true);
  }

  /** El repuesto elegido en el panel, para mostrar su ficha con foto. */
  protected repuestoElegido(): Repuesto | null {
    const id = this.nuevoRepuesto.repuestoId;
    if (!id) return null;
    return (
      this.repuestos().find((r) => r.repuestoId === id) ??
      this.clasificacionRepuestos()?.find((c) => c.repuesto.repuestoId === id)?.repuesto ??
      null
    );
  }

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

  /** Repuesto de otra categoría que espera el motivo del Administrador. */
  protected readonly excepcionCategoria = signal<ExcepcionCategoria | null>(null);
  /** Motivo de esa excepción; se manda con el repuesto y queda en auditoría. */
  protected motivoCategoria = '';

  protected confirmarExcepcionCategoria(): void {
    if (!this.motivoCategoria.trim()) {
      this.notificacion.advertencia('Escriba por qué se registra este repuesto para este servicio.');
      return;
    }
    this.excepcionCategoria.set(null);
    this.agregarRepuesto();
  }

  protected cancelarExcepcionCategoria(): void {
    this.excepcionCategoria.set(null);
    this.motivoCategoria = '';
  }

  /**
   * @param confirmadoIncompatible true cuando el usuario ya aceptó el aviso de
   *   que el repuesto no está indicado para este vehículo.
   */
  protected agregarRepuesto(confirmadoIncompatible = false): void {
    const { origen, repuestoId, descripcion, cantidad, precioUnitario, ordenServicioId } =
      this.nuevoRepuesto;

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

    // Un repuesto de otra categoría que la del servicio (aceite para "Cambio
    // de bujías"): el mecánico no puede; el Administrador, con motivo.
    const servicio = this.orden()?.servicios.find((s) => s.ordenServicioId === ordenServicioId) ?? null;
    const elegido = this.repuestos().find((r) => r.repuestoId === repuestoId)
      ?? this.clasificacionRepuestos()?.find((c) => c.repuesto.repuestoId === repuestoId)?.repuesto;
    const deOtraCategoria =
      origen === OrigenRepuesto.Inventario && !!elegido && this.encaje(elegido, servicio) === 'otra';

    if (deOtraCategoria && servicio && elegido) {
      if (!this.auth.esAdministrador()) {
        this.notificacion.advertencia(
          `“${servicio.nombreServicio}” lleva ${this.llevaDe(servicio)}: “${elegido.nombre}” no corresponde. Elija el repuesto correcto o regístrelo para otro servicio.`,
        );
        return;
      }
      if (!this.motivoCategoria.trim()) {
        this.excepcionCategoria.set({
          repuesto: elegido.nombre,
          servicio: servicio.nombreServicio,
          lleva: this.llevaDe(servicio),
        });
        return;
      }
    }

    // No se bloquea: los datos de compatibilidad pueden estar incompletos o el
    // mecánico saber que sirve. Solo se pide confirmar antes de agregarlo.
    if (origen === OrigenRepuesto.Inventario && !confirmadoIncompatible) {
      const clasificado = this.clasificacionRepuestos()?.find(
        (c) => c.repuesto.repuestoId === repuestoId,
      );
      if (clasificado?.nivel === NivelCompatibilidad.NoIndicado) {
        this.avisoRepuestoIncompatible.set(clasificado);
        return;
      }
    }

    this.avisoRepuestoIncompatible.set(null);
    this.procesando.set(true);

    this.servicio
      .agregarRepuesto(this.id(), {
        origen,
        repuestoId: origen === OrigenRepuesto.Inventario ? repuestoId : null,
        descripcion: origen === OrigenRepuesto.Inventario ? null : descripcion.trim(),
        cantidad,
        // El que trae el cliente va sin cargo; la compra externa a su costo.
        precioUnitario: origen === OrigenRepuesto.ClienteTrae ? 0 : precioUnitario,
        ordenServicioId: ordenServicioId || null,
        motivoCategoria: deOtraCategoria ? this.motivoCategoria.trim() : null,
      })
      .subscribe(
        this.aplicar(this.mensajeRepuestoAgregado(ordenServicioId), () => {
          this.nuevoRepuesto = this.repuestoVacio();
          this.servicioRepuesto.set('');
          this.motivoCategoria = '';
        }),
      );
  }

  /** Si el repuesto destraba un servicio, el aviso dice que ya se puede completar. */
  private mensajeRepuestoAgregado(ordenServicioId: string): string {
    const servicio = this.orden()?.servicios.find((s) => s.ordenServicioId === ordenServicioId);

    return servicio?.requiereRepuesto && servicio.estado !== EstadoServicioOrden.Completado
      ? `Repuesto registrado para “${servicio.nombreServicio}”. Ya se puede completar el servicio.`
      : 'Repuesto agregado a la orden.';
  }

  protected quitarRepuesto(consumo: OrdenRepuesto): void {
    this.procesando.set(true);

    this.servicio.quitarRepuesto(this.id(), consumo.ordenRepuestoId).subscribe(
      this.aplicarConDeshacer(`Se quitó “${consumo.nombreRepuesto}” de la orden.`, () => {
        this.procesando.set(true);
        this.servicio
          .agregarRepuesto(this.id(), {
            origen: consumo.origen,
            repuestoId: consumo.repuestoId ?? null,
            descripcion:
              consumo.origen === OrigenRepuesto.Inventario ? null : consumo.nombreRepuesto,
            cantidad: consumo.cantidad,
            precioUnitario: consumo.precioUnitario,
            ordenServicioId: consumo.ordenServicioId ?? null,
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
      this.panelCorregir() ||
      this.editandoServicio() !== null ||
      this.editandoRepuesto() !== null ||
      this.faltaRepuesto() !== null ||
      this.excepcionCategoria() !== null
    );
  }

  // =========================================================================
  // Vista de trabajo: pensada para el mecánico, que trabaja con las manos
  // sucias. Todo se elige tocando; escribir queda para lo que no aparece.
  // =========================================================================

  /** El servicio en curso (o el próximo pendiente): se destaca con sus botones grandes. */
  protected readonly servicioActual = computed(() => {
    const servicios = this.orden()?.servicios ?? [];
    return (
      servicios.find((s) => s.estado === EstadoServicioOrden.EnProceso) ??
      null
    );
  });

  /** Avance para la barra de "Trabajos": porcentaje de servicios hechos. */
  protected readonly porcentajeHecho = computed(() => {
    const total = this.orden()?.servicios.length ?? 0;
    return total === 0 ? 0 : Math.round((this.serviciosCompletados() / total) * 100);
  });

  /** Los pasos del trabajo los guían las tarjetas y la barra de abajo, no la tarjeta de arriba. */
  protected esPasoDeTrabajo(tipo: string): boolean {
    return ['finalizar', 'agregarServicio', 'registrarRepuesto', 'completar'].includes(tipo) && this.puedeTrabajar();
  }

  /** Barra fija de abajo: se puede finalizar cuando todo está hecho y con sus repuestos. */
  protected readonly listoParaFinalizar = computed(() => {
    const o = this.orden();
    return !!o && o.servicios.length > 0 && this.serviciosPendientes() === 0;
  });

  // --- Elegir repuesto tocando ------------------------------------------------

  /** Texto opcional para buscar un repuesto que no aparece entre las tarjetas. */
  protected readonly buscarRepuesto = signal('');

  /**
   * Las tarjetas del panel de repuesto. Sin búsqueda: los de la categoría del
   * servicio (los que sirven para el vehículo primero). Con búsqueda: todos
   * los que coinciden. Mismo orden y reglas que la lista de antes.
   */
  protected readonly mosaicoRepuestos = computed(() => {
    const servicio = this.servicioDelRepuesto();
    const texto = this.buscarRepuesto().trim();
    const esAdministrador = this.auth.esAdministrador();

    const base =
      this.clasificacionRepuestos()?.map(({ repuesto, nivel }) => ({ repuesto, nivel: nivel as NivelCompatibilidad | null })) ??
      this.repuestos().map((repuesto) => ({ repuesto, nivel: null as NivelCompatibilidad | null }));

    const peso: Record<EncajeCategoria, number> = { corresponde: 0, libre: 1, otra: 2 };
    let lista = base.map((o) => ({ ...o, encaje: this.encaje(o.repuesto, servicio) }));
    const controla = !!servicio && servicio.categorias.length > 0;
    if (controla) lista.sort((a, b) => peso[a.encaje] - peso[b.encaje]);

    if (texto) {
      lista = lista.filter((o) =>
        coincidePorPalabras(texto, o.repuesto.nombre, o.repuesto.repuestoId, o.repuesto.nombreCategoria),
      );
    } else if (controla) {
      const suyos = lista.filter((o) => o.encaje === 'corresponde');
      if (suyos.length > 0) lista = suyos;
    }

    return lista.slice(0, texto ? 30 : 12).map(({ repuesto: r, nivel, encaje }) => ({
      repuesto: r,
      sirve: nivel === NivelCompatibilidad.Compatible,
      noIndicado: nivel === NivelCompatibilidad.NoIndicado,
      deshabilitado: r.stockActual === 0 || (encaje === 'otra' && !esAdministrador),
      motivo:
        r.stockActual === 0
          ? 'Sin stock'
          : encaje === 'otra' && !esAdministrador
            ? `No corresponde: es ${r.nombreCategoria}`
            : '',
    }));
  });

  /** Encabezado de las tarjetas: qué lleva el servicio. */
  protected readonly tituloMosaico = computed(() => {
    const servicio = this.servicioDelRepuesto();
    if (this.buscarRepuesto().trim()) return 'Lo que coincide con la búsqueda';
    const lleva = servicio && servicio.categorias.length > 0 ? this.llevaDe(servicio) : 'Repuestos del inventario';
    return `${lleva} · primero los que sirven para este vehículo`;
  });

  protected elegirRepuestoTocando(repuesto: Repuesto): void {
    this.nuevoRepuesto.repuestoId = repuesto.repuestoId;
    this.nuevoRepuesto.precioUnitario = repuesto.precioVenta;
  }

  protected elegirServicioDelRepuesto(ordenServicioId: string): void {
    const nuevo = this.nuevoRepuesto.ordenServicioId === ordenServicioId ? '' : ordenServicioId;
    this.nuevoRepuesto.ordenServicioId = nuevo;
    this.servicioRepuesto.set(nuevo);
  }

  protected cambiarCantidad(delta: number): void {
    const tope = this.repuestoElegido()?.stockActual;
    const siguiente = Math.max(1, (this.nuevoRepuesto.cantidad || 1) + delta);
    this.nuevoRepuesto.cantidad =
      this.nuevoRepuesto.origen === OrigenRepuesto.Inventario && tope ? Math.min(siguiente, tope) : siguiente;
  }

  /** Texto del botón grande del panel de repuesto. */
  protected textoAgregarRepuesto(): string {
    const cantidad = this.nuevoRepuesto.cantidad || 1;
    const nombre =
      this.nuevoRepuesto.origen === OrigenRepuesto.Inventario
        ? this.repuestoElegido()?.nombre
        : this.nuevoRepuesto.descripcion.trim();
    return nombre ? `Agregar ${cantidad} × ${nombre}` : 'Elija el repuesto';
  }

  /** Para lo que trae el cliente o se compra afuera: nombres comunes con un toque. */
  protected readonly nombresRepuestoRapidos = computed(() => {
    const servicio = this.servicioDelRepuesto();
    const deCategoria = servicio?.categorias.map((c) => c.nombre) ?? [];
    return [...new Set([...deCategoria, ...this.descripcionesRepuestoLibreSugeridas()])].slice(0, 8);
  });

  // --- Agregar trabajo tocando ------------------------------------------------

  protected readonly buscarServicio = signal('');
  protected readonly filtroServicios = signal<'todos' | 'repuestos' | 'mano'>('todos');
  /** Nombre del último agregado, para el aviso verde del panel. */
  protected readonly ultimoAgregado = signal<string | null>(null);
  /** "Otro trabajo": servicio fuera de catálogo, con nombre y precio escritos. */
  protected readonly servicioLibre = signal(false);

  protected readonly mosaicoServicios = computed(() => {
    const texto = this.buscarServicio().trim();
    const filtro = this.filtroServicios();
    const enOrden = new Set((this.orden()?.servicios ?? []).map((s) => s.servicioId).filter(Boolean));
    return this.catalogo()
      .filter((s) => (filtro === 'todos' ? true : filtro === 'repuestos' ? s.requiereRepuesto : !s.requiereRepuesto))
      .filter((s) => coincidePorPalabras(texto, s.nombre, s.descripcion))
      .map((s) => ({
        servicio: s,
        enOrden: enOrden.has(s.servicioId),
        lleva: !s.requiereRepuesto
          ? 'Solo mano de obra'
          : s.categorias.length > 0
            ? 'Lleva ' + s.categorias.map((c) => c.nombre.toLocaleLowerCase('es')).join(' y ')
            : 'Lleva repuestos',
      }));
  });

  protected volverAlCatalogo(): void {
    const mecanicoId = this.nuevoServicio.mecanicoId;
    this.nuevoServicio = this.servicioVacio();
    this.nuevoServicio.mecanicoId = mecanicoId;
    this.servicioLibre.set(false);
  }

  /** Un toque: el servicio queda cargado con su precio del catálogo y el panel sigue abierto. */
  protected agregarTocando(servicio: TipoServicio): void {
    const asignados = this.orden()?.mecanicos ?? [];
    if (asignados.length === 0) {
      this.notificacion.advertencia('Primero hay que asignar el mecánico de la orden.');
      return;
    }
    if (this.puedeGestionar() && asignados.length > 1 && !this.nuevoServicio.mecanicoId) {
      this.notificacion.advertencia('Elija arriba qué mecánico hace el trabajo.');
      return;
    }

    this.procesando.set(true);
    this.servicio
      .agregarServicio(this.id(), {
        servicioId: servicio.servicioId,
        nombreLibre: null,
        mecanicoId: this.puedeGestionar() ? this.nuevoServicio.mecanicoId || null : null,
        descripcion: null,
        precio: servicio.precioBase,
        requiereRepuesto: null,
      })
      .subscribe({
        next: (orden) => {
          this.orden.set(orden);
          this.cargarHistorial(orden.ordenId);
          this.procesando.set(false);
          this.ultimoAgregado.set(servicio.nombre);
          this.contadores.refrescar();
        },
        error: () => this.procesando.set(false),
      });
  }

  // --- Nota del trabajo, escrita o dictada ------------------------------------

  /** Nota que se está escribiendo (una a la vez). */
  protected readonly notaServicio = signal<{ id: string; texto: string } | null>(null);
  protected readonly escuchando = signal(false);
  protected readonly dictadoDisponible =
    typeof window !== 'undefined' &&
    !!((window as unknown as Record<string, unknown>)['SpeechRecognition'] ||
      (window as unknown as Record<string, unknown>)['webkitSpeechRecognition']);
  private reconocimiento: { stop(): void } | null = null;

  protected escribirNota(servicio: OrdenServicio): void {
    this.notaServicio.set({ id: servicio.ordenServicioId, texto: servicio.descripcion ?? '' });
  }

  protected cambiarTextoNota(texto: string): void {
    const actual = this.notaServicio();
    if (actual) this.notaServicio.set({ ...actual, texto });
  }

  /**
   * Dictar: el navegador pasa la voz a texto (Chrome y Edge, con permiso de
   * micrófono). Lo dicho se suma al final de la nota.
   */
  protected dictar(servicio: OrdenServicio): void {
    if (this.escuchando()) {
      this.reconocimiento?.stop();
      return;
    }
    if (!this.dictadoDisponible) {
      this.notificacion.advertencia('Este navegador no permite dictar. Use Chrome o escriba la nota.');
      return;
    }
    if (this.notaServicio()?.id !== servicio.ordenServicioId) this.escribirNota(servicio);

    const ventana = window as unknown as Record<string, new () => ReconocimientoVoz>;
    const Constructor = ventana['SpeechRecognition'] ?? ventana['webkitSpeechRecognition'];
    const rec = new Constructor();
    rec.lang = 'es-BO';
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (evento) => {
      const dicho = Array.from(evento.results)
        .map((resultado) => resultado[0].transcript)
        .join(' ')
        .trim();
      const actual = this.notaServicio();
      if (!dicho || !actual) return;
      const frase = dicho.charAt(0).toUpperCase() + dicho.slice(1);
      this.notaServicio.set({ ...actual, texto: actual.texto.trim() ? `${actual.texto.trim()} ${frase}` : frase });
    };
    rec.onerror = (evento) => {
      this.escuchando.set(false);
      if (evento.error === 'not-allowed') this.notificacion.advertencia('Permita el micrófono para poder dictar.');
    };
    rec.onend = () => this.escuchando.set(false);
    this.reconocimiento = rec;
    this.escuchando.set(true);
    rec.start();
  }

  protected guardarNota(servicio: OrdenServicio): void {
    const nota = this.notaServicio();
    if (!nota) return;
    this.reconocimiento?.stop();
    this.procesando.set(true);
    this.servicio.guardarNotaServicio(this.id(), servicio.ordenServicioId, nota.texto.trim() || null).subscribe({
      next: (orden) => {
        this.orden.set(orden);
        this.cargarHistorial(orden.ordenId);
        this.notaServicio.set(null);
        this.procesando.set(false);
        this.notificacion.exito('Nota guardada.');
      },
      error: () => this.procesando.set(false),
    });
  }

  protected cancelarNota(): void {
    this.reconocimiento?.stop();
    this.notaServicio.set(null);
  }

  // --- Foto desde la orden --------------------------------------------------

  protected readonly subiendoFoto = signal(false);

  /** Abre la cámara del celular (o el selector de archivos en la computadora). */
  protected async onFotoElegida(evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    entrada.value = '';
    const orden = this.orden();
    if (!archivo || !orden) return;

    const lista = await prepararFoto(archivo);
    if (typeof lista === 'string') {
      this.notificacion.advertencia(lista);
      return;
    }

    this.subiendoFoto.set(true);
    this.vehiculosService.subirFoto(orden.vehiculoId, lista).subscribe({
      next: (foto) => {
        this.fotosVehiculo.update((fotos) => [...fotos, foto]);
        this.subiendoFoto.set(false);
        this.notificacion.exito('Foto guardada en la ficha del vehículo.');
      },
      error: () => this.subiendoFoto.set(false),
    });
  }

  protected alCerrarPestania(evento: BeforeUnloadEvent): void {
    if (!this.hayCambiosSinGuardar()) return;

    evento.preventDefault();
    evento.returnValue = '';
  }
}

/** Corta un texto largo en la última palabra que entra, con puntos suspensivos. */
function recortar(texto: string, largo: number): string {
  if (texto.length <= largo) return texto;
  const corte = texto.slice(0, largo);
  const espacio = corte.lastIndexOf(' ');
  return `${(espacio > largo * 0.6 ? corte.slice(0, espacio) : corte).trimEnd()}…`;
}

/** Lo mínimo de la Web Speech API que se usa para dictar la nota. */
interface ReconocimientoVoz {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: (evento: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onerror: (evento: { error: string }) => void;
  onend: () => void;
  start(): void;
  stop(): void;
}
