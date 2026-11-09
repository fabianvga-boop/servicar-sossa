import { EstadoOrden, MetodoPago } from '../core/models/enums';

/**
 * Cómo se ve cada estado del sistema: tono + ícono + si late o está apagado.
 * Las clases las define styles.css ("Estados con icono"); acá solo se elige
 * cuál va en cada caso, para que la misma condición se vea igual en todas las
 * pantallas.
 */

/** Estado de una orden de trabajo. */
export function estiloOrden(estado: EstadoOrden): string {
  switch (estado) {
    case EstadoOrden.Abierta:
      return 'insignia-azul con-icono ic-reloj';
    case EstadoOrden.EnProceso:
      return 'insignia-naranja con-icono ic-proceso vivo';
    case EstadoOrden.Finalizada:
      return 'insignia-verde con-icono ic-ok';
    case EstadoOrden.Cerrada:
      return 'insignia-verde cerrada con-icono ic-ok';
    default:
      return 'insignia-gris apagada con-icono ic-ban';
  }
}

/** Estado de un vehículo (en el taller, listo, esperando): según su tono. */
export function estiloVehiculo(tono: string): string {
  switch (tono) {
    case 'naranja':
      return 'insignia-naranja con-icono ic-proceso vivo';
    case 'azul':
      return 'insignia-azul con-icono ic-reloj';
    case 'verde':
      return 'insignia-verde con-icono ic-ok';
    default:
      return 'insignia-gris';
  }
}

/** Ícono del método de pago (dato que acompaña, no un estado). */
export function iconoMetodo(metodo: MetodoPago): string {
  switch (metodo) {
    case MetodoPago.Efectivo:
      return 'ic-caja';
    case MetodoPago.Transferencia:
      return 'ic-transferencia';
    case MetodoPago.Tarjeta:
      return 'ic-tarjeta';
    case MetodoPago.QR:
      return 'ic-qr';
    default:
      return 'ic-caja';
  }
}
