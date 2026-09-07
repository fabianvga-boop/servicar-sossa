import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';
import { InactividadService } from '../services/inactividad.service';
import { NotificacionService } from '../services/notificacion.service';

/** Métodos que mutan datos: no deben quedar cacheados por el navegador ni un proxy. */
const METODOS_MUTABLES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Adjunta el JWT a cada petición y traduce los errores HTTP a un aviso legible.
 *
 * Un 401 cierra la sesión: el token venció o dejó de ser válido, así que
 * mantener al usuario en pantalla solo produce más errores. Un 403 solo avisa:
 * la sesión sigue siendo válida, simplemente el rol no alcanza para esa acción.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const notificacion = inject(NotificacionService);
  const inactividad = inject(InactividadService);

  // El token solo viaja hacia la propia API: si algún día se agrega una
  // llamada a un servicio externo (mapas, un CDN, una pasarela de pagos), el
  // Bearer del taller no debe filtrarse hacia ese tercero.
  const esApiPropia = req.url.startsWith(environment.apiUrl);
  const token = auth.token;

  let peticion = esApiPropia && token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  // Las mutaciones nunca deben servirse desde una caché stale (del navegador
  // o de un proxy intermedio): repetir un POST/DELETE cacheado sería repetir
  // la operación de negocio, no solo releer un dato.
  if (esApiPropia && METODOS_MUTABLES.has(peticion.method)) {
    peticion = peticion.clone({
      setHeaders: { 'Cache-Control': 'no-cache, no-store, must-revalidate', Pragma: 'no-cache' },
    });
  }

  return next(peticion).pipe(
    catchError((error: HttpErrorResponse) => {
      // El login maneja su propio 401: ahí significa "credenciales incorrectas",
      // no "sesión vencida", y cerrar sesión sería redundante.
      const esLogin = req.url.endsWith('/auth/login');

      if (error.status === 401 && !esLogin) {
        // No hay refresh token en este sistema (el login solo emite un JWT de
        // vida corta): la única salida segura ante un 401 es volver a pedir
        // credenciales, nunca reintentar en silencio con el token vencido.
        notificacion.advertencia('Su sesión expiró. Vuelva a iniciar sesión.');
        inactividad.detener();
        auth.logout();
      } else if (error.status === 403) {
        // Nunca se expone el detalle técnico del backend: un 403 solo dice
        // que el rol actual no alcanza, no por qué ni cómo sortearlo.
        notificacion.advertencia('No tiene permisos para realizar esta acción.');
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
