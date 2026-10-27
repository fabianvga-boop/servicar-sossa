import { Component, input, output } from '@angular/core';

import { Modal } from '../shared/components/modal';

interface Atajo {
  teclas: string[];
  accion: string;
}

interface GrupoAtajos {
  titulo: string;
  atajos: Atajo[];
}

/**
 * Todos los atajos de teclado del sistema en un solo lugar. Se abre con la
 * tecla “?” o con el botón de la barra superior. Sirve para capacitar a quien
 * recién empieza y como referencia rápida en el mostrador.
 */
@Component({
  selector: 'app-ayuda-atajos',
  imports: [Modal],
  template: `
    @if (abierta()) {
      <app-modal titulo="Atajos de teclado" [ancho]="560" (cerrar)="cerrar.emit()">
        @for (grupo of grupos; track grupo.titulo) {
          <h3 class="grupo">{{ grupo.titulo }}</h3>
          <table class="atajos">
            <tbody>
              @for (atajo of grupo.atajos; track atajo.accion) {
                <tr>
                  <td class="teclas">
                    @for (tecla of atajo.teclas; track $index) {
                      @if ($index > 0) { <span class="mas">+</span> }
                      <kbd>{{ tecla }}</kbd>
                    }
                  </td>
                  <td>{{ atajo.accion }}</td>
                </tr>
              }
            </tbody>
          </table>
        }
        <div pie>
          <button type="button" class="btn btn-secundario" (click)="cerrar.emit()">Cerrar</button>
        </div>
      </app-modal>
    }
  `,
  styles: `
    .grupo {
      margin: 14px 0 6px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--gris-500);
    }

    .grupo:first-of-type { margin-top: 0; }

    .atajos { width: 100%; border-collapse: collapse; font-size: 14px; }

    .atajos td {
      padding: 7px 4px;
      border-bottom: 1px solid var(--gris-100);
      color: var(--ink-soft);
      vertical-align: middle;
    }

    .teclas { width: 160px; white-space: nowrap; }

    .mas { margin: 0 3px; color: var(--gris-500); }

    kbd {
      display: inline-block;
      min-width: 26px;
      padding: 2px 7px;
      border: 1px solid var(--gris-300);
      border-bottom-width: 2px;
      border-radius: 5px;
      background: var(--gris-50);
      font-family: 'IBM Plex Mono', monospace;
      font-size: 12.5px;
      text-align: center;
      color: var(--ink);
    }
  `,
})
export class AyudaAtajos {
  readonly abierta = input(false);
  readonly cerrar = output<void>();

  protected readonly grupos: GrupoAtajos[] = [
    {
      titulo: 'En todo el sistema',
      atajos: [
        { teclas: ['Ctrl', 'K'], accion: 'Buscar órdenes, clientes, placas o repuestos' },
        { teclas: ['?'], accion: 'Ver esta lista de atajos' },
        { teclas: ['Esc'], accion: 'Cerrar la ventana o la lista abierta' },
        { teclas: ['Tab'], accion: 'Pasar al campo siguiente (Mayús + Tab: al anterior)' },
      ],
    },
    {
      titulo: 'En cada pantalla',
      atajos: [
        {
          teclas: ['N'],
          accion: 'Nuevo registro: cliente, vehículo, diagnóstico, repuesto, compra, pago…',
        },
      ],
    },
    {
      titulo: 'En las listas con búsqueda y en el buscador',
      atajos: [
        { teclas: ['↑', '↓'], accion: 'Moverse entre las opciones' },
        { teclas: ['Enter'], accion: 'Elegir la opción marcada' },
      ],
    },
    {
      titulo: 'En el punto de venta',
      atajos: [
        { teclas: ['Enter'], accion: 'Agregar al carrito el producto buscado (si queda uno solo o es su código)' },
        { teclas: ['Esc'], accion: 'Limpiar la búsqueda para el siguiente producto' },
      ],
    },
  ];
}
