import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { PlantillaVehiculo } from '../models/personas.model';
import { ApiBase } from './api-base';

/** Biblioteca de diagramas vectoriales por Marca+Modelo (mantenimiento del Administrador). */
@Injectable({ providedIn: 'root' })
export class PlantillasVehiculoService extends ApiBase {
  protected readonly recurso = 'plantillas-vehiculo';

  getAll(): Observable<PlantillaVehiculo[]> {
    return this.http.get<PlantillaVehiculo[]>(this.base);
  }

  subir(marca: string, modelo: string, archivo: File): Observable<PlantillaVehiculo> {
    const datos = new FormData();
    datos.append('marca', marca);
    datos.append('modelo', modelo);
    datos.append('archivo', archivo, archivo.name);
    return this.http.post<PlantillaVehiculo>(this.base, datos);
  }

  eliminar(id: string): Observable<{ mensaje: string }> {
    return this.http.delete<{ mensaje: string }>(this.url(id));
  }
}
