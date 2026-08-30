import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { Cliente, Vehiculo } from '../../core/models/personas.model';
import { Repuesto } from '../../core/models/inventario.model';
import { Orden } from '../../core/models/taller.model';
import { AuthService } from '../../core/services/auth.service';
import { ClientesService } from '../../core/services/clientes.service';
import { RepuestosService } from '../../core/services/inventario.service';
import { OrdenesService } from '../../core/services/ordenes.service';
import { VehiculosService } from '../../core/services/vehiculos.service';

interface Resultado {
  grupo: string;
  icono: string;
  etiqueta: string;
  detalle: string;
  ruta: string;
  /** Query params, para los accesos que abren un listado ya filtrado. */
  parametros?: Record<string, string>;
}

const DIACRITICOS = new RegExp(
  `[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`,
  'g',
);

function normalizar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(DIACRITICOS, '');
}

/**
 * Buscador global (Ctrl+K). Cruza órdenes, clientes, vehículos y repuestos en
 * un solo campo, más los atajos de navegación a cada módulo.
 *
 * Cada listado tiene su propio filtro, pero eso obliga a saber de antemano en
 * qué módulo está lo que se busca. Acá se escribe una placa o un apellido y el
 * sistema dice dónde vive ese dato.
 *
 * Los datos se traen una sola vez por sesión al primer Ctrl+K: el taller maneja
 * volúmenes chicos y filtrar en memoria evita una petición por cada tecla.
 */
@Component({
  selector: 'app-buscador-global',
  host: {
    '(document:keydown)': 'alTeclearGlobal($event)',
  },
  template: `
    @if (abierto()) {
      <div class="fondo" (click)="cerrar()">
        <div class="panel" (click)="$event.stopPropagation()">
          <div class="campo-busqueda">
            <span class="lupa" aria-hidden="true">⌕</span>
            <input
              #campo
              type="text"
              autocomplete="off"
              placeholder="Buscar orden, cliente, placa o repuesto…"
              aria-label="Búsqueda global"
              [value]="consulta()"
              (input)="alEscribir($any($event.target).value)"
              (keydown)="alTeclearPanel($event)"
            />
            <kbd>Esc</kbd>
          </div>

          @if (cargando()) {
            <div class="mensaje">Cargando datos del taller…</div>
          } @else if (resultados().length === 0) {
            <div class="mensaje">
              @if (consulta().trim()) {
                Sin coincidencias para «{{ consulta() }}».
              } @else {
                Escriba para buscar en todo el sistema.
              }
            </div>
          } @else {
            <ul class="resultados" role="listbox">
              @for (item of resultados(); track item.ruta + item.etiqueta; let i = $index) {
                @if (i === 0 || resultados()[i - 1].grupo !== item.grupo) {
                  <li class="grupo" role="presentation">{{ item.grupo }}</li>
                }
                <li
                  role="option"
                  [attr.aria-selected]="i === resaltado()"
                  [class.resaltado]="i === resaltado()"
                  (mouseenter)="resaltado.set(i)"
                  (click)="ir(item)"
                >
                  <span class="icono" aria-hidden="true">{{ item.icono }}</span>
                  <span class="etiqueta">{{ item.etiqueta }}</span>
                  <span class="detalle">{{ item.detalle }}</span>
                </li>
              }
            </ul>
          }

          <div class="pie">
            <span><kbd>↑</kbd><kbd>↓</kbd> navegar</span>
            <span><kbd>↵</kbd> abrir</span>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .fondo {
      position: fixed;
      inset: 0;
      z-index: 900;
      background: rgba(12, 14, 18, 0.5);
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 12vh 16px 16px;
    }

    .panel {
      width: 100%;
      max-width: 560px;
      background: var(--blanco);
      border-radius: var(--radio);
      box-shadow: var(--sombra-lg);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      max-height: 70vh;
    }

    .campo-busqueda {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 14px;
      border-bottom: 1px solid var(--gris-200);
      flex-shrink: 0;
    }

    .lupa { font-size: 19px; color: var(--gris-400); }

    .campo-busqueda input {
      border: none;
      background: none;
      padding: 0;
      font-size: 15px;
    }

    .campo-busqueda input:focus { outline: none; }

    kbd {
      font-family: inherit;
      font-size: 10px;
      font-weight: 600;
      color: var(--gris-500);
      background: var(--gris-100);
      border: 1px solid var(--gris-200);
      border-radius: 4px;
      padding: 2px 5px;
    }

    .resultados {
      list-style: none;
      margin: 0;
      padding: 5px;
      overflow-y: auto;
    }

    .grupo {
      padding: 9px 10px 4px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--gris-400);
    }

    .resultados li[role='option'] {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-radius: var(--radio-sm);
      font-size: 13px;
      cursor: pointer;
    }

    .resultados li.resaltado { background: var(--gris-100); }

    .icono { width: 18px; text-align: center; flex-shrink: 0; }
    .etiqueta { font-weight: 500; }

    .detalle {
      margin-left: auto;
      font-size: 11.5px;
      color: var(--gris-500);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .mensaje {
      padding: 28px 16px;
      text-align: center;
      font-size: 13px;
      color: var(--gris-500);
    }

    .pie {
      display: flex;
      gap: 16px;
      padding: 8px 14px;
      border-top: 1px solid var(--gris-200);
      background: var(--gris-50);
      font-size: 11px;
      color: var(--gris-500);
      flex-shrink: 0;
    }

    .pie kbd { margin-right: 3px; }
  `,
})
export class BuscadorGlobal {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly ordenesService = inject(OrdenesService);
  private readonly clientesService = inject(ClientesService);
  private readonly vehiculosService = inject(VehiculosService);
  private readonly repuestosService = inject(RepuestosService);

