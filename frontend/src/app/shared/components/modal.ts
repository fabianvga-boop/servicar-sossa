import { Component, input, output } from '@angular/core';

/**
 * Diálogo modal genérico. El contenido y los botones se proyectan:
 *
 *   <app-modal titulo="Nuevo cliente" (cerrar)="..."> ... </app-modal>
 */
@Component({
  selector: 'app-modal',
  template: `
    <div class="fondo" (click)="cerrar.emit()">
      <!-- El clic dentro del panel no debe cerrar el modal -->
      <div
        class="panel"
        [style.max-width.px]="ancho()"
        (click)="$event.stopPropagation()"
        role="dialog"
        aria-modal="true"
      >
        <div class="cabecera">
          <h2>{{ titulo() }}</h2>
          <button type="button" class="cerrar-btn" (click)="cerrar.emit()" aria-label="Cerrar">
            &times;
          </button>
        </div>

        <div class="cuerpo">
          <ng-content />
        </div>

        <div class="pie">
          <ng-content select="[pie]" />
        </div>
      </div>
    </div>
  `,
  styles: `
    .fondo {
      position: fixed;
      inset: 0;
      background: rgba(15, 41, 66, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 900;
      padding: 20px;
    }

    .panel {
      background: var(--blanco);
      border-radius: var(--radio);
      box-shadow: var(--sombra-lg);
      width: 100%;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      animation: aparecer 0.15s ease-out;
    }

    @keyframes aparecer {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .cabecera {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 15px 20px;
      border-bottom: 1px solid var(--gris-200);
    }

    .cabecera h2 { font-size: 16px; }

    .cerrar-btn {
      background: none;
      border: none;
      font-size: 24px;
      line-height: 1;
      cursor: pointer;
      color: var(--gris-400);
      padding: 0;
    }

    .cerrar-btn:hover { color: var(--gris-700); }

    .cuerpo {
      padding: 20px;
      overflow-y: auto;
      flex: 1;
    }

    .pie {
      padding: 14px 20px;
      border-top: 1px solid var(--gris-200);
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      background: var(--gris-50);
      border-radius: 0 0 var(--radio) var(--radio);
    }

    .pie:empty { display: none; }
  `,
})
export class Modal {
  readonly titulo = input.required<string>();
  readonly ancho = input(560);
  readonly cerrar = output<void>();
}
