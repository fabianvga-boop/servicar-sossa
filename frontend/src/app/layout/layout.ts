import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ActivatedRouteSnapshot,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter, map } from 'rxjs/operators';

import { Rol } from '../core/models/enums';
import { urlArchivo } from '../core/services/api-base';
import { AuthService } from '../core/services/auth.service';
import { ContadoresService } from '../core/services/contadores.service';
import { InactividadService } from '../core/services/inactividad.service';
import { BuscadorGlobal } from '../shared/components/buscador-global';
import { IconoMenu, NombreIconoMenu } from '../shared/components/icono-menu';

/** Contadores que la barra lateral puede mostrar como insignia. */
type ClaveContador = 'ordenesActivas' | 'comisionesPendientes' | 'stockBajo';

interface EnlaceMenu {
  ruta: string;
  etiqueta: string;
  icono: NombreIconoMenu;
  /** Roles que ven el enlace. Sin definir, lo ven todos. */
  roles?: Rol[];
  /** Contador cuyo valor se dibuja como insignia junto al enlace. */
  contador?: ClaveContador;
}

interface GrupoMenu {
  titulo: string;
  enlaces: EnlaceMenu[];
}

/** Shell de la aplicación: barra lateral, encabezado y área de contenido. */
@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, BuscadorGlobal, IconoMenu],
  templateUrl: './layout.html',
  styleUrl: './layout.css',
})
export class Layout {
  protected readonly auth = inject(AuthService);
  protected readonly contadores = inject(ContadoresService);
  private readonly inactividad = inject(InactividadService);
  private readonly router = inject(Router);
  protected readonly urlArchivo = urlArchivo;

  private readonly buscador = viewChild.required(BuscadorGlobal);

  /** En móvil la barra lateral se oculta y se despliega con el botón. */
  protected readonly menuAbierto = signal(false);
  protected readonly menuUsuarioAbierto = signal(false);

