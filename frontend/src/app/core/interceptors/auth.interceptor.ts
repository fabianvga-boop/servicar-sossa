import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { NotificacionService } from '../services/notificacion.service';

/**
 * Adjunta el JWT a cada petición y traduce los errores HTTP a un aviso legible.
 *
 * Un 401 cierra la sesión: el token venció o dejó de ser válido, así que
 * mantener al usuario en pantalla solo produce más errores.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const notificacion = inject(NotificacionService);

  const token = auth.token;

  const peticion = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(peticion).pipe(
    catchError((error: HttpErrorResponse) => {
      // El login maneja su propio 401: ahí significa "credenciales incorrectas",
      // no "sesión vencida", y cerrar sesión sería redundante.
      const esLogin = req.url.endsWith('/auth/login');

      if (error.status === 401 && !esLogin) {
        notificacion.advertencia('Su sesión expiró. Vuelva a iniciar sesión.');
        auth.logout();
      } else {
        notificacion.error(mensajeDeError(error));
      }

      return throwError(() => error);
    }),
  );
};

/** Extrae el mensaje del backend, que responde `{ mensaje: "..." }`. */
function mensajeDeError(error: HttpErrorResponse): string {
  if (error.status === 0) {
    return 'No se pudo contactar al servidor. Verifique que la API esté en ejecución.';
  }

  const cuerpo = error.error;

  if (typeof cuerpo === 'string' && cuerpo.trim()) return cuerpo;
  if (cuerpo?.mensaje) return cuerpo.mensaje;

  // Errores de validación de Data Annotations: { errors: { Campo: ["..."] } }
  if (cuerpo?.errors) {
    const detalles = Object.values(cuerpo.errors as Record<string, string[]>).flat();
    if (detalles.length) return detalles.join(' ');
  }

  if (cuerpo?.title) return cuerpo.title;

  return `Error ${error.status}: ${error.statusText || 'ocurrió un problema inesperado.'}`;
}
