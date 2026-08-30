import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface Miga {
  etiqueta: string;
  /** Sin ruta se dibuja como texto plano: es la posición actual. */
  ruta?: string;
}

/**
 * Rastro de navegación para las pantallas anidadas (Órdenes → ORD-001).
 *
 * Un solo botón "volver" dice cómo salir pero no dónde se está parado; las
 * migas muestran el camino completo y permiten saltar a cualquier nivel.
 */
@Component({
  selector: 'app-migas',
  imports: [RouterLink],
  template: `
    <nav class="migas" aria-label="Ruta de navegación">
      @for (miga of items(); track miga.etiqueta; let ultimo = $last) {
        @if (miga.ruta && !ultimo) {
          <a [routerLink]="miga.ruta">{{ miga.etiqueta }}</a>
          <span class="separador" aria-hidden="true">/</span>
        } @else {
          <span class="actual" aria-current="page">{{ miga.etiqueta }}</span>
        }
      }
    </nav>
  `,
  styles: `
    .migas {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      font-size: 12px;
      margin-bottom: 6px;
    }

    .migas a { color: var(--gris-500); }
    .migas a:hover { color: var(--brand); }

    .separador { color: var(--gris-400); }

    .actual {
      color: var(--ink-soft);
      font-weight: 600;
    }
  `,
})
export class Migas {
  readonly items = input.required<Miga[]>();
}
