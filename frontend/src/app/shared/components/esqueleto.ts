import { Component, computed, input } from '@angular/core';

/**
 * Placeholder animado con la forma de la tabla que está por llegar.
 *
 * Frente a un "Cargando…" centrado, mantiene la altura y la estructura de la
 * pantalla: no hay salto de layout cuando entran los datos y el usuario ve de
 * inmediato qué tipo de contenido va a aparecer.
 */
@Component({
  selector: 'app-esqueleto',
  template: `
    <div class="esqueleto" role="status" aria-label="Cargando contenido">
      @for (fila of rango(); track $index) {
        <div class="fila">
          @for (columna of columnasRango(); track $index) {
            <div class="bloque" [style.width.%]="ancho($index)"></div>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .esqueleto { padding: 4px 0; }

    .fila {
      display: flex;
      gap: 14px;
      padding: 13px 14px;
      border-bottom: 1px solid var(--gris-100);
    }

    .bloque {
      height: 11px;
      border-radius: 4px;
      background: linear-gradient(
        90deg,
        var(--gris-100) 25%,
        var(--gris-200) 37%,
        var(--gris-100) 63%
      );
      background-size: 400% 100%;
      animation: brillo 1.3s ease-in-out infinite;
    }

    @keyframes brillo {
      from { background-position: 100% 50%; }
      to { background-position: 0 50%; }
    }

    /* Respeta a quien pidió menos movimiento en el sistema operativo. */
    @media (prefers-reduced-motion: reduce) {
      .bloque { animation: none; }
    }
  `,
})
export class Esqueleto {
  readonly filas = input(5);
  readonly columnas = input(4);

  protected readonly rango = computed(() => Array.from({ length: this.filas() }));
  protected readonly columnasRango = computed(() => Array.from({ length: this.columnas() }));

  /**
   * Anchos desparejos por columna: un bloque uniforme se lee como una barra de
   * progreso, mientras que este patrón se reconoce como texto por llegar.
   */
  protected ancho(indice: number): number {
    const patron = [30, 22, 26, 18, 24, 20];
    return patron[indice % patron.length];
  }
}
