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
      <app-modal titulo="Atajos de teclado" [ancho]="760" icono="teclado" (cerrar)="cerrar.emit()">
        <span subtitulo class="subtitulo">Para trabajar sin soltar el teclado en el mostrador.</span>

        <div class="columnas">
          @for (grupo of grupos; track grupo.titulo) {
            <section class="grupo">
              <h3>{{ grupo.titulo }}</h3>
              @for (atajo of grupo.atajos; track atajo.accion) {
                <div class="fila">
                  <span>{{ atajo.accion }}</span>
                  <span class="teclas">
                    @for (tecla of atajo.teclas; track $index) {
                      <kbd>{{ tecla }}</kbd>
                    }
                  </span>
                </div>
              }
            </section>
          }
        </div>

        <div pie class="pie-ayuda">
          Pulse <kbd>?</kbd> en cualquier pantalla para volver a ver esta lista.
        </div>
      </app-modal>
    }
  `,
  styles: `
    .subtitulo { font-size: 13px; color: var(--gris-500); }

    /* Dos columnas que se reparten los grupos sin cortarlos */
    .columnas {
      columns: 2;
      column-gap: 32px;
    }

    .grupo {
      break-inside: avoid;
      margin-bottom: 16px;
    }

    .grupo h3 {
      margin: 0 0 4px;
      font-size: 11.5px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--gris-400);
    }

    .fila {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 9px 0;
      border-bottom: 1px dashed var(--gris-200);
      font-size: 13.5px;
      color: var(--ink-soft);
    }

    .teclas { display: flex; gap: 4px; flex-shrink: 0; }

    kbd {
      display: inline-grid;
      place-items: center;
      min-width: 26px;
      height: 26px;
      padding: 0 7px;
      border: 1px solid var(--gris-300);
      border-bottom-width: 2px;
      border-radius: 7px;
      background: var(--blanco);
      font-family: var(--fuente-mono);
      font-size: 12px;
      font-weight: 500;
      color: var(--ink);
    }

    .pie-ayuda {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-right: auto;
      font-size: 12.5px;
      color: var(--gris-500);
    }

    @media (max-width: 700px) {
      .columnas { columns: 1; }
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
