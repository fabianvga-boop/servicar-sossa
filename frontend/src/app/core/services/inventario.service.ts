import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { EstadoVenta, TipoAjusteStock } from '../models/enums';
import { PaginaResultado } from '../models/paginacion.model';
import {
  Compra,
  CompraDetalle,
  CompraRequest,
  ProcedenciaRepuesto,
  Proveedor,
  ProveedorRequest,
  Repuesto,
  RepuestoRequest,
  RepuestoUpdate,
  ResumenVentas,
  Venta,
  VentaRequest,
} from '../models/inventario.model';
import { ApiBase } from './api-base';

/** USU028 — proveedores. */
@Injectable({ providedIn: 'root' })
export class ProveedoresService extends ApiBase {
  protected readonly recurso = 'proveedores';

  getAll(buscar?: string, pagina = 1, tamanoPagina = 20): Observable<PaginaResultado<Proveedor>> {
    return this.listarPaginado<Proveedor>({ buscar, pagina, tamanoPagina });
  }

  getById(id: string): Observable<Proveedor> {
    return this.obtener<Proveedor>(id);
  }

  crear(datos: ProveedorRequest): Observable<Proveedor> {
    return this.http.post<Proveedor>(this.base, datos);
  }

  actualizar(id: string, datos: ProveedorRequest): Observable<Proveedor> {
    return this.http.put<Proveedor>(this.url(id), datos);
  }

  eliminar(id: string): Observable<{ mensaje: string }> {
    return this.http.delete<{ mensaje: string }>(this.url(id));
  }
}

/** USU026, USU027, USU030 — inventario de repuestos. */
@Injectable({ providedIn: 'root' })
export class RepuestosService extends ApiBase {
  protected readonly recurso = 'repuestos';

  /** `soloStockBajo` devuelve la alerta de reposición (USU030). */
  getAll(filtros: {
    buscar?: string;
    proveedorId?: string;
    soloStockBajo?: boolean;
    pagina?: number;
    tamanoPagina?: number;
  } = {}): Observable<PaginaResultado<Repuesto>> {
    return this.listarPaginado<Repuesto>(filtros);
  }

  getById(id: string): Observable<Repuesto> {
    return this.obtener<Repuesto>(id);
  }

  /** Procedencia del stock: cuánto entró por compras (con proveedor) y su historial. */
  procedencia(id: string): Observable<ProcedenciaRepuesto> {
    return this.http.get<ProcedenciaRepuesto>(this.url(id, 'procedencia'));
  }

  crear(datos: RepuestoRequest): Observable<Repuesto> {
    return this.http.post<Repuesto>(this.base, datos);
  }

  /** No toca el stock: para eso está `ajustarStock`. */
  actualizar(id: string, datos: RepuestoUpdate): Observable<Repuesto> {
    return this.http.put<Repuesto>(this.url(id), datos);
  }

  /** Ajuste manual de inventario (conteo físico, merma). El motivo queda en la auditoría. */
  ajustarStock(
    id: string,
    stockActual: number,
    tipo: TipoAjusteStock,
    motivo: string,
  ): Observable<Repuesto> {
    return this.http.patch<Repuesto>(this.url(id, 'stock'), { stockActual, tipo, motivo });
  }

  eliminar(id: string): Observable<{ mensaje: string }> {
    return this.http.delete<{ mensaje: string }>(this.url(id));
  }

  // --- Foto del producto (opcional) ------------------------------------------

  /** Sube o reemplaza la foto: solo hay una por repuesto. */
  subirFoto(id: string, archivo: File): Observable<Repuesto> {
    const datos = new FormData();
    datos.append('foto', archivo, archivo.name);
    return this.http.post<Repuesto>(this.url(id, 'foto'), datos);
  }

  eliminarFoto(id: string): Observable<Repuesto> {
    return this.http.delete<Repuesto>(this.url(id, 'foto'));
  }
}

/** Punto de venta — venta de repuestos en mostrador, sin orden de trabajo. */
@Injectable({ providedIn: 'root' })
export class VentasService extends ApiBase {
  protected readonly recurso = 'ventas';

  getAll(filtros: {
    clienteId?: string;
    estado?: EstadoVenta;
    desde?: string;
    hasta?: string;
    pagina?: number;
    tamanoPagina?: number;
  } = {}): Observable<PaginaResultado<Venta>> {
    return this.listarPaginado<Venta>(filtros);
  }

  getById(id: string): Observable<Venta> {
    return this.obtener<Venta>(id);
  }

  /** Registrar la venta descuenta el stock en el acto. */
  crear(datos: VentaRequest): Observable<Venta> {
    return this.http.post<Venta>(this.base, datos);
  }

  /** Anular devuelve el stock al inventario. */
  anular(id: string): Observable<Venta> {
    return this.http.patch<Venta>(this.url(id, 'anular'), {});
  }

  /** Totales del periodo, para el cierre de caja. */
  getResumen(desde?: string, hasta?: string): Observable<ResumenVentas> {
    return this.http.get<ResumenVentas>(this.url('resumen'), {
      params: this.params({ desde, hasta }),
    });
  }
}

/** USU029 — compras a proveedores. Solo alta y consulta: son inmutables. */
@Injectable({ providedIn: 'root' })
export class ComprasService extends ApiBase {
  protected readonly recurso = 'compras';

  getAll(filtros: {
    proveedorId?: string;
    desde?: string;
    hasta?: string;
    pagina?: number;
    tamanoPagina?: number;
  } = {}): Observable<PaginaResultado<Compra>> {
    return this.listarPaginado<Compra>(filtros);
  }

  getById(id: string): Observable<CompraDetalle> {
    return this.obtener<CompraDetalle>(id);
  }

  /** Registrar la compra incrementa el stock de cada repuesto del detalle. */
  crear(datos: CompraRequest): Observable<CompraDetalle> {
    return this.http.post<CompraDetalle>(this.base, datos);
  }
}
