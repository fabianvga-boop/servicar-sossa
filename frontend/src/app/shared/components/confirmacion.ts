import { Component, computed, input, output } from '@angular/core';

import { Modal } from './modal';
import { TextoResaltado } from './texto-resaltado';

/**
 * Confirmación para acciones que no se pueden deshacer (cerrar una orden,
 * anular una proforma, pagar comisiones). Evita repetir el mismo modal
 * en cada pantalla.
 */
@Component({
  selector: 'app-confirmacion',
  imports: [Modal, TextoResaltado],
  template: `
    <app-modal
      [titulo]="titulo()"
      [ancho]="500"
      [icono]="peligroso() ? 'peligro' : 'atencion'"
      [compacto]="true"
      (cerrar)="cancelar.emit()"
    >
      <p subtitulo class="mensaje"><app-texto-resaltado [texto]="mensaje()" /></p>

      @if (renglones().length > 0) {
        <!-- La advertencia de cada pantalla, una oración por renglón; la que
             dice que no se puede deshacer va en rojo. -->
        <ul class="efectos">
          @for (r of renglones(); track $index) {
            <li [class.grave]="r.grave">
              @if (r.grave) {
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
              } @else {
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" /><path d="M12 16v-5" /><path d="M12 8h.01" />
                </svg>
              }
              <span><app-texto-resaltado [texto]="r.texto" /></span>
            </li>
          }
        </ul>
      }

      <div pie>
        <button type="button" class="btn btn-secundario" (click)="cancelar.emit()">
          Cancelar
        </button>
        <button
          type="button"
          class="btn"
          [class.btn-peligro]="peligroso()"
          [class.btn-primario]="!peligroso()"
          [disabled]="procesando()"
          (click)="confirmar.emit()"
        >
          {{ procesando() ? 'Procesando…' : textoConfirmar() }}
        </button>
      </div>
    </app-modal>
  `,
  styles: `
    .mensaje {
      margin: 0;
      font-size: 14.5px;
      line-height: 1.5;
      color: var(--ink-soft);
    }

    .efectos {
      margin: 6px 0 0;
      padding: 2px 0;
      list-style: none;
      border: 1px solid var(--gris-200);
      border-radius: var(--radio-md);
      background: var(--gris-50);
    }

    .efectos li {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 14px;
      font-size: 13.5px;
      line-height: 1.45;
      color: var(--ink-soft);
    }

    .efectos li + li { border-top: 1px solid var(--gris-200); }

    .efectos svg {
      width: 16px;
      height: 16px;
      margin-top: 2px;
      flex-shrink: 0;
      color: var(--gris-500);
    }

    .efectos li.grave { color: var(--brand-dk); font-weight: 500; }
    .efectos li.grave svg { color: var(--brand); }
  `,
})
export class Confirmacion {
  readonly titulo = input.required<string>();
  readonly mensaje = input.required<string>();

  /** Texto extra para explicar por qué la acción es irreversible. */
  readonly advertencia = input<string | null>(null);
  readonly textoConfirmar = input('Confirmar');
  readonly peligroso = input(false);
  readonly procesando = input(false);

  readonly confirmar = output<void>();

  /**
   * La advertencia partida en oraciones, para leerla como lista corta. Se
   * marca en rojo la que avisa que algo no tiene vuelta atrás.
   */
  protected readonly renglones = computed(() =>
    (this.advertencia() ?? '')
      .split(/(?<=[.!?])\s+/)
      .map((texto) => texto.trim())
      .filter((texto) => texto.length > 0)
      .map((texto) => ({
        texto,
        grave: /no se puede|no podr[áa]|irreversible|no tiene vuelta/i.test(texto),
      })),
  );
  readonly cancelar = output<void>();
}
