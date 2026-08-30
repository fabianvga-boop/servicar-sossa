import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { CambiarPassword, LoginRequest, LoginResponse, Sesion } from '../models/auth.model';
import { Rol } from '../models/enums';

const CLAVE_TOKEN = 'servicar.token';
const CLAVE_SESION = 'servicar.sesion';

/**
 * Estado de autenticación de la aplicación.
 *
 * La sesión vive en un signal porque el proyecto es zoneless: mutar una
 * propiedad normal desde un callback de HTTP no dispararía la detección de
 * cambios y la interfaz no se actualizaría.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _sesion = signal<Sesion | null>(this.leerSesionGuardada());

  readonly sesion = this._sesion.asReadonly();
  readonly estaAutenticado = computed(() => this._sesion() !== null);
  readonly rol = computed(() => this._sesion()?.rol ?? null);
  readonly esAdministrador = computed(() => this.rol() === 'Administrador');
  readonly nombreCompleto = computed(() => this._sesion()?.nombreCompleto ?? '');

  login(credenciales: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/login`, credenciales)
      .pipe(tap((respuesta) => this.guardarSesion(respuesta)));
  }

  cambiarPassword(datos: CambiarPassword): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(
      `${environment.apiUrl}/auth/cambiar-password`,
      datos,
    );
  }

  logout(): void {
    localStorage.removeItem(CLAVE_TOKEN);
    localStorage.removeItem(CLAVE_SESION);
    this._sesion.set(null);
    void this.router.navigate(['/login']);
  }

  get token(): string | null {
    return localStorage.getItem(CLAVE_TOKEN);
  }

  tieneRol(roles: Rol[]): boolean {
    const actual = this.rol();
    return actual !== null && roles.includes(actual);
  }

  private guardarSesion(respuesta: LoginResponse): void {
    const sesion: Sesion = {
      usuarioId: respuesta.usuarioId,
      username: respuesta.username,
      nombreCompleto: respuesta.nombreCompleto,
      rol: respuesta.rol,
      expiraEn: new Date(respuesta.expiraEn),
    };

    localStorage.setItem(CLAVE_TOKEN, respuesta.token);
    localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
    this._sesion.set(sesion);
  }

  /**
   * Recupera la sesión al recargar la página. Si el token ya venció, la
   * descarta: mostrar un menú de usuario con un token muerto solo lleva a
   * una cascada de 401 en la primera acción.
   */
  private leerSesionGuardada(): Sesion | null {
    const crudo = localStorage.getItem(CLAVE_SESION);
    if (!crudo || !localStorage.getItem(CLAVE_TOKEN)) return null;

    try {
      const datos = JSON.parse(crudo) as Sesion;
      const expiraEn = new Date(datos.expiraEn);

      if (expiraEn <= new Date()) {
        localStorage.removeItem(CLAVE_TOKEN);
        localStorage.removeItem(CLAVE_SESION);
        return null;
      }

      return { ...datos, expiraEn };
    } catch {
      return null;
    }
  }
}
