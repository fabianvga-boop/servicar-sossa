namespace ServicarSossa.Domain.Enums;

/// <summary>
/// Todos estos enums se persisten como <c>string</c> en PostgreSQL mediante
/// <c>HasConversion&lt;string&gt;()</c>. Los nombres de los miembros deben coincidir
/// EXACTAMENTE con los valores permitidos por los CHECK constraints del DDL
/// (taller_automotriz_bd.sql); cualquier cambio aquí obliga a cambiar el CHECK.
/// </summary>

public enum EstadoUsuario { Activo, Inactivo }

public enum EstadoCliente { Activo, Inactivo }

public enum EstadoServicio { Activo, Inactivo }

public enum EstadoOrden { Abierta, EnProceso, Finalizada, Cerrada, Cancelada }

public enum EstadoFactura { Emitida, Anulada }

/// <summary>Estado de una venta de mostrador (tabla ventas).</summary>
public enum EstadoVenta { Emitida, Anulada }

public enum EstadoPago { Pendiente, Pagado }

public enum EstadoDiag { Registrado, Revisado, Anulado }

/// <summary>
/// Respuesta del cliente al presupuesto aproximado del diagnóstico (tabla diagnosticos):
///   * <c>Pendiente</c> — se le presentó el estimado y aún no decide.
///   * <c>Aprobado</c>  — aceptó; recién ahí se puede crear la orden de trabajo.
///   * <c>Rechazado</c> — no acepta y retira el vehículo; no se genera orden.
/// </summary>
public enum RespuestaCliente { Pendiente, Aprobado, Rechazado }

/// <summary>Estado de cada servicio dentro de una orden (tabla orden_servicios).</summary>
public enum EstadoServicioOrden { Pendiente, EnProceso, Completado }

/// <summary>
/// De dónde sale el repuesto usado en una orden (tabla orden_repuestos):
///   * <c>Inventario</c>    — sale del stock del taller; se cobra y descuenta stock.
///   * <c>ClienteTrae</c>   — lo consigue el propio cliente; no se cobra ni afecta stock.
///   * <c>CompraExterna</c> — se compra fuera (otra tienda/depósito); se cobra al costo, sin stock.
/// </summary>
public enum OrigenRepuesto { Inventario, ClienteTrae, CompraExterna }

public enum MetodoPago { Efectivo, Transferencia, Tarjeta, QR, Otro }

public enum FormatoReporte { Pdf, Excel, Csv }

/// <summary>Acción registrada en la bitácora de auditoría (tabla auditoria).</summary>
public enum AccionAuditoria { Crear, Editar, Eliminar, Anular, Ajustar, CambiarEstado }
