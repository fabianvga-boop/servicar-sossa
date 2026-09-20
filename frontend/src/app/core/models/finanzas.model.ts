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
// que el cliente paga. No confundir con `Factura` más abajo, que es el
// comprobante fiscal ante el SIN y solo existe con facturación habilitada.

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

// ----------------------------------------------------------------- Facturas
//
// Comprobante FISCAL ante el SIN (FAC-000), con CUF y XML firmado. Nace de una
// orden de trabajo o de una venta de mostrador, y solo existe cuando el taller
// está habilitado ante Impuestos.

export type EstadoSiat =
  | 'Pendiente'
  | 'Enviada'
  | 'Validada'
  | 'Rechazada'
  | 'Contingencia'
  | 'Anulada';

export interface Factura {
  facturaId: string;
  ordenId?: string | null;
  ventaId?: string | null;
  placaVehiculo: string;
  nombreCliente: string;
  fechaEmision: string;
  nitRazonSocial?: string | null;
  total: number;
  estado: EstadoProforma;

  numeroFactura?: number | null;
  cuf?: string | null;
  codigoRecepcion?: string | null;
  estadoSiat: EstadoSiat;
  fechaEmisionSiat?: string | null;
  mensajeServicio?: string | null;
  tieneXml: boolean;
}

/** Se factura una orden o una venta, nunca las dos a la vez. */
export interface FacturaRequest {
  ordenId?: string | null;
  ventaId?: string | null;
  nitRazonSocial?: string | null;
}

/** Si el módulo puede emitir hoy, y si no, por qué. */
export interface EstadoFacturacion {
  modo: 'Interno' | 'SiatEnLinea';
  emisionHabilitada: boolean;
  motivo?: string | null;
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