  /**
   * Nombre de la sección activa, para el encabezado. Se lee de `data.title`
   * en las rutas (ver app.routes.ts) en vez de duplicar la lista de enlaces
   * de `grupos`: así quien entra por un enlace directo (no por el menú) sabe
   * dónde está sin depender de ver la píldora `.activo` del lateral, que en
   * pantallas angostas queda tapada por el botón de hamburguesa.
   */
  protected readonly tituloSeccion = toSignal(
    this.router.events.pipe(
      filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd),
      map(() => this.tituloDesdeRuta()),
    ),
    { initialValue: this.tituloDesdeRuta() },
  );

  private readonly grupos: GrupoMenu[] = [
    {
      // Sin título: es un solo enlace, no necesita una fila de categoría propia.
      titulo: '',
      enlaces: [
        { ruta: '/dashboard', etiqueta: 'Panel', icono: 'panel' },
      ],
    },
    {
      titulo: 'Operación',
      enlaces: [
        {
          ruta: '/ordenes',
          etiqueta: 'Órdenes de trabajo',
          icono: 'ordenes',
          contador: 'ordenesActivas',
        },
        { ruta: '/diagnosticos', etiqueta: 'Diagnósticos', icono: 'diagnosticos' },
        { ruta: '/tipos-servicio', etiqueta: 'Catálogo de servicios', icono: 'catalogo' },
      ],
    },
    {
      titulo: 'Clientes',
      enlaces: [
        { ruta: '/clientes', etiqueta: 'Clientes', icono: 'clientes', roles: ['Administrador'] },
        { ruta: '/vehiculos', etiqueta: 'Vehículos', icono: 'vehiculos' },
      ],
    },
    {
      titulo: 'Almacén',
      enlaces: [
        { ruta: '/repuestos', etiqueta: 'Repuestos', icono: 'repuestos', contador: 'stockBajo' },
        { ruta: '/proveedores', etiqueta: 'Proveedores', icono: 'proveedores', roles: ['Administrador'] },
        { ruta: '/compras', etiqueta: 'Compras', icono: 'compras', roles: ['Administrador'] },
        { ruta: '/ventas', etiqueta: 'Punto de venta', icono: 'ventas', roles: ['Administrador'] },
      ],
    },
    {
      titulo: 'Finanzas',
      enlaces: [
        { ruta: '/proformas', etiqueta: 'Proformas', icono: 'proformas', roles: ['Administrador'] },
        { ruta: '/facturas', etiqueta: 'Facturas', icono: 'proformas', roles: ['Administrador'] },
        { ruta: '/pagos', etiqueta: 'Pagos', icono: 'pagos', roles: ['Administrador'] },
        {
          ruta: '/comisiones',
          etiqueta: 'Comisiones',
          icono: 'comisiones',
          roles: ['Administrador'],
          contador: 'comisionesPendientes',
        },
      ],
    },
    {
      titulo: 'Administración',
      enlaces: [
        { ruta: '/usuarios', etiqueta: 'Usuarios', icono: 'usuarios', roles: ['Administrador'] },
        { ruta: '/reportes', etiqueta: 'Reportes', icono: 'reportes', roles: ['Administrador'] },
        { ruta: '/auditoria', etiqueta: 'Auditoría', icono: 'auditoria', roles: ['Administrador'] },
        {
          ruta: '/plantillas-vehiculo',
          etiqueta: 'Plantillas de vehículo',
          icono: 'plantillas',
          roles: ['Administrador'],
        },
      ],
    },
  ];

  /**
   * Menú filtrado por rol. Los grupos que quedan sin enlaces visibles se
   * descartan, para no dejar títulos huérfanos en la barra del mecánico.
   */
  protected readonly menu = computed(() => {
    const rol = this.auth.rol();

    return this.grupos
      .map((grupo) => ({
        ...grupo,
        enlaces: grupo.enlaces.filter((e) => !e.roles || (rol && e.roles.includes(rol))),
      }))
      .filter((grupo) => grupo.enlaces.length > 0);
  });

  constructor() {
    this.contadores.refrescar();
    // El layout solo existe mientras hay sesión: es el punto justo para
    // empezar a vigilar la inactividad (CAPA 2.3).
    this.inactividad.iniciar();
  }

  /**
   * Recorre las rutas activas desde la raíz hasta la hoja y se queda con el
   * último `data.title` que encuentra. Así una ruta anidada sin título
   * propio (el detalle de una orden, por ejemplo) hereda el de su ruta
   * padre en vez de dejar el encabezado vacío.
   */
  private tituloDesdeRuta(): string | undefined {
    let ruta: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    let titulo: string | undefined;

    while (ruta) {
      const dato = ruta.data['title'];
      if (dato) titulo = dato as string;
      ruta = ruta.firstChild;
    }

    return titulo;
  }

  /** Valor de la insignia de un enlace; 0 se trata como "nada que mostrar". */
  protected valorContador(clave: ClaveContador | undefined): number {
    if (!clave) return 0;

    switch (clave) {
      case 'ordenesActivas':
        return this.contadores.ordenesActivas();
      case 'comisionesPendientes':
        return this.contadores.comisionesPendientes();
      case 'stockBajo':
        return this.contadores.stockBajo();
    }
  }

  protected abrirBuscador(): void {
    this.buscador().abrir();
  }

  protected alternarMenu(): void {
    this.menuAbierto.update((v) => !v);
  }

  protected cerrarMenu(): void {
    this.menuAbierto.set(false);
  }

  protected alternarMenuUsuario(): void {
    this.menuUsuarioAbierto.update((v) => !v);
  }

  protected salir(): void {
    this.menuUsuarioAbierto.set(false);
    this.inactividad.detener();
    this.auth.logout();
  }

  protected iniciales(): string {
    const nombre = this.auth.nombreCompleto();

    return nombre
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((parte) => parte[0]?.toUpperCase() ?? '')
      .join('');
  }
}
