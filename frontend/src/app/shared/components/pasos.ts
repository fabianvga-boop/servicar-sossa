import { Component, input } from '@angular/core';

export interface Paso {
  etiqueta: string;
  /** Ya quedó atrás en el flujo. */
  completado: boolean;
  /** Es la posición actual del registro. */
  actual: boolean;
}

/**
 * Barra de progreso por etapas para flujos de estado (orden de trabajo).
 *
 * Una insignia sola dice en qué estado está el registro, pero no cuántos pasos
 * faltan ni cuál sigue. El stepper muestra el recorrido completo, así el
 * usuario sabe dónde está parado sin conocer de memoria las transiciones.
 */
@Component({
  selector: 'app-pasos',
  template: `
    <ol class="pasos" [class.anulado]="anulado()">
      @for (paso of pasos(); track paso.etiqueta) {
        <li
          class="paso"
          [class.completado]="paso.completado"
          [class.actual]="paso.actual"
          [attr.aria-current]="paso.actual ? 'step' : null"
        >
          <span class="marca" aria-hidden="true">
            {{ paso.completado ? '✓' : '' }}
          </span>
          <span class="texto">{{ paso.etiqueta }}</span>
        </li>
      }
    </ol>

    @if (anulado()) {
      <p class="aviso-anulado">{{ motivoAnulado() }}</p>
    }
  `,
  styles: `
    .pasos {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      list-style: none;
      margin: 0;
      padding: 0;
      counter-reset: paso;
    }

    .paso {
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 7px 14px 7px 11px;
      background: var(--gris-100);
      color: var(--gris-500);
      font-size: 12px;
      font-weight: 600;
      border-radius: var(--radio-sm);
    }

    .marca {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 17px;
      height: 17px;
      border-radius: 50%;
      border: 1.5px solid currentColor;
      font-size: 10px;
      font-weight: 700;
      flex-shrink: 0;
    }

    .paso.completado {
      background: var(--verde-100);
      color: #1f6b39;
    }

    .paso.completado .marca {
      background: var(--verde-600);
      border-color: var(--verde-600);
      color: var(--blanco);
    }

    .paso.actual {
      background: var(--brand);
      color: var(--blanco);
    }

    .paso.actual .marca {
      border-color: var(--blanco);
      /* Punto lleno: marca la posición sin repetir el tilde de "completado" */
      background: var(--blanco);
    }

    /* Cancelada saca a la orden del flujo: los pasos quedan como referencia muerta */
    .pasos.anulado .paso {
      opacity: 0.45;
      background: var(--gris-100);
      color: var(--gris-500);
    }

    .pasos.anulado .paso .marca {
      background: none;
      border-color: currentColor;
      color: var(--gris-500);
    }

    .aviso-anulado {
      margin: 8px 0 0;
      font-size: 12px;
      font-weight: 600;
      color: var(--brand-dk);
    }
  `,
})
export class Pasos {
  readonly pasos = input.required<Paso[]>();

  /** El registro salió del flujo (cancelado/anulado): los pasos se atenúan. */
  readonly anulado = input(false);
  readonly motivoAnulado = input('Este registro fue cancelado y no continúa el flujo.');
}
