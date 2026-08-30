import { Component, computed, input } from '@angular/core';

import {
  EstadoDiag,
  EstadoFactura,
  EstadoOrden,
  EstadoPago,
  EstadoServicioOrden,
  EstadoVenta,
  ETIQUETAS,
  RespuestaCliente,
} from '../../core/models/enums';

type Familia =
  | 'orden'
  | 'servicioOrden'
  | 'diagnostico'
  | 'respuestaCliente'
  | 'factura'
  | 'venta'
  | 'pago'
  | 'activo';

/**
 * Insignia de color para los estados del sistema. Centralizar la relación
 * estado → color evita que la misma condición aparezca en verde en una
 * pantalla y en gris en otra.
 */
@Component({
  selector: 'app-insignia-estado',
  template: `<span class="insignia" [class]="clase()">{{ texto() }}</span>`,
})
export class InsigniaEstado {
  readonly familia = input.required<Familia>();
  readonly valor = input.required<number>();

  protected readonly texto = computed(() => {
    const v = this.valor();

    switch (this.familia()) {
      case 'orden': return ETIQUETAS.estadoOrden[v as EstadoOrden];
      case 'servicioOrden': return ETIQUETAS.estadoServicioOrden[v as EstadoServicioOrden];
      case 'diagnostico': return ETIQUETAS.estadoDiag[v as EstadoDiag];
      case 'respuestaCliente': return ETIQUETAS.respuestaCliente[v as RespuestaCliente];
      case 'factura': return ETIQUETAS.estadoFactura[v as EstadoFactura];
      case 'venta': return ETIQUETAS.estadoVenta[v as EstadoVenta];
      case 'pago': return ETIQUETAS.estadoPago[v as EstadoPago];
      case 'activo': return ETIQUETAS.activoInactivo[v as 0 | 1];
    }
  });

  protected readonly clase = computed(() => {
    const v = this.valor();

    switch (this.familia()) {
      case 'orden':
        return {
          [EstadoOrden.Abierta]: 'insignia-azul',
          [EstadoOrden.EnProceso]: 'insignia-naranja',
          [EstadoOrden.Finalizada]: 'insignia-verde',
          [EstadoOrden.Cerrada]: 'insignia-gris',
          [EstadoOrden.Cancelada]: 'insignia-roja',
        }[v as EstadoOrden];

      case 'servicioOrden':
        return {
          [EstadoServicioOrden.Pendiente]: 'insignia-gris',
          [EstadoServicioOrden.EnProceso]: 'insignia-naranja',
          [EstadoServicioOrden.Completado]: 'insignia-verde',
        }[v as EstadoServicioOrden];

      case 'diagnostico':
        return {
          [EstadoDiag.Registrado]: 'insignia-azul',
          [EstadoDiag.Revisado]: 'insignia-verde',
          [EstadoDiag.Anulado]: 'insignia-roja',
        }[v as EstadoDiag];

      case 'respuestaCliente':
        return {
          [RespuestaCliente.Pendiente]: 'insignia-naranja',
          [RespuestaCliente.Aprobado]: 'insignia-verde',
          [RespuestaCliente.Rechazado]: 'insignia-roja',
        }[v as RespuestaCliente];

      case 'factura':
        return {
          [EstadoFactura.Emitida]: 'insignia-verde',
          [EstadoFactura.Anulada]: 'insignia-roja',
        }[v as EstadoFactura];

      case 'venta':
        return {
          [EstadoVenta.Emitida]: 'insignia-verde',
          [EstadoVenta.Anulada]: 'insignia-roja',
        }[v as EstadoVenta];

      case 'pago':
        return {
          [EstadoPago.Pendiente]: 'insignia-naranja',
          [EstadoPago.Pagado]: 'insignia-verde',
        }[v as EstadoPago];

      case 'activo':
        return v === 0 ? 'insignia-verde' : 'insignia-gris';
    }
  });
}
