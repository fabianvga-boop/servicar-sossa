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
      @for (paso of pasos(); track paso.etiqueta; let primero = $first) {
        <li
          class="paso"
          [class.completado]="paso.completado"
          [class.actual]="paso.actual"
          [class.alcanzado]="paso.completado || paso.actual"
          [attr.aria-current]="paso.actual ? 'step' : null"
        >
          <!-- Conector con el paso anterior; se colorea cuando el flujo lo alcanzó -->
          @if (!primero) {
            <span class="conector" aria-hidden="true"></span>
          }
          <span class="nodo" aria-hidden="true">
            @if (paso.completado) {
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            } @else {
              <span class="punto"></span>
            }
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
    /* Stepper horizontal: un círculo por etapa, unido al anterior por una línea.
       La línea y el círculo se colorean cuando el flujo ya alcanzó esa etapa, así
       "Cerrada" pinta todo el recorrido hasta el final. */
    .pasos {
      display: flex;
      list-style: none;
      margin: 0;
      padding: 4px 0 2px;
    }

    .paso {
      position: relative;
      flex: 1 1 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      min-width: 0;
      padding-top: 4px;
      font-size: 12px;
      font-weight: 600;
      color: var(--gris-500);
      text-align: center;
    }

    /* El conector arranca a la izquierda del círculo y llega al círculo previo */
    .conector {
      position: absolute;
      top: 18px; /* centro del círculo de 28px + padding-top */
      right: 50%;
      left: -50%;
      height: 3px;
      border-radius: 3px;
      background: var(--gris-200);
      z-index: 0;
    }

    .nodo {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--blanco);
      border: 2px solid var(--gris-300);
      color: var(--gris-400);
      flex-shrink: 0;
      transition: background 0.15s, border-color 0.15s, color 0.15s;
    }

    .nodo svg { width: 15px; height: 15px; }

    .punto {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: currentColor;
    }

    .texto {
      line-height: 1.25;
      max-width: 100%;
      overflow-wrap: anywhere;
    }

    /* Etapa ya superada: círculo verde con tilde y conector verde */
    .paso.completado { color: #1f6b39; }

    .paso.completado .nodo {
      background: var(--verde-600);
      border-color: var(--verde-600);
      color: var(--blanco);
    }

    /* Cualquier etapa alcanzada (superada o actual) pinta su conector de entrada */
    .paso.alcanzado .conector { background: var(--verde-600); }

    /* Etapa actual: círculo de marca, aro suave, etiqueta destacada */
    .paso.actual { color: var(--brand-dk); }

    .paso.actual .nodo {
      background: var(--brand);
      border-color: var(--brand);
      color: var(--blanco);
      box-shadow: 0 0 0 4px var(--brand-soft);
    }

    .paso.actual .punto { background: var(--blanco); }

    /* Cancelada saca a la orden del flujo: todo el recorrido queda apagado */
    .pasos.anulado .paso { opacity: 0.5; color: var(--gris-500); }

    .pasos.anulado .nodo {
      background: var(--gris-100);
      border-color: var(--gris-300);
      color: var(--gris-400);
      box-shadow: none;
    }

    .pasos.anulado .conector { background: var(--gris-200); }

    .aviso-anulado {
      margin: 12px 0 0;
      font-size: 12px;
      font-weight: 600;
      color: var(--brand-dk);
    }

    @media (max-width: 520px) {
      .paso { font-size: 11px; gap: 6px; }
      .nodo { width: 24px; height: 24px; }
      .conector { top: 16px; }
    }
  `,
})
export class Pasos {
  readonly pasos = input.required<Paso[]>();

  /** El registro salió del flujo (cancelado/anulado): los pasos se atenúan. */
  readonly anulado = input(false);
  readonly motivoAnulado = input('Este registro fue cancelado y no continúa el flujo.');
}
