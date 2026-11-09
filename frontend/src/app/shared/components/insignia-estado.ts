import { Component, computed, input } from '@angular/core';

import { estiloOrden } from '../estilo-estado';
import {
  EstadoDiag,
  EstadoProforma,
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
  | 'proforma'
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
      case 'proforma': return ETIQUETAS.estadoProforma[v as EstadoProforma];
      case 'venta': return ETIQUETAS.estadoVenta[v as EstadoVenta];
      case 'pago': return ETIQUETAS.estadoPago[v as EstadoPago];
      case 'activo': return ETIQUETAS.activoInactivo[v as 0 | 1];
    }
  });

  protected readonly clase = computed(() => {
    const v = this.valor();

    switch (this.familia()) {
      case 'orden':
        return estiloOrden(v as EstadoOrden);

      case 'servicioOrden':
        return {
          [EstadoServicioOrden.Pendiente]: 'insignia-gris con-icono ic-reloj',
          [EstadoServicioOrden.EnProceso]: 'insignia-naranja con-icono ic-proceso vivo',
          [EstadoServicioOrden.Completado]: 'insignia-verde con-icono ic-ok',
        }[v as EstadoServicioOrden];

      case 'diagnostico':
        return {
          [EstadoDiag.Registrado]: 'insignia-azul con-icono ic-reloj',
          [EstadoDiag.Revisado]: 'insignia-verde con-icono ic-ok',
          [EstadoDiag.Anulado]: 'insignia-gris apagada con-icono ic-ban',
        }[v as EstadoDiag];

      case 'respuestaCliente':
        return {
          [RespuestaCliente.Pendiente]: 'insignia-naranja con-icono ic-reloj vivo',
          [RespuestaCliente.Aprobado]: 'insignia-verde con-icono ic-ok',
          [RespuestaCliente.Rechazado]: 'insignia-roja con-icono ic-x',
        }[v as RespuestaCliente];

      case 'proforma':
        return {
          [EstadoProforma.Emitida]: 'insignia-verde con-icono ic-ok',
          [EstadoProforma.Anulada]: 'insignia-gris apagada con-icono ic-ban',
        }[v as EstadoProforma];

      case 'venta':
        return {
          [EstadoVenta.Emitida]: 'insignia-verde con-icono ic-ok',
          [EstadoVenta.Anulada]: 'insignia-gris apagada con-icono ic-ban',
        }[v as EstadoVenta];

      case 'pago':
        return {
          [EstadoPago.Pendiente]: 'insignia-naranja con-icono ic-reloj vivo',
          [EstadoPago.Pagado]: 'insignia-verde con-icono ic-ok',
        }[v as EstadoPago];

      case 'activo':
        return v === 0 ? 'insignia-verde con-icono ic-ok' : 'insignia-gris apagada con-icono ic-pausa';
    }
  });
}
