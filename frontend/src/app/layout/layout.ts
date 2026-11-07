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

import { DATOS_TALLER } from '../core/datos-taller';
import { Rol } from '../core/models/enums';
import { urlArchivo } from '../core/services/api-base';
import { AuthService } from '../core/services/auth.service';
import { ContadoresService } from '../core/services/contadores.service';
import { InactividadService } from '../core/services/inactividad.service';
import { AvisoInactividad } from './aviso-inactividad';
import { AyudaAtajos } from './ayuda-atajos';
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
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    BuscadorGlobal,
    IconoMenu,
    AvisoInactividad,
    AyudaAtajos,
  ],
  templateUrl: './layout.html',
  styleUrl: './layout.css',
  host: {
    '(document:keydown)': 'alTeclear($event)',
    '(document:click)': 'alClicDocumento($event)',
  },
})
export class Layout {
  protected readonly auth = inject(AuthService);
  protected readonly contadores = inject(ContadoresService);
  private readonly inactividad = inject(InactividadService);
  private readonly router = inject(Router);
  protected readonly urlArchivo = urlArchivo;
  protected readonly taller = DATOS_TALLER;

  private readonly buscador = viewChild.required(BuscadorGlobal);

  /** En móvil la barra lateral se oculta y se despliega con el botón. */
  protected readonly menuAbierto = signal(false);
  protected readonly menuUsuarioAbierto = signal(false);

  /** Ventana con todos los atajos de teclado (tecla “?” o botón de la barra). */
  protected readonly ayudaAtajos = signal(false);

  protected alTeclear(evento: KeyboardEvent): void {
    if (evento.key === 'Escape' && (this.masAbierto() || this.nuevoAbierto())) {
      this.cerrarHojas();
      return;
    }
    if (evento.key !== '?' || evento.ctrlKey || evento.metaKey || evento.altKey) return;

    // Escribiendo en un campo, el "?" es texto; con un diálogo abierto, no se apila otro.
    const destino = evento.target as HTMLElement | null;
    const escribiendo =
      !!destino &&
      (destino.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(destino.tagName));
    if (escribiendo || document.querySelector('[aria-modal="true"]')) return;

    evento.preventDefault();
    this.ayudaAtajos.set(true);
  }

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
        { ruta: '/agenda', etiqueta: 'Agenda', icono: 'agenda' },
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

