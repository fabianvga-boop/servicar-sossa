import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { EstadoProforma, EstadoPago, MetodoPago } from '../models/enums';
import { PaginaResultado } from '../models/paginacion.model';
import {
  Comision,
  ComisionConfig,
  Proforma,
  ProformaRequest,
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
    pagina?: number;
    tamanoPagina?: number;
  } = {}): Observable<PaginaResultado<Comision>> {
    return this.listarPaginado<Comision>(filtros);
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
 * USU038 — proformas: el documento de cobro del taller, sin valor fiscal.
 * Es el flujo operativo de todos los días, y contra lo que el cliente paga.
 */
@Injectable({ providedIn: 'root' })
export class ProformasService extends ApiBase {
  protected readonly recurso = 'proformas';

  getAll(filtros: {
    ordenId?: string;
    clienteId?: string;
    estado?: EstadoProforma;
    desde?: string;
    hasta?: string;
    pagina?: number;
    tamanoPagina?: number;
  } = {}): Observable<PaginaResultado<Proforma>> {
    return this.listarPaginado<Proforma>(filtros);
  }

  getById(id: string): Observable<Proforma> {
    return this.obtener<Proforma>(id);
  }

  crear(datos: ProformaRequest): Observable<Proforma> {
    return this.http.post<Proforma>(this.base, datos);
  }

  /** Solo procede si la proforma no tiene pagos registrados. */
  anular(id: string): Observable<Proforma> {
    return this.http.patch<Proforma>(this.url(id, 'anular'), {});
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
    proformaId?: string;
    clienteId?: string;
    metodoPago?: MetodoPago;
    desde?: string;
    hasta?: string;
    pagina?: number;
    tamanoPagina?: number;
  } = {}): Observable<PaginaResultado<Pago>> {
    return this.listarPaginado<Pago>(filtros);
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
