import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { EstadoUsuario } from '../models/enums';
import { Rol, Usuario, UsuarioRequest, UsuarioUpdate } from '../models/personas.model';
import { ApiBase } from './api-base';

/** USU001-USU005 — gestión de usuarios. */
@Injectable({ providedIn: 'root' })
export class UsuariosService extends ApiBase {
  protected readonly recurso = 'usuarios';

  getAll(buscar?: string): Observable<Usuario[]> {
    return this.listar<Usuario>({ buscar });
  }

  getById(id: string): Observable<Usuario> {
    return this.obtener<Usuario>(id);
  }

  crear(datos: UsuarioRequest): Observable<Usuario> {
    return this.http.post<Usuario>(this.base, datos);
  }

  actualizar(id: string, datos: UsuarioUpdate): Observable<Usuario> {
    return this.http.put<Usuario>(this.url(id), datos);
  }

  cambiarEstado(id: string, estado: EstadoUsuario): Observable<Usuario> {
    return this.http.patch<Usuario>(this.url(id, 'estado'), { estado });
  }

  /** Catálogo de roles, para poblar el selector del formulario. */
  getRoles(): Observable<Rol[]> {
    return this.http.get<Rol[]>(`${environment.apiUrl}/roles`);
  }
}
