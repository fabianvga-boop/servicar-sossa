import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { Rol } from '../core/models/enums';
import { urlArchivo } from '../core/services/api-base';
import { AuthService } from '../core/services/auth.service';
import { ContadoresService } from '../core/services/contadores.service';
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
  protected readonly urlArchivo = urlArchivo;

  private readonly buscador = viewChild.required(BuscadorGlobal);

  /** En móvil la barra lateral se oculta y se despliega con el botón. */
  protected readonly menuAbierto = signal(false);
  protected readonly menuUsuarioAbierto = signal(false);

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
