import { Routes } from '@angular/router';

import { authGuard, invitadoGuard } from './core/guards/auth.guard';

/**
 * Rutas de la aplicación.
 *
 * Todo lo que requiere sesión cuelga del layout, que aporta la barra lateral
 * y el encabezado. Los guards de rol replican lo que la API ya exige con
 * `[Authorize(Roles = ...)]`: aquí solo evitan mostrar pantallas que
 * terminarían en 403.
 */
export const routes: Routes = [
  {
    path: 'login',
    canActivate: [invitadoGuard],
    loadComponent: () => import('./modules/auth/login').then((m) => m.Login),
  },

  {
    path: '',
    canActivate: [authGuard()],
    loadComponent: () => import('./layout/layout').then((m) => m.Layout),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },

      {
        path: 'dashboard',
        loadComponent: () => import('./modules/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'perfil',
        loadComponent: () => import('./modules/auth/perfil').then((m) => m.Perfil),
      },

      // --- Taller ---------------------------------------------------------
      {
        path: 'ordenes',
        loadChildren: () => import('./modules/ordenes/ordenes.routes').then((m) => m.rutas),
      },
      {
        path: 'diagnosticos',
        loadComponent: () =>
          import('./modules/diagnosticos/diagnosticos').then((m) => m.Diagnosticos),
      },
      {
        path: 'tipos-servicio',
        loadComponent: () =>
          import('./modules/tipos-servicio/tipos-servicio').then((m) => m.TiposServicio),
      },

      // --- Clientes -------------------------------------------------------
      {
        path: 'clientes',
        canActivate: [authGuard(['Administrador'])],
        loadComponent: () => import('./modules/clientes/clientes').then((m) => m.Clientes),
      },
      {
        path: 'vehiculos',
        loadComponent: () => import('./modules/vehiculos/vehiculos').then((m) => m.Vehiculos),
      },

      // --- Inventario -----------------------------------------------------
      {
        path: 'repuestos',
        loadComponent: () => import('./modules/repuestos/repuestos').then((m) => m.Repuestos),
      },
      {
        path: 'proveedores',
        canActivate: [authGuard(['Administrador'])],
        loadComponent: () =>
          import('./modules/proveedores/proveedores').then((m) => m.Proveedores),
      },
      {
        path: 'compras',
        canActivate: [authGuard(['Administrador'])],
        loadComponent: () => import('./modules/compras/compras').then((m) => m.Compras),
      },

      {
        path: 'ventas',
        canActivate: [authGuard(['Administrador'])],
        loadComponent: () => import('./modules/ventas/ventas').then((m) => m.Ventas),
      },

      // --- Finanzas -------------------------------------------------------
      // El sistema no factura vía SIAT: un único documento de cobro, mostrado
      // como "Proforma"; el módulo técnico sigue llamándose "facturas".
      {
        path: 'proformas',
        canActivate: [authGuard(['Administrador'])],
        loadComponent: () => import('./modules/facturas/facturas').then((m) => m.Facturas),
      },
      {
        path: 'pagos',
        canActivate: [authGuard(['Administrador'])],
        loadComponent: () => import('./modules/pagos/pagos').then((m) => m.Pagos),
      },
      {
        path: 'comisiones',
        canActivate: [authGuard(['Administrador'])],
        loadComponent: () =>
          import('./modules/comisiones/comisiones').then((m) => m.Comisiones),
      },

      // --- Administración -------------------------------------------------
      {
        path: 'usuarios',
        canActivate: [authGuard(['Administrador'])],
        loadComponent: () => import('./modules/usuarios/usuarios').then((m) => m.Usuarios),
      },
      {
        path: 'reportes',
        canActivate: [authGuard(['Administrador'])],
        loadComponent: () => import('./modules/reportes/reportes').then((m) => m.Reportes),
      },
      {
        path: 'auditoria',
        canActivate: [authGuard(['Administrador'])],
        loadComponent: () => import('./modules/auditoria/auditoria').then((m) => m.Auditoria),
      },
    ],
  },

  { path: '**', redirectTo: '' },
];
