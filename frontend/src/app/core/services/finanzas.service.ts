import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { EstadoFactura, EstadoPago, MetodoPago } from '../models/enums';
import {
  Comision,
  ComisionConfig,
  Factura,
  FacturaRequest,
  LiquidacionResultado,
  Pago,
  PagoRequest,
  ResumenComisiones,
} from '../models/finanzas.model';
import { ApiBase } from './api-base';

/** USU031-USU034 — comisiones de mecánicos. */
@Injectable({ providedIn: 'root' })
export class ComisionesService extends ApiBase {
  protected readonly recurso = 'comisiones';

  getAll(filtros: {
    mecanicoId?: string;
    ordenId?: string;
    estadoPago?: EstadoPago;
    desde?: string;
    hasta?: string;
  } = {}): Observable<Comision[]> {
    return this.listar<Comision>(filtros);
  }

  getById(id: string): Observable<Comision> {
    return this.obtener<Comision>(id);
  }

  /** USU033 — totales por mecánico para liquidar el periodo. */
  getResumen(desde?: string, hasta?: string): Observable<ResumenComisiones[]> {
    return this.http.get<ResumenComisiones[]>(this.url('resumen'), {
      params: this.params({ desde, hasta }),
    });
  }

  // --- Configuración de porcentajes (USU031) -------------------------------

  getConfiguraciones(): Observable<ComisionConfig[]> {
    return this.http.get<ComisionConfig[]>(this.url('config'));
  }

  /** Upsert: crea el porcentaje o reemplaza el existente. */
  establecerPorcentaje(mecanicoId: string, porcentaje: number): Observable<ComisionConfig> {
    return this.http.put<ComisionConfig>(this.url('config', mecanicoId), { porcentaje });
  }

  // --- Pago (USU034) -------------------------------------------------------

  /** Irreversible: una comisión pagada no se puede revertir. */
  pagar(id: string): Observable<Comision> {
    return this.http.patch<Comision>(this.url(id, 'pagar'), {});
  }

  /**
   * Liquidación de planilla: todo o nada. Devuelve el desglose bruto/adelanto/neto.
   * El adelanto solo se admite cuando la planilla es de un único mecánico.
   */
  pagarLote(comisionIds: string[], adelantoDescontado = 0): Observable<LiquidacionResultado> {
    return this.http.post<LiquidacionResultado>(this.url('pagar-lote'), {
      comisionIds,
      adelantoDescontado,
    });
  }
}

/**
 * USU038 — proforma (documento de cobro único del taller: no hay factura
 * fiscal por SIAT, así que no se distingue de una proforma). El recurso
 * técnico sigue siendo "facturas" para no tocar datos existentes.
 */
@Injectable({ providedIn: 'root' })
export class FacturasService extends ApiBase {
  protected readonly recurso = 'facturas';

  getAll(filtros: {
    ordenId?: string;
    clienteId?: string;
    estado?: EstadoFactura;
    desde?: string;
    hasta?: string;
  } = {}): Observable<Factura[]> {
    return this.listar<Factura>(filtros);
  }

  getById(id: string): Observable<Factura> {
    return this.obtener<Factura>(id);
  }

  crear(datos: FacturaRequest): Observable<Factura> {
    return this.http.post<Factura>(this.base, datos);
  }

  /** Solo procede si la factura no tiene pagos registrados. */
  anular(id: string): Observable<Factura> {
    return this.http.patch<Factura>(this.url(id, 'anular'), {});
  }

  /** Comprobante en PDF con el detalle de servicios y repuestos. */
  pdf(id: string): Observable<{ blob: Blob; nombreArchivo: string }> {
    return this.archivo([id, 'pdf'], `${id}.pdf`);
  }
}

/** USU037 — pagos de clientes. */
@Injectable({ providedIn: 'root' })
export class PagosService extends ApiBase {
  protected readonly recurso = 'pagos';

  getAll(filtros: {
    facturaId?: string;
    clienteId?: string;
    metodoPago?: MetodoPago;
    desde?: string;
    hasta?: string;
  } = {}): Observable<Pago[]> {
    return this.listar<Pago>(filtros);
  }

  getById(id: string): Observable<Pago> {
    return this.obtener<Pago>(id);
  }

  crear(datos: PagoRequest): Observable<Pago> {
    return this.http.post<Pago>(this.base, datos);
  }

  revertir(id: string): Observable<{ mensaje: string }> {
    return this.http.delete<{ mensaje: string }>(this.url(id));
  }
}
