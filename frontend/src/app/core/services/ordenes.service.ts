import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { EstadoOrden, EstadoServicioOrden } from '../models/enums';
import {
  Orden,
  OrdenDetalle,
  OrdenRepuestoRequest,
  OrdenRequest,
  OrdenServicioRequest,
  OrdenUpdate,
} from '../models/taller.model';
import { ApiBase } from './api-base';

/**
 * USU021-USU025 — órdenes de trabajo.
 *
 * Todas las operaciones sobre el detalle devuelven la orden completa
 * actualizada, así que la pantalla no necesita recargar por su cuenta.
 */
@Injectable({ providedIn: 'root' })
export class OrdenesService extends ApiBase {
  protected readonly recurso = 'ordenes';

  getAll(filtros: {
    clienteId?: string;
    vehiculoId?: string;
    mecanicoId?: string;
    estado?: EstadoOrden;
  } = {}): Observable<Orden[]> {
    return this.listar<Orden>(filtros);
  }

  getById(id: string): Observable<OrdenDetalle> {
    return this.obtener<OrdenDetalle>(id);
  }

  crear(datos: OrdenRequest): Observable<OrdenDetalle> {
    return this.http.post<OrdenDetalle>(this.base, datos);
  }

  actualizar(id: string, datos: OrdenUpdate): Observable<OrdenDetalle> {
    return this.http.put<OrdenDetalle>(this.url(id), datos);
  }

  /** Pasar a `Cerrada` descuenta stock y calcula comisiones en el backend. */
  cambiarEstado(id: string, estado: EstadoOrden): Observable<OrdenDetalle> {
    return this.http.patch<OrdenDetalle>(this.url(id, 'estado'), { estado });
  }

  // --- Mecánicos (USU022) --------------------------------------------------

  asignarMecanico(ordenId: string, mecanicoId: string): Observable<OrdenDetalle> {
    return this.http.post<OrdenDetalle>(this.url(ordenId, 'mecanicos'), { mecanicoId });
  }

  quitarMecanico(ordenId: string, mecanicoId: string): Observable<OrdenDetalle> {
    return this.http.delete<OrdenDetalle>(this.url(ordenId, 'mecanicos', mecanicoId));
  }

  // --- Servicios (USU023) --------------------------------------------------

  agregarServicio(ordenId: string, datos: OrdenServicioRequest): Observable<OrdenDetalle> {
    return this.http.post<OrdenDetalle>(this.url(ordenId, 'servicios'), datos);
  }

  cambiarEstadoServicio(
    ordenId: string,
    ordenServicioId: string,
    estado: EstadoServicioOrden,
  ): Observable<OrdenDetalle> {
    return this.http.patch<OrdenDetalle>(
      this.url(ordenId, 'servicios', ordenServicioId, 'estado'),
      { estado },
    );
  }

  quitarServicio(ordenId: string, ordenServicioId: string): Observable<OrdenDetalle> {
    return this.http.delete<OrdenDetalle>(this.url(ordenId, 'servicios', ordenServicioId));
  }

  // --- Repuestos -----------------------------------------------------------

  agregarRepuesto(ordenId: string, datos: OrdenRepuestoRequest): Observable<OrdenDetalle> {
    return this.http.post<OrdenDetalle>(this.url(ordenId, 'repuestos'), datos);
  }

  quitarRepuesto(ordenId: string, ordenRepuestoId: string): Observable<OrdenDetalle> {
    return this.http.delete<OrdenDetalle>(this.url(ordenId, 'repuestos', ordenRepuestoId));
  }

  // --- Escribir menos: sugerencias --------------------------------------------

  /** Nombres de servicios "fuera de catálogo" ya usados en cualquier orden. */
  nombresServicioLibre(): Observable<string[]> {
    return this.http.get<string[]>(this.url('sugerencias', 'servicios-libres'));
  }

  /** Descripciones de repuestos "fuera de inventario" ya usadas en cualquier orden. */
  descripcionesRepuestoLibre(): Observable<string[]> {
    return this.http.get<string[]>(this.url('sugerencias', 'repuestos-libres'));
  }
}
