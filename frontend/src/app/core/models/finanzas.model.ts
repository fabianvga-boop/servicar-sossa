import { EstadoFactura, EstadoPago, MetodoPago } from './enums';

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
// El sistema no factura vía SIAT: no hay distinción fiscal entre "factura" y
// "proforma", así que es un único documento de cobro. Los identificadores
// técnicos (FacturaId, /api/facturas) se mantienen para no tocar datos
// existentes; el nombre visible para el usuario es "Proforma".

export interface Factura {
  facturaId: string;
  ordenId: string;
  placaVehiculo: string;
  clienteId: string;
  nombreCliente: string;
  fechaEmision: string;
  nitRazonSocial?: string | null;
  total: number;
  estado: EstadoFactura;
  totalPagado: number;
  saldoPendiente: number;
  estaSaldada: boolean;
}

export interface FacturaRequest {
  ordenId: string;
  nitRazonSocial?: string | null;
}

// ------------------------------------------------------------------- Pagos

export interface Pago {
  pagoId: string;
  facturaId: string;
  ordenId: string;
  nombreCliente: string;
  monto: number;
  fechaPago: string;
  metodoPago: MetodoPago;
  referencia?: string | null;
  totalFactura: number;
  totalPagadoFactura: number;
  saldoPendienteFactura: number;
}

export interface PagoRequest {
  facturaId: string;
  monto: number;
  metodoPago: MetodoPago;
  referencia?: string | null;
}
