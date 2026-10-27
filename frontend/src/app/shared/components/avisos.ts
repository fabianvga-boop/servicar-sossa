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

/** Pila de avisos flotantes. Se monta una sola vez, en la raíz de la aplicación. */
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
              @case ('info') {
                <svg viewBox="0 0 24 24"><path d="M12 16v-5M12 8h.01" /></svg>
              }
              @default {
                <svg viewBox="0 0 24 24"><path d="M12 7v6M12 17h.01" /></svg>
              }
            }
          </span>

          <div class="cuerpo">
            <strong class="titulo">{{ titulos[aviso.tipo] }}</strong>
            <span class="mensaje"><app-texto-resaltado [texto]="aviso.mensaje" /></span>
          </div>

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
      gap: 10px;
      max-width: 400px;
    }

    /* Cada tipo con su color de fondo, borde, ícono y título: un aviso de
       error no puede verse igual que uno de "guardado". */
    .aviso {
      --tono: var(--azul-700);
      --tono-acento: var(--azul-600);
      --tono-fondo: var(--azul-100);

      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 13px 14px 13px 13px;
      border: 1px solid var(--tono-acento);
      border-left-width: 5px;
      border-radius: var(--radio-sm);
      background: var(--tono-fondo);
      box-shadow: var(--sombra-md);
      animation: entrar 0.18s ease-out;
    }

    .aviso-exito {
      --tono: var(--verde-700);
      --tono-acento: var(--verde-600);
      --tono-fondo: var(--verde-100);
    }

    .aviso-error {
      --tono: var(--brand-dk);
      --tono-acento: var(--brand);
      --tono-fondo: var(--brand-soft);
    }

    .aviso-advertencia {
      --tono: var(--naranja-700);
      --tono-acento: var(--naranja-600);
      --tono-fondo: var(--naranja-100);
    }

    @keyframes entrar {
      from { opacity: 0; transform: translateX(16px); }
      to { opacity: 1; transform: translateX(0); }
    }

    @media (prefers-reduced-motion: reduce) {
      .aviso { animation: none; }
    }

    .icono {
      display: grid;
      place-items: center;
      width: 26px;
      height: 26px;
      flex-shrink: 0;
      border-radius: 50%;
      background: var(--tono);
    }

    .icono svg {
      width: 16px;
      height: 16px;
      fill: none;
      stroke: var(--blanco);
      stroke-width: 3;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .cuerpo {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .titulo {
      font-size: 14px;
      font-weight: 700;
      color: var(--tono);
    }

    .mensaje {
      font-size: 14px;
      line-height: 1.45;
      color: var(--ink);
    }

    .accion {
      align-self: center;
      background: var(--blanco);
      border: 1px solid var(--tono-acento);
      border-radius: var(--radio-sm);
      padding: 4px 10px;
      font-family: inherit;
      font-size: 12.5px;
      font-weight: 700;
      color: var(--tono);
      cursor: pointer;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .accion:hover { background: var(--tono-fondo); }

    .cerrar {
      background: none;
      border: none;
      font-size: 20px;
      line-height: 1;
      cursor: pointer;
      color: var(--tono);
      padding: 0 2px;
    }

    .cerrar:hover { color: var(--ink); }

    @media (max-width: 480px) {
      .pila { left: 16px; right: 16px; max-width: none; }
    }
  `,
})
export class Avisos {
  protected readonly notificacion = inject(NotificacionService);
  protected readonly titulos = TITULOS;
}
