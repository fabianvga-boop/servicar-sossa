import { Routes } from '@angular/router';

/**
 * Rutas del módulo de órdenes. El detalle recibe el `id` como input gracias a
 * `withComponentInputBinding()` configurado en app.config.ts.
 */
export const rutas: Routes = [
  {
    path: '',
    loadComponent: () => import('./ordenes-lista').then((m) => m.OrdenesLista),
  },
  {
    path: ':id',
    loadComponent: () => import('./orden-detalle').then((m) => m.OrdenDetalle),
  },
];
