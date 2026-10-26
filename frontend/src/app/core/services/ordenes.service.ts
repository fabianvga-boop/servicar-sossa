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

  /**
   * Una orden la trabaja un solo mecánico: si ya tiene uno, sumar otro exige
   * `motivoExcepcion` (queda en auditoría).
   */
  asignarMecanico(
    ordenId: string,
    mecanicoId: string,
    motivoExcepcion: string | null = null,
  ): Observable<OrdenDetalle> {
    return this.http.post<OrdenDetalle>(this.url(ordenId, 'mecanicos'), {
      mecanicoId,
      motivoExcepcion,
    });
  }

  quitarMecanico(ordenId: string, mecanicoId: string): Observable<OrdenDetalle> {
    return this.http.delete<OrdenDetalle>(this.url(ordenId, 'mecanicos', mecanicoId));
  }

  /**
   * Reabre una orden Finalizada o Cerrada para corregirla (solo Administrador):
   * anula su proforma y, si estaba cerrada, devuelve el stock y quita las
   * comisiones pendientes. El motivo queda en auditoría.
   */
  corregir(ordenId: string, motivo: string): Observable<OrdenDetalle> {
    return this.http.post<OrdenDetalle>(this.url(ordenId, 'corregir'), { motivo });
  }

  /** Corrige el precio o el detalle de un servicio cargado (solo Administrador). */
  editarServicio(
    ordenId: string,
    ordenServicioId: string,
    datos: { precio: number; descripcion: string | null },
  ): Observable<OrdenDetalle> {
    return this.http.patch<OrdenDetalle>(this.url(ordenId, 'servicios', ordenServicioId), datos);
  }

  /** Corrige la cantidad de un repuesto cargado (y el precio, si es Administrador). */
  editarRepuesto(
    ordenId: string,
    ordenRepuestoId: string,
    datos: { cantidad: number; precioUnitario: number | null },
  ): Observable<OrdenDetalle> {
    return this.http.patch<OrdenDetalle>(this.url(ordenId, 'repuestos', ordenRepuestoId), datos);
  }

  // --- Servicios (USU023) --------------------------------------------------

  agregarServicio(ordenId: string, datos: OrdenServicioRequest): Observable<OrdenDetalle> {
    return this.http.post<OrdenDetalle>(this.url(ordenId, 'servicios'), datos);
  }

  /**
   * `motivoSinRepuesto`: excepción del Administrador para completar un
   * servicio que requiere repuesto sin haberlo registrado.
   */
  cambiarEstadoServicio(
    ordenId: string,
    ordenServicioId: string,
    estado: EstadoServicioOrden,
    motivoSinRepuesto: string | null = null,
  ): Observable<OrdenDetalle> {
    return this.http.patch<OrdenDetalle>(
      this.url(ordenId, 'servicios', ordenServicioId, 'estado'),
      { estado, motivoSinRepuesto },
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
