import { Component, inject } from '@angular/core';

import { NotificacionService } from '../../core/services/notificacion.service';

/** Pila de avisos flotantes. Se monta una sola vez, en la raíz de la aplicación. */
@Component({
  selector: 'app-avisos',
  template: `
    <div class="pila">
      @for (aviso of notificacion.avisos(); track aviso.id) {
        <div class="aviso" [class]="'aviso-' + aviso.tipo">
          <span class="crece">{{ aviso.mensaje }}</span>
          @if (aviso.accion; as accion) {
            <button
              type="button"
              class="accion"
              (click)="notificacion.ejecutarAccion(aviso)"
            >
              {{ accion.etiqueta }}
            </button>
          }
          <button
            type="button"
            class="cerrar"
            (click)="notificacion.cerrar(aviso.id)"
            aria-label="Cerrar aviso"
          >
            &times;
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .pila {
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-width: 380px;
    }

    .aviso {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 11px 14px;
      border-radius: var(--radio-sm);
      box-shadow: var(--sombra-md);
      font-size: 13px;
      border-left: 4px solid;
      background: var(--blanco);
      animation: entrar 0.18s ease-out;
    }

    @keyframes entrar {
      from { opacity: 0; transform: translateX(16px); }
      to { opacity: 1; transform: translateX(0); }
    }

    .aviso-exito { border-left-color: var(--verde-600); }
    .aviso-error { border-left-color: var(--brand-dk); }
    .aviso-advertencia { border-left-color: var(--naranja-600); }
    .aviso-info { border-left-color: var(--azul-600); }

    .accion {
      background: none;
      border: 1px solid var(--gris-200);
      border-radius: var(--radio-sm);
      padding: 3px 9px;
      font-family: inherit;
      font-size: 11.5px;
      font-weight: 700;
      color: var(--brand-dk);
      cursor: pointer;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .accion:hover { background: var(--brand-soft); }

    .cerrar {
      background: none;
      border: none;
      font-size: 18px;
      line-height: 1;
      cursor: pointer;
      color: var(--gris-400);
      padding: 0;
    }

    .cerrar:hover { color: var(--ink-soft); }

    @media (max-width: 480px) {
      .pila { left: 16px; right: 16px; max-width: none; }
    }
  `,
})
export class Avisos {
  protected readonly notificacion = inject(NotificacionService);
}
