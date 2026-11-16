import { EstadoProforma, EstadoPago, MetodoPago } from './enums';

// -------------------------------------------------------------- Comisiones

export interface ComisionConfig {
  configId: string;
  mecanicoId: string;
  nombreMecanico: string;
  porcentaje: number;
  fechaActualizacion: string;
}

export interface ComisionDetalleServicio {
  ordenServicioId: string;
  nombreServicio: string;
  descripcion?: string | null;
  precio: number;
}

export interface Comision {
  comisionId: string;
  ordenId: string;
  placaVehiculo: string;
  mecanicoId: string;
  nombreMecanico: string;
  monto: number;
  fechaCalculo: string;
  estadoPago: EstadoPago;
  fechaPago?: string | null;
  /** Servicios del mecánico en esa orden que componen el monto. */
  detalle: ComisionDetalleServicio[];
}

export interface ResumenComisiones {
  mecanicoId: string;
  nombreMecanico: string;
  porcentajeConfigurado?: number | null;
  cantidadComisiones: number;
  totalPendiente: number;
  totalPagado: number;
  totalGeneral: number;
}

export interface PagarComisionesLote {
  comisionIds: string[];
  /** Adelantos ya entregados al mecánico, a descontar del total. */
  adelantoDescontado: number;
}

/** Desglose devuelto al liquidar: bruto, adelanto y neto pagado. */
export interface LiquidacionResultado {
  cantidadComisiones: number;
  totalBruto: number;
  adelantoDescontado: number;
  netoPagado: number;
  comisiones: Comision[];
}

// ---------------------------------------------------------------- Proformas
//
// Documento de cobro del taller (PRF-000), SIN valor fiscal: es contra esto
// que el cliente paga.

export interface Proforma {
  proformaId: string;
  ordenId: string;
  placaVehiculo: string;
  clienteId: string;
  nombreCliente: string;
  fechaEmision: string;
  nitRazonSocial?: string | null;
  total: number;
  estado: EstadoProforma;
  totalPagado: number;
  saldoPendiente: number;
  estaSaldada: boolean;
}

export interface ProformaRequest {
  ordenId: string;
  nitRazonSocial?: string | null;
}

// ------------------------------------------------------------------- Pagos

export interface Pago {
  pagoId: string;
  proformaId: string;
  ordenId: string;
  nombreCliente: string;
  monto: number;
  fechaPago: string;
  metodoPago: MetodoPago;
  referencia?: string | null;
  totalProforma: number;
  totalPagadoProforma: number;
  saldoPendienteProforma: number;
}

export interface PagoRequest {
  proformaId: string;
  monto: number;
  metodoPago: MetodoPago;
  referencia?: string | null;
}
