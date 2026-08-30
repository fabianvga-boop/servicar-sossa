import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { Rol } from '../models/enums';
import { AuthService } from '../services/auth.service';
import { NotificacionService } from '../services/notificacion.service';

/**
 * Protege una ruta exigiendo sesión activa y, opcionalmente, un rol concreto.
 *
 * Sin `roles` solo verifica que haya sesión. Con `roles`, además comprueba
 * que el usuario tenga alguno de ellos.
 *
 * Nota: esto es comodidad de navegación, no seguridad. Quien manda es
 * `[Authorize(Roles = ...)]` en la API, que es lo que no se puede eludir
 * desde el navegador.
 */
export const authGuard = (roles?: Rol[]): CanActivateFn => {
  return (_ruta, estado) => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.estaAutenticado()) {
      // Guardamos el destino para volver ahí después de iniciar sesión.
      return router.createUrlTree(['/login'], {
        queryParams: { redirigir: estado.url },
      });
    }

    if (roles && !auth.tieneRol(roles)) {
      inject(NotificacionService).advertencia(
        'No tiene permisos para acceder a esa sección.',
      );
      return router.createUrlTree(['/dashboard']);
    }

    return true;
  };
};

/** Impide volver al login con la sesión ya iniciada. */
export const invitadoGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.estaAutenticado() ? inject(Router).createUrlTree(['/dashboard']) : true;
};