  /** Grupo del menú de la sección activa ("Operación", "Almacén"…), para las migas. */
  protected readonly grupoSeccion = toSignal(
    this.router.events.pipe(
      filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd),
      map(() => this.grupoDesdeUrl(this.router.url)),
    ),
    { initialValue: this.grupoDesdeUrl(this.router.url) },
  );

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

  // --- Barra de abajo en el celular ---------------------------------------------

  /** "Más": el resto del menú, la cuenta y cerrar sesión, a pantalla completa. */
  protected readonly masAbierto = signal(false);
  /** "Nuevo": hoja con lo que se puede registrar desde cualquier pantalla. */
  protected readonly nuevoAbierto = signal(false);

  private readonly rutaActual = toSignal(
    this.router.events.pipe(
      filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd),
      map((evento) => evento.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /** Pestaña marcada: las tres fijas, o "Más" para cualquier otra pantalla. */
  protected readonly pestaniaActiva = computed(() => {
    if (this.masAbierto()) return 'mas';
    const ruta = this.rutaActual().split('?')[0];
    if (ruta.startsWith('/dashboard')) return 'panel';
    if (ruta.startsWith('/ordenes')) return 'ordenes';
    if (ruta.startsWith('/repuestos')) return 'repuestos';
    return 'mas';
  });

  /** El menú de "Más": todo menos lo que ya está en la barra. */
  protected readonly menuMas = computed(() =>
    this.menu()
      .map((grupo) => ({
        ...grupo,
        enlaces: grupo.enlaces.filter((e) => !['/dashboard', '/ordenes', '/repuestos'].includes(e.ruta)),
      }))
      .filter((grupo) => grupo.enlaces.length > 0),
  );

  protected readonly accionesNuevo = computed(() => {
    const acciones = [
      {
        titulo: 'Diagnóstico',
        detalle: 'Recibir un vehículo y anotar la falla',
        icono: 'M14 7a4 4 0 1 1-5.6 3.7L4 15v5h5l4.3-4.4A4 4 0 0 1 14 7z',
        tono: 'rojo',
        ruta: '/diagnosticos',
        parametros: { nuevo: 'true' } as Record<string, string>,
      },
    ];
    if (this.auth.esAdministrador()) {
      acciones.push(
        {
          titulo: 'Venta de mostrador',
          detalle: 'Vender repuestos sin orden de trabajo',
          icono: 'M4 6h16l-2 9H6zM9 20h.01M17 20h.01',
          tono: 'azul',
          ruta: '/ventas',
          parametros: {},
        },
        {
          titulo: 'Compra',
          detalle: 'Ingresar repuestos al inventario',
          icono: 'M12 3 4 7.5v9L12 21l8-4.5v-9zM12 12v9',
          tono: 'verde',
          ruta: '/compras',
          parametros: { nueva: 'true' },
        },
        {
          titulo: 'Cliente',
          detalle: 'Registrar un cliente con su vehículo',
          icono: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
          tono: 'gris',
          ruta: '/clientes',
          parametros: { nuevo: 'true' },
        },
      );
    }
    return acciones;
  });

  protected cerrarHojas(): void {
    this.masAbierto.set(false);
    this.nuevoAbierto.set(false);
  }

  // --- Volver al módulo de donde se vino -----------------------------------------

  /**
   * "Volver a Clientes": aparece cuando un enlace lleva de un módulo a otro
   * (la ficha de un vehículo desde Clientes, una orden desde Vehículos…) y
   * regresa a la dirección exacta de antes, con el cliente o el filtro que
   * estaba abierto. Entrar por el menú lo quita: ahí no hay de dónde volver.
   */
  protected readonly pilaVolver = signal<{ url: string; etiqueta: string }[]>([]);
  /** El botón muestra el último módulo de la cadena (Clientes → Vehículos → Repuestos). */
  protected readonly volver = computed(() => this.pilaVolver().at(-1) ?? null);
  private urlAnterior = this.router.url;
  private tituloAnterior = this.tituloDesdeRuta() ?? '';

  private actualizarVolver(url: string): void {
    const ruta = url.split(/[?#]/)[0];
    const modulo = (u: string) => u.split(/[?#]/)[0].split('/')[1] ?? '';
    // Una pantalla principal sin filtros (/clientes, /perfil…) es entrar desde el menú.
    const desdeMenu = !url.includes('?') && ruta.split('/').filter(Boolean).length <= 1;

    if (desdeMenu) {
      this.pilaVolver.set([]);
    } else {
      const pila = this.pilaVolver();
      // Si se vuelve a un módulo de la cadena, se corta ahí: Volver lleva al anterior.
      const indice = pila.findIndex((p) => modulo(p.url) === modulo(url));
      if (indice >= 0) {
        this.pilaVolver.set(pila.slice(0, indice));
      } else if (modulo(url) !== modulo(this.urlAnterior) && this.tituloAnterior) {
        this.pilaVolver.set([...pila, { url: this.urlAnterior, etiqueta: this.tituloAnterior }]);
      }
    }

    this.urlAnterior = url;
    this.tituloAnterior = this.tituloDesdeRuta() ?? '';
  }

  protected irAVolver(): void {
    const destino = this.volver();
    if (destino) void this.router.navigateByUrl(destino.url);
  }

  constructor() {
    // Al cambiar de pantalla se cierran "Más" y "Nuevo".
    this.router.events
      .pipe(filter((evento) => evento instanceof NavigationEnd))
      .subscribe(() => this.cerrarHojas());

    this.router.events
      .pipe(filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd))
      .subscribe((evento) => this.actualizarVolver(evento.urlAfterRedirects));

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

  /** El grupo cuyo enlace coincide con el comienzo de la dirección actual. */
  private grupoDesdeUrl(url: string): string | null {
    const ruta = url.split(/[?#]/)[0];
    for (const grupo of this.grupos) {
      if (!grupo.titulo) continue;
      if (grupo.enlaces.some((e) => ruta === e.ruta || ruta.startsWith(e.ruta + '/'))) return grupo.titulo;
    }
    return null;
  }

  /** El menú de la cuenta se cierra al hacer clic en cualquier otro lado. */
  protected alClicDocumento(evento: MouseEvent): void {
    if (!this.menuUsuarioAbierto()) return;
    const destino = evento.target as HTMLElement | null;
    if (!destino?.closest('.usuario')) this.menuUsuarioAbierto.set(false);
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
