import { EstadoVenta, MetodoPago } from './enums';

// ------------------------------------------------------------- Proveedores

export interface Proveedor {
  proveedorId: string;
  nombre: string;
  contacto?: string | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
  cantidadRepuestos: number;
}

export interface ProveedorRequest {
  nombre: string;
  contacto?: string | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
}

// --------------------------------------------------------------- Repuestos

export interface Repuesto {
  repuestoId: string;
  nombre: string;
  descripcion?: string | null;
  stockActual: number;
  stockMinimo: number;
  /** Costo al que se compra (referencia manual o actualizado por la última compra). */
  precioCompra: number;
  /** Precio al que se vende: el que se usa en órdenes y en el punto de venta. */
  precioVenta: number;
  proveedorId?: string | null;
  nombreProveedor?: string | null;
  /** Ruta pública de la foto del producto, o null si no tiene. */
  fotoUrl?: string | null;
  /** Calculado por el backend: stockActual <= stockMinimo. */
  stockBajo: boolean;
  /** Ganancia por unidad: precioVenta - precioCompra. */
  margen: number;
  valorInventario: number;
}

export interface RepuestoRequest {
  nombre: string;
  descripcion?: string | null;
  stockActual: number;
  stockMinimo: number;
  precioCompra: number;
  precioVenta: number;
  proveedorId?: string | null;
}

export type RepuestoUpdate = Omit<RepuestoRequest, 'stockActual'>;

export interface AjustarStock {
  stockActual: number;
}

// ----------------------------------------------------------------- Compras

export interface Compra {
  compraId: string;
  proveedorId: string;
  nombreProveedor: string;
  usuarioId: string;
  nombreUsuario: string;
  fecha: string;
  total: number;
  cantidadLineas: number;
}

export interface CompraDetalle extends Compra {
  detalles: CompraLinea[];
}

export interface CompraLinea {
  detalleId: string;
  repuestoId: string;
  nombreRepuesto: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export interface CompraRequest {
  proveedorId: string;
  detalles: CompraLineaRequest[];
}

export interface CompraLineaRequest {
  repuestoId: string;
  cantidad: number;
  precioUnitario: number;
}

// -------------------------------------------- Punto de venta (mostrador)

export interface Venta {
  ventaId: string;
  clienteId?: string | null;
  /** "Cliente de mostrador" cuando la venta no se ligó a un cliente. */
  nombreCliente: string;
  usuarioId: string;
  nombreUsuario: string;
  fechaVenta: string;
  metodoPago: MetodoPago;
  total: number;
  estado: EstadoVenta;
  observaciones?: string | null;
  detalles: VentaLinea[];
  cantidadArticulos: number;
}

export interface VentaLinea {
  ventaDetalleId: string;
  repuestoId: string;
  nombreRepuesto: string;
  fotoUrl?: string | null;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export interface VentaRequest {
  clienteId?: string | null;
  metodoPago: MetodoPago;
  observaciones?: string | null;
  detalles: VentaLineaRequest[];
}

export interface VentaLineaRequest {
  repuestoId: string;
  cantidad: number;
  precioUnitario?: number | null;
}

export interface ResumenVentas {
  cantidadVentas: number;
  totalVendido: number;
  articulosVendidos: number;
}