  protected readonly abierto = signal(false);
  protected readonly cargando = signal(false);
  protected readonly consulta = signal('');
  protected readonly resaltado = signal(0);

  private readonly ordenes = signal<Orden[]>([]);
  private readonly clientes = signal<Cliente[]>([]);
  private readonly vehiculos = signal<Vehiculo[]>([]);
  private readonly repuestos = signal<Repuesto[]>([]);
  private cargado = false;

  /** Destinos fijos: sirven de atajo de navegación además de la búsqueda. */
  private readonly destinos: { etiqueta: string; ruta: string; icono: string; soloAdmin: boolean }[] =
    [
      { etiqueta: 'Panel', ruta: '/dashboard', icono: '▦', soloAdmin: false },
      { etiqueta: 'Órdenes de trabajo', ruta: '/ordenes', icono: '🗂', soloAdmin: false },
      { etiqueta: 'Diagnósticos', ruta: '/diagnosticos', icono: '🔧', soloAdmin: false },
      { etiqueta: 'Catálogo de servicios', ruta: '/tipos-servicio', icono: '⚙', soloAdmin: false },
      { etiqueta: 'Clientes', ruta: '/clientes', icono: '👤', soloAdmin: true },
      { etiqueta: 'Vehículos', ruta: '/vehiculos', icono: '🚗', soloAdmin: false },
      { etiqueta: 'Repuestos', ruta: '/repuestos', icono: '📦', soloAdmin: false },
      { etiqueta: 'Proveedores', ruta: '/proveedores', icono: '🏭', soloAdmin: true },
      { etiqueta: 'Compras', ruta: '/compras', icono: '🛒', soloAdmin: true },
      { etiqueta: 'Punto de venta', ruta: '/ventas', icono: '🏪', soloAdmin: true },
      { etiqueta: 'Proformas', ruta: '/proformas', icono: '🧾', soloAdmin: true },
      { etiqueta: 'Pagos', ruta: '/pagos', icono: '💵', soloAdmin: true },
      { etiqueta: 'Comisiones', ruta: '/comisiones', icono: '%', soloAdmin: true },
      { etiqueta: 'Usuarios', ruta: '/usuarios', icono: '🔑', soloAdmin: true },
      { etiqueta: 'Reportes', ruta: '/reportes', icono: '📊', soloAdmin: true },
      { etiqueta: 'Auditoría', ruta: '/auditoria', icono: '🕵', soloAdmin: true },
    ];

