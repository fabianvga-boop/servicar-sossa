import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { EstadoCliente } from '../models/enums';
import { Cliente, ClienteRequest } from '../models/personas.model';
import { ApiBase } from './api-base';

/** USU006-USU008 — gestión de clientes. */
@Injectable({ providedIn: 'root' })
export class ClientesService extends ApiBase {
  protected readonly recurso = 'clientes';

  getAll(buscar?: string): Observable<Cliente[]> {
    return this.listar<Cliente>({ buscar });
  }

  getById(id: string): Observable<Cliente> {
    return this.obtener<Cliente>(id);
  }

  crear(datos: ClienteRequest): Observable<Cliente> {
    return this.http.post<Cliente>(this.base, datos);
  }

  actualizar(id: string, datos: ClienteRequest): Observable<Cliente> {
    return this.http.put<Cliente>(this.url(id), datos);
  }

  cambiarEstado(id: string, estado: EstadoCliente): Observable<Cliente> {
    return this.http.patch<Cliente>(this.url(id, 'estado'), { estado });
  }
}
