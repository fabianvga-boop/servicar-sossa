import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import {
  HistorialVehiculo,
  Vehiculo,
  VehiculoFoto,
  VehiculoRequest,
  VehiculoUpdate,
} from '../models/personas.model';
import { ApiBase } from './api-base';

/** USU009-USU011 — gestión de vehículos. */
@Injectable({ providedIn: 'root' })
export class VehiculosService extends ApiBase {
  protected readonly recurso = 'vehiculos';

  historial(id: string): Observable<HistorialVehiculo> {
    return this.http.get<HistorialVehiculo>(this.url(id, 'historial'));
  }

  /** USU011 — pasar `clienteId` para ver solo los vehículos de un cliente. */
  getAll(buscar?: string, clienteId?: string): Observable<Vehiculo[]> {
    return this.listar<Vehiculo>({ buscar, clienteId });
  }

  getById(id: string): Observable<Vehiculo> {
    return this.obtener<Vehiculo>(id);
  }

  crear(datos: VehiculoRequest): Observable<Vehiculo> {
    return this.http.post<Vehiculo>(this.base, datos);
  }

  actualizar(id: string, datos: VehiculoUpdate): Observable<Vehiculo> {
    return this.http.put<Vehiculo>(this.url(id), datos);
  }

  // --- Fotos (galería opcional) ----------------------------------------------

  getFotos(vehiculoId: string): Observable<VehiculoFoto[]> {
    return this.http.get<VehiculoFoto[]>(this.url(vehiculoId, 'fotos'));
  }

  subirFoto(vehiculoId: string, archivo: File): Observable<VehiculoFoto> {
    const datos = new FormData();
    datos.append('foto', archivo, archivo.name);
    return this.http.post<VehiculoFoto>(this.url(vehiculoId, 'fotos'), datos);
  }

  eliminarFoto(vehiculoId: string, fotoId: string): Observable<{ mensaje: string }> {
    return this.http.delete<{ mensaje: string }>(this.url(vehiculoId, 'fotos', fotoId));
  }
}