  protected readonly resultados = computed<Resultado[]>(() => {
    const criterio = normalizar(this.consulta().trim());
    if (!criterio) return [];

    const coincide = (...campos: (string | null | undefined)[]) =>
      campos.some((c) => c && normalizar(c).includes(criterio));

    const esAdmin = this.auth.esAdministrador();
    const salida: Resultado[] = [];

    for (const orden of this.ordenes()) {
      if (!coincide(orden.ordenId, orden.placaVehiculo, orden.nombreCliente)) continue;
      salida.push({
        grupo: 'Órdenes',
        icono: '🗂',
        etiqueta: orden.ordenId,
        detalle: `${orden.placaVehiculo} · ${orden.nombreCliente}`,
        ruta: `/ordenes/${orden.ordenId}`,
      });
    }

    for (const cliente of this.clientes()) {
      // La razón social manda cuando el cliente es una empresa.
      const nombre =
        cliente.razonSocial?.trim() ||
        `${cliente.nombre} ${cliente.apellido ?? ''}`.trim();

      if (!coincide(nombre, cliente.ciNit, cliente.telefono)) continue;

      salida.push({
        grupo: 'Clientes',
        icono: '👤',
        etiqueta: nombre,
        detalle: cliente.ciNit,
        ruta: '/clientes',
        parametros: { buscar: cliente.ciNit },
      });
    }

    for (const vehiculo of this.vehiculos()) {
      if (!coincide(vehiculo.placa, vehiculo.marca, vehiculo.modelo, vehiculo.nombreCliente))
        continue;
      salida.push({
        grupo: 'Vehículos',
        icono: '🚗',
        etiqueta: vehiculo.placa,
        detalle: `${vehiculo.marca} ${vehiculo.modelo} · ${vehiculo.nombreCliente}`,
        ruta: '/vehiculos',
        parametros: { buscar: vehiculo.placa },
      });
    }

    for (const repuesto of this.repuestos()) {
      if (!coincide(repuesto.nombre, repuesto.descripcion)) continue;
      salida.push({
        grupo: 'Repuestos',
        icono: '📦',
        etiqueta: repuesto.nombre,
        detalle: `stock ${repuesto.stockActual}`,
        ruta: '/repuestos',
        parametros: { buscar: repuesto.nombre },
      });
    }

    for (const destino of this.destinos) {
      if (destino.soloAdmin && !esAdmin) continue;
      if (!coincide(destino.etiqueta)) continue;
      salida.push({
        grupo: 'Ir a',
        icono: destino.icono,
        etiqueta: destino.etiqueta,
        detalle: '',
        ruta: destino.ruta,
      });
    }

    // Tope para que el panel no se vuelva una lista interminable de scroll.
    return salida.slice(0, 25);
  });

  // --- Apertura y atajos ---------------------------------------------------

  abrir(): void {
    this.abierto.set(true);
    this.consulta.set('');
    this.resaltado.set(0);
    this.precargar();

    // El input existe recién después de que Angular pinta el panel.
    setTimeout(() => document.querySelector<HTMLInputElement>('.campo-busqueda input')?.focus());
  }

  protected cerrar(): void {
    this.abierto.set(false);
  }

  protected alTeclearGlobal(evento: KeyboardEvent): void {
    if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 'k') {
      evento.preventDefault();
      this.abierto() ? this.cerrar() : this.abrir();
    }
  }

  protected alEscribir(texto: string): void {
    this.consulta.set(texto);
    this.resaltado.set(0);
  }

  protected alTeclearPanel(evento: KeyboardEvent): void {
    const total = this.resultados().length;

    switch (evento.key) {
      case 'ArrowDown':
        evento.preventDefault();
        if (total > 0) this.resaltado.update((i) => (i + 1) % total);
        break;

      case 'ArrowUp':
        evento.preventDefault();
        if (total > 0) this.resaltado.update((i) => (i - 1 + total) % total);
        break;

      case 'Enter': {
        evento.preventDefault();
        const item = this.resultados()[this.resaltado()];
        if (item) this.ir(item);
        break;
      }

      case 'Escape':
        this.cerrar();
        break;
    }
  }

  protected ir(item: Resultado): void {
    this.cerrar();
    void this.router.navigate([item.ruta], { queryParams: item.parametros });
  }

  /**
   * Trae el catálogo una sola vez por sesión. Cada rama va protegida porque el
   * mecánico no tiene acceso a clientes y su 403 no debe vaciar el resto.
   */
  private precargar(): void {
    if (this.cargado) return;
    this.cargado = true;
    this.cargando.set(true);

    forkJoin({
      ordenes: this.ordenesService.getAll().pipe(catchError(() => of([] as Orden[]))),
      clientes: this.auth.esAdministrador()
        ? this.clientesService.getAll().pipe(catchError(() => of([] as Cliente[])))
        : of([] as Cliente[]),
      vehiculos: this.vehiculosService.getAll().pipe(catchError(() => of([] as Vehiculo[]))),
      repuestos: this.repuestosService.getAll().pipe(catchError(() => of([] as Repuesto[]))),
    }).subscribe(({ ordenes, clientes, vehiculos, repuestos }) => {
      this.ordenes.set(ordenes);
      this.clientes.set(clientes);
      this.vehiculos.set(vehiculos);
      this.repuestos.set(repuestos);
      this.cargando.set(false);
    });
  }
}
