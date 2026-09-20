import { Component, computed, input, output } from '@angular/core';

/**
 * Controles de paginación para una tabla: cuenta de registros, tamaño de
 * página y navegación. Todas las tablas del sistema comparten este mismo
 * componente para que se vean y se comporten igual en todos los módulos.
 */
@Component({
  selector: 'app-paginador',
  template: `
    <div class="paginador">
      <span class="paginador-info">
        @if (totalRegistros() === 0) {
          Sin registros
        } @else {
          Mostrando {{ desde() }}–{{ hasta() }} de {{ totalRegistros() }} registro(s)
        }
      </span>

      <div class="paginador-controles">
        <label class="paginador-tamano">
          <span class="texto-tenue">Por página</span>
          <select (change)="cambiarTamano.emit(+$any($event.target).value)">
            @for (opcion of opcionesTamano; track opcion) {
              <option [value]="opcion" [selected]="opcion === tamanoPagina()">{{ opcion }}</option>
            }
          </select>
        </label>

        <div class="paginador-nav">
          <button
            type="button"
            class="btn-icono"
            [disabled]="pagina() <= 1"
            title="Primera página"
            aria-label="Primera página"
            (click)="irA(1)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m17 17-5-5 5-5" /><path d="M9 17V7" />
            </svg>
          </button>
          <button
            type="button"
            class="btn-icono"
            [disabled]="pagina() <= 1"
            title="Página anterior"
            aria-label="Página anterior"
            (click)="irA(pagina() - 1)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>

          <span class="paginador-actual">Página {{ pagina() }} de {{ totalPaginasVisible() }}</span>

          <button
            type="button"
            class="btn-icono"
            [disabled]="pagina() >= totalPaginasVisible()"
            title="Página siguiente"
            aria-label="Página siguiente"
            (click)="irA(pagina() + 1)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
          <button
            type="button"
            class="btn-icono"
            [disabled]="pagina() >= totalPaginasVisible()"
            title="Última página"
            aria-label="Última página"
            (click)="irA(totalPaginasVisible())"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m7 17 5-5-5-5" /><path d="M15 17V7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: `
    .paginador {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      padding: 13px 16px;
      border-top: 1px solid var(--gris-200);
      font-size: 13.5px;
      color: var(--gris-500);
    }

    .paginador-controles {
      display: flex;
      align-items: center;
      gap: 18px;
    }

    .paginador-tamano {
      display: flex;
      align-items: center;
      gap: 7px;
    }

    .paginador-tamano select {
      width: auto;
      padding: 5px 8px;
      font-size: 13.5px;
    }

    .paginador-nav {
      display: flex;
      align-items: center;
      gap: 2px;
    }

    .paginador-actual {
      margin: 0 6px;
      min-width: 108px;
      text-align: center;
      color: var(--ink-soft);
      font-weight: 500;
    }

    @media (max-width: 640px) {
      .paginador { flex-direction: column; align-items: stretch; }
      .paginador-controles { justify-content: space-between; }
    }
  `,
})
export class Paginador {
  readonly pagina = input.required<number>();
  readonly totalPaginas = input.required<number>();
  readonly totalRegistros = input.required<number>();
  readonly tamanoPagina = input.required<number>();

  readonly cambiarPagina = output<number>();
  readonly cambiarTamano = output<number>();

  protected readonly opcionesTamano = [10, 20, 50, 100];

  /** Al menos 1: con 0 registros no hay "página 0 de 0" que mostrar. */
  protected readonly totalPaginasVisible = computed(() => Math.max(this.totalPaginas(), 1));

  protected readonly desde = computed(() =>
    this.totalRegistros() === 0 ? 0 : (this.pagina() - 1) * this.tamanoPagina() + 1,
  );

  protected readonly hasta = computed(() =>
    Math.min(this.pagina() * this.tamanoPagina(), this.totalRegistros()),
  );

  protected irA(pagina: number): void {
    const destino = Math.min(Math.max(pagina, 1), this.totalPaginasVisible());
    if (destino !== this.pagina()) this.cambiarPagina.emit(destino);
  }
}
