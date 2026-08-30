/**
 * Espejo de los enums de ServicarSossa.Domain.Enums.
 * El backend los serializa como número (índice del enum de C#), por eso aquí
 * se declaran como enums numéricos con el mismo orden que en el DDL.
 * Cambiar el orden aquí o allá rompe la correspondencia.
 */

export enum EstadoUsuario {
  Activo = 0,
  Inactivo = 1,
}

export enum EstadoCliente {
  Activo = 0,
  Inactivo = 1,
}

export enum EstadoServicio {
  Activo = 0,
  Inactivo = 1,
}

export enum EstadoOrden {
  Abierta = 0,
  EnProceso = 1,
  Finalizada = 2,
  Cerrada = 3,
  Cancelada = 4,
}

export enum EstadoServicioOrden {
  Pendiente = 0,
  EnProceso = 1,
  Completado = 2,
}

export enum EstadoDiag {
  Registrado = 0,
  Revisado = 1,
  Anulado = 2,
}

export enum RespuestaCliente {
  Pendiente = 0,
  Aprobado = 1,
  Rechazado = 2,
}

export enum EstadoFactura {
  Emitida = 0,
  Anulada = 1,
}

export enum EstadoVenta {
  Emitida = 0,
  Anulada = 1,
}

export enum EstadoPago {
  Pendiente = 0,
  Pagado = 1,
}

export enum MetodoPago {
  Efectivo = 0,
  Transferencia = 1,
  Tarjeta = 2,
  QR = 3,
  Otro = 4,
}

export enum FormatoReporte {
  Pdf = 0,
  Excel = 1,
  Csv = 2,
}

export enum OrigenRepuesto {
  Inventario = 0,
  ClienteTrae = 1,
  CompraExterna = 2,
}

export enum TipoReporte {
  Ventas = 0,
  Comisiones = 1,
  Inventario = 2,
  Ordenes = 3,
}

export enum AccionAuditoria {
  Crear = 0,
  Editar = 1,
  Eliminar = 2,
  Anular = 3,
  Ajustar = 4,
  CambiarEstado = 5,
}

/** Etiquetas legibles para mostrar en pantalla. */
export const ETIQUETAS = {
  estadoOrden: {
    [EstadoOrden.Abierta]: 'Abierta',
    [EstadoOrden.EnProceso]: 'En proceso',
    [EstadoOrden.Finalizada]: 'Finalizada',
    [EstadoOrden.Cerrada]: 'Cerrada',
    [EstadoOrden.Cancelada]: 'Cancelada',
  },
  estadoServicioOrden: {
    [EstadoServicioOrden.Pendiente]: 'Pendiente',
    [EstadoServicioOrden.EnProceso]: 'En proceso',
    [EstadoServicioOrden.Completado]: 'Completado',
  },
  estadoDiag: {
    [EstadoDiag.Registrado]: 'Registrado',
    [EstadoDiag.Revisado]: 'Revisado',
    [EstadoDiag.Anulado]: 'Anulado',
  },
  respuestaCliente: {
    [RespuestaCliente.Pendiente]: 'Pendiente',
    [RespuestaCliente.Aprobado]: 'Aprobado',
    [RespuestaCliente.Rechazado]: 'Rechazado',
  },
  estadoFactura: {
    [EstadoFactura.Emitida]: 'Emitida',
    [EstadoFactura.Anulada]: 'Anulada',
  },
  estadoVenta: {
    [EstadoVenta.Emitida]: 'Emitida',
    [EstadoVenta.Anulada]: 'Anulada',
  },
  estadoPago: {
    [EstadoPago.Pendiente]: 'Pendiente',
    [EstadoPago.Pagado]: 'Pagado',
  },
  metodoPago: {
    [MetodoPago.Efectivo]: 'Efectivo',
    [MetodoPago.Transferencia]: 'Transferencia',
    [MetodoPago.Tarjeta]: 'Tarjeta',
    [MetodoPago.QR]: 'QR',
    [MetodoPago.Otro]: 'Otro',
  },
  origenRepuesto: {
    [OrigenRepuesto.Inventario]: 'Del inventario',
    [OrigenRepuesto.ClienteTrae]: 'Lo trae el cliente',
    [OrigenRepuesto.CompraExterna]: 'Compra externa',
  },
  activoInactivo: {
    0: 'Activo',
    1: 'Inactivo',
  },
  accionAuditoria: {
    [AccionAuditoria.Crear]: 'Creó',
    [AccionAuditoria.Editar]: 'Editó',
    [AccionAuditoria.Eliminar]: 'Eliminó',
    [AccionAuditoria.Anular]: 'Anuló',
    [AccionAuditoria.Ajustar]: 'Ajustó',
    [AccionAuditoria.CambiarEstado]: 'Cambió estado',
  },
} as const;

/** Rol del usuario. El sistema solo maneja estos dos. */
export type Rol = 'Administrador' | 'Mecanico';
