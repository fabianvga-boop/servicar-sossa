import { Routes } from '@angular/router';

import { authGuard, invitadoGuard } from './core/guards/auth.guard';
import { confirmarSalidaGuard } from './core/guards/confirmar-salida.guard';

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
        data: { title: 'Panel' },
        loadComponent: () => import('./modules/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'perfil',
        loadComponent: () => import('./modules/auth/perfil').then((m) => m.Perfil),
      },

      // --- Taller ---------------------------------------------------------
      {
        path: 'ordenes',
        // `data.title` va en la ruta padre: las hijas de ordenes.routes.ts
        // (lista y detalle) no tienen título propio y lo heredan de acá.
        data: { title: 'Órdenes de trabajo' },
        loadChildren: () => import('./modules/ordenes/ordenes.routes').then((m) => m.rutas),
      },
      {
        path: 'diagnosticos',
        data: { title: 'Diagnósticos' },
        loadComponent: () =>
          import('./modules/diagnosticos/diagnosticos').then((m) => m.Diagnosticos),
      },
      // Maqueta de calendario/Gantt con datos de ejemplo (ver agenda.ts):
      // el modelo real no tiene inicio/fin para dibujar un bloque de verdad,
      // así que a propósito no tiene entrada en el menú todavía.
      {
        path: 'agenda',
        loadComponent: () => import('./modules/agenda/agenda').then((m) => m.Agenda),
      },
      {
        path: 'tipos-servicio',
        data: { title: 'Catálogo de servicios' },
        loadComponent: () =>
          import('./modules/tipos-servicio/tipos-servicio').then((m) => m.TiposServicio),
      },

      // --- Clientes -------------------------------------------------------
      {
        path: 'clientes',
        canActivate: [authGuard(['Administrador'])],
        data: { title: 'Clientes' },
        loadComponent: () => import('./modules/clientes/clientes').then((m) => m.Clientes),
      },
      {
        path: 'vehiculos',
        data: { title: 'Vehículos' },
        loadComponent: () => import('./modules/vehiculos/vehiculos').then((m) => m.Vehiculos),
      },

      // --- Inventario -----------------------------------------------------
      {
        path: 'repuestos',
        data: { title: 'Repuestos' },
        loadComponent: () => import('./modules/repuestos/repuestos').then((m) => m.Repuestos),
      },
      {
        path: 'proveedores',
        canActivate: [authGuard(['Administrador'])],
        data: { title: 'Proveedores' },
        loadComponent: () =>
          import('./modules/proveedores/proveedores').then((m) => m.Proveedores),
      },
      {
        path: 'compras',
        canActivate: [authGuard(['Administrador'])],
        data: { title: 'Compras' },
        loadComponent: () => import('./modules/compras/compras').then((m) => m.Compras),
      },

      {
        path: 'ventas',
        canActivate: [authGuard(['Administrador'])],
        // El carrito de mostrador se arma en memoria: no se pierde por salir sin querer.
        canDeactivate: [confirmarSalidaGuard],
        data: { title: 'Punto de venta' },
        loadComponent: () => import('./modules/ventas/ventas').then((m) => m.Ventas),
      },

      // --- Finanzas -------------------------------------------------------
      // Dos documentos distintos: la proforma es el cobro del taller (sin valor
      // fiscal) y es el flujo de todos los días; la factura es el comprobante
      // fiscal ante el SIN, y solo emite con facturación electrónica habilitada.
      {
        path: 'proformas',
        canActivate: [authGuard(['Administrador'])],
        data: { title: 'Proformas' },
        loadComponent: () => import('./modules/proformas/proformas').then((m) => m.Proformas),
      },
      {
        path: 'facturas',
        canActivate: [authGuard(['Administrador'])],
        data: { title: 'Facturas' },
        loadComponent: () => import('./modules/facturas/facturas').then((m) => m.Facturas),
      },
      {
        path: 'pagos',
        canActivate: [authGuard(['Administrador'])],
        data: { title: 'Pagos' },
        loadComponent: () => import('./modules/pagos/pagos').then((m) => m.Pagos),
      },
      {
        path: 'comisiones',
        canActivate: [authGuard(['Administrador'])],
        data: { title: 'Comisiones' },
        loadComponent: () =>
          import('./modules/comisiones/comisiones').then((m) => m.Comisiones),
      },

      // --- Administración -------------------------------------------------
      {
        path: 'usuarios',
        canActivate: [authGuard(['Administrador'])],
        data: { title: 'Usuarios' },
        loadComponent: () => import('./modules/usuarios/usuarios').then((m) => m.Usuarios),
      },
      {
        path: 'reportes',
        canActivate: [authGuard(['Administrador'])],
        data: { title: 'Reportes' },
        loadComponent: () => import('./modules/reportes/reportes').then((m) => m.Reportes),
      },
      {
        path: 'auditoria',
        canActivate: [authGuard(['Administrador'])],
        data: { title: 'Auditoría' },
        loadComponent: () => import('./modules/auditoria/auditoria').then((m) => m.Auditoria),
      },
      {
        path: 'plantillas-vehiculo',
        canActivate: [authGuard(['Administrador'])],
        data: { title: 'Plantillas de vehículo' },
        loadComponent: () =>
          import('./modules/plantillas-vehiculo/plantillas-vehiculo').then(
            (m) => m.PlantillasVehiculo,
          ),
      },
    ],
  },

  { path: '**', redirectTo: '' },
];
