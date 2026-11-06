import { Component, inject } from '@angular/core';

import { NotificacionService, TipoAviso } from '../../core/services/notificacion.service';
import { TextoResaltado } from './texto-resaltado';

/** Título corto de cada tipo: se entiende qué pasó antes de leer el detalle. */
const TITULOS: Record<TipoAviso, string> = {
  exito: 'Listo',
  error: 'No se pudo completar',
  advertencia: 'Atención',
  info: 'Aviso',
};

/**
 * Pila de avisos flotantes. Se monta una sola vez, en la raíz de la aplicación.
 *
 * Tarjeta blanca como el resto del sistema: el color del tipo queda en el
 * ícono y en la línea de abajo, que se acorta hasta que el aviso se cierra
 * solo (los errores duran más; ver NotificacionService).
 */
@Component({
  selector: 'app-avisos',
  imports: [TextoResaltado],
  template: `
    <div class="pila">
      @for (aviso of notificacion.avisos(); track aviso.id) {
        <div
          class="aviso"
          [class]="'aviso-' + aviso.tipo"
          [attr.role]="aviso.tipo === 'error' || aviso.tipo === 'advertencia' ? 'alert' : 'status'"
        >
          <span class="icono" aria-hidden="true">
            @switch (aviso.tipo) {
              @case ('exito') {
                <svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" /></svg>
              }
              @case ('error') {
                <svg viewBox="0 0 24 24"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
              }
              @case ('advertencia') {
                <svg viewBox="0 0 24 24">
                  <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                  <path d="M12 9v4" /><path d="M12 17h.01" />
                </svg>
              }
              @default {
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 16v-5" /><path d="M12 8h.01" /></svg>
              }
            }
          </span>

          <div class="cuerpo">
            <strong class="titulo">{{ titulos[aviso.tipo] }}</strong>
            <span class="mensaje"><app-texto-resaltado [texto]="aviso.mensaje" /></span>
            @if (aviso.accion; as accion) {
              <button type="button" class="accion" (click)="notificacion.ejecutarAccion(aviso)">
                {{ accion.etiqueta }}
              </button>
            }
          </div>

          <button
            type="button"
            class="cerrar"
            (click)="notificacion.cerrar(aviso.id)"
            aria-label="Cerrar aviso"
          >
            <svg viewBox="0 0 24 24"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
          </button>

          <!-- Cuánto le queda al aviso antes de cerrarse solo -->
          <span class="tiempo" [style.animation-duration.ms]="aviso.duracionMs" aria-hidden="true"></span>
        </div>
      }
    </div>
  `,
  styles: `
    .pila {
      position: fixed;
      top: calc(var(--alto-encabezado, 64px) + 12px);
      right: 20px;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 10px;
      width: 380px;
      max-width: calc(100vw - 32px);
    }

    .aviso {
      --tono: var(--azul-600);
      --tono-fondo: var(--azul-100);

      position: relative;
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: start;
      gap: 12px;
      padding: 14px 12px 16px 14px;
      overflow: hidden;
      border: 1px solid var(--gris-200);
      border-radius: 14px;
      background: var(--blanco);
      box-shadow: 0 16px 34px -18px rgba(21, 26, 34, 0.38);
      animation: entrar 0.22s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .aviso-exito { --tono: var(--verde-600); --tono-fondo: var(--verde-100); }
    .aviso-error { --tono: var(--brand); --tono-fondo: var(--brand-soft); }
    .aviso-advertencia { --tono: var(--naranja-600); --tono-fondo: var(--naranja-100); }

    @keyframes entrar {
      from { opacity: 0; transform: translateY(-6px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    .icono {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border-radius: 10px;
      background: var(--tono-fondo);
      color: var(--tono);
    }

    .icono svg,
    .cerrar svg {
      width: 17px;
      height: 17px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2.2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .cuerpo {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 3px;
      min-width: 0;
      padding-top: 1px;
    }

    .titulo {
      font-size: 14px;
      font-weight: 600;
      color: var(--ink);
    }

    .mensaje {
      font-size: 13.5px;
      line-height: 1.45;
      color: var(--gris-600, #4b5260);
    }

    .accion {
      margin-top: 8px;
      height: 30px;
      padding: 0 11px;
      border: 1px solid var(--gris-300);
      border-radius: 8px;
      background: var(--blanco);
      font-family: inherit;
      font-size: 13px;
      font-weight: 500;
      color: var(--ink);
      cursor: pointer;
    }

    .accion:hover { background: var(--gris-50); }

    .cerrar {
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      padding: 0;
      border: 0;
      border-radius: 8px;
      background: none;
      color: var(--gris-400);
      cursor: pointer;
    }

    .cerrar svg { width: 15px; height: 15px; }

    .cerrar:hover { background: var(--gris-100); color: var(--ink); }

    /* Línea fina abajo que se acorta hasta cerrarse */
    .tiempo {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 3px;
      background: var(--tono);
      opacity: 0.55;
      transform-origin: left;
      animation-name: agotar;
      animation-timing-function: linear;
      animation-fill-mode: forwards;
    }

    @keyframes agotar {
      from { transform: scaleX(1); }
      to { transform: scaleX(0); }
    }

    @media (prefers-reduced-motion: reduce) {
      .aviso { animation: none; }
      .tiempo { display: none; }
    }

    @media (max-width: 480px) {
      .pila { top: 12px; left: 16px; right: 16px; width: auto; }
    }
  `,
})
export class Avisos {
  protected readonly notificacion = inject(NotificacionService);
  protected readonly titulos = TITULOS;
}
