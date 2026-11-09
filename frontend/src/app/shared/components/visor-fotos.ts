import { Component, ElementRef, afterNextRender, computed, inject, input, output, signal } from '@angular/core';

import { urlArchivo } from '../../core/services/api-base';

/** Una foto del visor: la imagen, de qué es y cuándo se tomó. */
export interface FotoVisor {
  url: string;
  titulo: string;
  fecha?: string | null;
}

/**
 * Convierte una foto del vehículo en una del visor: rotulada con el trabajo del que
 * es evidencia ("Estado del vehículo" si es general) y con su fecha en hora local.
 */
export function aFotoVisor(f: { url: string; servicio?: string | null; fechaSubida: string }): FotoVisor {
  return {
    url: urlArchivo(f.url),
    titulo: f.servicio || 'Estado del vehículo',
    fecha: new Date(f.fechaSubida).toLocaleString('es-BO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
  };
}

/**
 * Visor de fotos a pantalla completa: la foto grande, con flechas y miniaturas
 * para pasar de una a otra. Reemplaza a la galería en cuadrícula dentro de una
 * ventana blanca, donde las fotos quedaban chicas y no se podían apreciar.
 *
 * Teclado: ← y → cambian de foto, Escape cierra. Tocar el fondo también cierra.
 */
@Component({
  selector: 'app-visor-fotos',
  template: `
    <div
      #raiz
      class="visor"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      [attr.aria-label]="titulo()"
      (click)="cerrar.emit()"
      (keydown)="alTeclear($event)"
    >
      <div class="barra" (click)="$event.stopPropagation()">
        <div class="titulos">
          <strong>{{ titulo() }}</strong>
          <span>{{ actual() + 1 }} de {{ fotos().length }}</span>
        </div>
        @if (foto(); as f) {
          <a class="boton" [href]="f.url" target="_blank" rel="noopener" title="Abrir la foto original" aria-label="Abrir la foto original">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6" /><path d="M20 4 11 13" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
          </a>
        }
        <button type="button" class="boton" aria-label="Cerrar" title="Cerrar (Esc)" (click)="cerrar.emit()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>

      <div class="escena">
        @if (fotos().length > 1) {
          <button type="button" class="flecha izquierda" aria-label="Foto anterior" (click)="ir(-1); $event.stopPropagation()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg>
          </button>
        }
        @if (foto(); as f) {
          <figure (click)="$event.stopPropagation()">
            <img [src]="f.url" [alt]="f.titulo" />
            <figcaption>
              <strong>{{ f.titulo }}</strong>
              @if (f.fecha) {
                <span>{{ f.fecha }}</span>
              }
            </figcaption>
          </figure>
        }
        @if (fotos().length > 1) {
          <button type="button" class="flecha derecha" aria-label="Foto siguiente" (click)="ir(1); $event.stopPropagation()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
          </button>
        }
      </div>

      @if (fotos().length > 1) {
        <div class="tira" (click)="$event.stopPropagation()">
          @for (f of fotos(); track $index; let i = $index) {
            <button type="button" [class.activa]="i === actual()" [attr.aria-label]="'Ver la foto ' + (i + 1) + ': ' + f.titulo" (click)="actual.set(i)">
              <img [src]="f.url" alt="" loading="lazy" />
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .visor {
      position: fixed;
      inset: 0;
      z-index: 1100;
      display: grid;
      grid-template-rows: auto 1fr auto;
      background: rgba(14, 17, 23, 0.97);
      color: var(--blanco);
      outline: none;
      animation: aparece 0.16s ease-out;
    }

    @keyframes aparece { from { opacity: 0; } }

    .barra {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 14px 18px;
    }

    .titulos { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .titulos strong { font-size: 16px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .titulos span { font-size: 12.5px; color: var(--texto-sobre-oscuro); }

    .boton, .flecha {
      width: 40px;
      height: 40px;
      display: grid;
      place-items: center;
      flex: none;
      padding: 0;
      border: 0;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.12);
      color: inherit;
      cursor: pointer;
      transition: background 0.15s, transform 0.1s;
    }
    .boton:hover, .flecha:hover { background: rgba(255, 255, 255, 0.24); }
    .boton:active, .flecha:active { transform: scale(0.94); }
    .boton svg, .flecha svg { width: 20px; height: 20px; }

    .escena {
      position: relative;
      min-height: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 14px;
      padding: 0 18px;
    }

    figure {
      margin: 0;
      min-width: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      max-height: 100%;
    }

    figure img {
      display: block;
      max-width: min(1100px, calc(100vw - 150px));
      max-height: calc(100dvh - 250px);
      object-fit: contain;
      border-radius: var(--radio-md);
      background: rgba(255, 255, 255, 0.06);
      box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45);
    }

    figcaption { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 12px; font-size: 14px; }
    figcaption span { color: var(--texto-sobre-oscuro); }

    .tira {
      display: flex;
      justify-content: center;
      gap: 8px;
      padding: 12px 18px 18px;
      overflow-x: auto;
    }
    .tira button {
      flex: none;
      width: 64px;
      height: 64px;
      padding: 0;
      border: 2px solid transparent;
      border-radius: var(--radio-sm);
      overflow: hidden;
      cursor: pointer;
      opacity: 0.55;
      background: rgba(255, 255, 255, 0.08);
      transition: opacity 0.15s, border-color 0.15s;
    }
    .tira button:hover { opacity: 0.9; }
    .tira button.activa { opacity: 1; border-color: var(--blanco); }
    .tira img { width: 100%; height: 100%; object-fit: cover; display: block; }

    @media (max-width: 640px) {
      .escena { padding: 0 8px; gap: 6px; }
      .flecha { position: absolute; z-index: 1; top: 40%; background: rgba(14, 17, 23, 0.6); }
      .flecha.izquierda { left: 8px; }
      .flecha.derecha { right: 8px; }
      figure img { max-width: calc(100vw - 16px); max-height: calc(100dvh - 230px); }
    }
  `,
})
export class VisorFotos {
  readonly titulo = input.required<string>();
  readonly fotos = input.required<FotoVisor[]>();
  /** Foto con la que se abre (por defecto la primera). */
  readonly inicio = input(0);
  readonly cerrar = output<void>();

  protected readonly actual = signal(0);
  protected readonly foto = computed(() => this.fotos()[this.actual()] ?? null);

  private readonly raiz = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    // Al abrir se toma el foco para que las flechas y Escape funcionen sin tocar nada.
    afterNextRender(() => {
      this.actual.set(Math.min(Math.max(this.inicio(), 0), Math.max(this.fotos().length - 1, 0)));
      this.raiz.nativeElement.querySelector<HTMLElement>('.visor')?.focus();
    });
  }

  protected ir(paso: number): void {
    const total = this.fotos().length;
    if (total < 2) return;
    this.actual.update((n) => (n + paso + total) % total);
  }

  protected alTeclear(evento: KeyboardEvent): void {
    if (evento.key === 'Escape') {
      evento.stopPropagation();
      this.cerrar.emit();
    } else if (evento.key === 'ArrowLeft') {
      evento.preventDefault();
      this.ir(-1);
    } else if (evento.key === 'ArrowRight') {
      evento.preventDefault();
      this.ir(1);
    }
  }
}
