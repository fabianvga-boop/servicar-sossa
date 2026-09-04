import {
  EstadoDiag,
  EstadoOrden,
  EstadoServicio,
  EstadoServicioOrden,
  OrigenRepuesto,
  RespuestaCliente,
} from './enums';

// ------------------------------------------------------- Catálogo de servicios

export interface TipoServicio {
  servicioId: string;
  nombre: string;
  descripcion?: string | null;
  precioBase: number;
  estado: EstadoServicio;
}

export interface TipoServicioRequest {
  nombre: string;
  descripcion?: string | null;
  precioBase: number;
}

// -------------------------------------------------------------- Diagnósticos

export interface Diagnostico {
  diagnosticoId: string;
  vehiculoId: string;
  placaVehiculo: string;
  descripcionVehiculo: string;
  clienteId: string;
  nombreCliente: string;
  mecanicoId: string;
  nombreMecanico: string;
  fecha: string;
  descripcionFalla: string;
  observacionesTecnicas?: string | null;
  estado: EstadoDiag;
  fechaModificacion?: string | null;
  /** Presupuesto aproximado presentado al cliente. */
  montoEstimado?: number | null;
  respuestaCliente: RespuestaCliente;
  fechaRespuestaCliente?: string | null;
  comentarioCliente?: string | null;
  /** Orden generada a partir de este diagnóstico, si ya se generó una. */
  ordenId?: string | null;
}

export interface DiagnosticoRequest {
  vehiculoId: string;
  descripcionFalla: string;
  observacionesTecnicas?: string | null;
  montoEstimado?: number | null;
}

export interface DiagnosticoUpdate {
  descripcionFalla: string;
  observacionesTecnicas?: string | null;
  montoEstimado?: number | null;
}

export interface ResponderDiagnostico {
  respuesta: RespuestaCliente;
  comentarioCliente?: string | null;
}

// --------------------------------------------------------- Órdenes de trabajo

export interface Orden {
  ordenId: string;
  vehiculoId: string;
  placaVehiculo: string;
  descripcionVehiculo: string;
  clienteId: string;
  nombreCliente: string;
  administradorId: string;
  nombreAdministrador: string;
  /** Diagnóstico de origen. Null solo en órdenes creadas antes de esta regla. */
  diagnosticoId?: string | null;
  descripcionFalla?: string | null;
  observacionesTecnicasDiagnostico?: string | null;
  fechaCreacion: string;
  fechaEstimada?: string | null;
  fechaCierre?: string | null;
  estado: EstadoOrden;
  observaciones?: string | null;
  totalServicios: number;
  totalRepuestos: number;
  total: number;
  cantidadMecanicos: number;
  /** Viene también en la lista: la consulta ya carga los mecánicos con nombre. */
  mecanicos: OrdenMecanico[];
}

export interface OrdenDetalle extends Orden {
  servicios: OrdenServicio[];
  repuestos: OrdenRepuesto[];
}

export interface OrdenMecanico {
  mecanicoId: string;
  nombreMecanico: string;
  fechaAsignacion: string;
}

export interface OrdenServicio {
  ordenServicioId: string;
  /** Null cuando el servicio no proviene del catálogo. */
  servicioId?: string | null;
  nombreServicio: string;
  mecanicoId: string;
  nombreMecanico: string;
  diagnosticoId?: string | null;
  descripcion?: string | null;
  precio: number;
  estado: EstadoServicioOrden;
}

export interface OrdenRepuesto {
  ordenRepuestoId: string;
  /** Null cuando el repuesto no sale del inventario. */
  repuestoId?: string | null;
  origen: OrigenRepuesto;
  nombreRepuesto: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export interface OrdenRequest {
  diagnosticoId: string;
  fechaEstimada?: string | null;
  observaciones?: string | null;
}

export interface OrdenUpdate {
  fechaEstimada?: string | null;
  observaciones?: string | null;
}

export interface OrdenServicioRequest {
  /** Obligatorio solo si el servicio viene del catálogo. */
  servicioId?: string | null;
  /** Nombre libre del servicio cuando no está en el catálogo. */
  nombreLibre?: string | null;
  mecanicoId: string;
  diagnosticoId?: string | null;
  descripcion?: string | null;
  /** Catálogo: opcional (usa el precio base). Fuera de catálogo: obligatorio. */
  precio?: number | null;
}

export interface OrdenRepuestoRequest {
  origen: OrigenRepuesto;
  /** Obligatorio solo si origen = Inventario. */
  repuestoId?: string | null;
  /** Obligatorio si origen no es Inventario. */
  descripcion?: string | null;
  cantidad: number;
  precioUnitario?: number | null;
}
