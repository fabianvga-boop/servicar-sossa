import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  LOCALE_ID,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { registerLocaleData } from '@angular/common';
import localeEsBo from '@angular/common/locales/es-BO';

import { authInterceptor } from './core/interceptors/auth.interceptor';
import { normalizarInterceptor } from './core/interceptors/normalizar.interceptor';
import { routes } from './app.routes';

// Formatea fechas y montos según la convención boliviana.
registerLocaleData(localeEsBo, 'es-BO');

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // withComponentInputBinding permite recibir los parámetros de ruta
    // directamente como inputs del componente.
    provideRouter(routes, withComponentInputBinding()),
    // El orden importa: primero se normaliza el cuerpo, después se firma y envía.
    provideHttpClient(withInterceptors([normalizarInterceptor, authInterceptor])),
    { provide: LOCALE_ID, useValue: 'es-BO' },
  ],
};
