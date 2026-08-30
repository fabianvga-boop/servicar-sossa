import { Component, input, output } from '@angular/core';

import { Modal } from './modal';

/**
 * Confirmación para acciones que no se pueden deshacer (cerrar una orden,
 * anular una factura, pagar comisiones). Evita repetir el mismo modal
 * en cada pantalla.
 */
@Component({
  selector: 'app-confirmacion',
  imports: [Modal],
  template: `
    <app-modal [titulo]="titulo()" [ancho]="440" (cerrar)="cancelar.emit()">
      <p class="mensaje">{{ mensaje() }}</p>

      @if (advertencia()) {
        <p class="advertencia">{{ advertencia() }}</p>
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
      font-size: 14px;
      color: var(--gris-700);
    }

    .advertencia {
      margin: 12px 0 0;
      padding: 10px 12px;
      background: var(--naranja-100);
      border-radius: var(--radio-sm);
      font-size: 12.5px;
      color: #92400e;
    }
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
  readonly cancelar = output<void>();
}
