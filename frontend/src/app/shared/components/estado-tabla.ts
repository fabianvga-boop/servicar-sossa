import { Component, input } from '@angular/core';

import { Esqueleto } from './esqueleto';

/**
 * Cubre los tres estados de una tabla que carga datos: cargando, vacía por
 * falta de datos, o vacía porque el filtro no encontró nada. Distinguir el
 * último caso evita que el usuario crea que no hay registros cuando en
 * realidad su búsqueda no coincidió.
 *
 * Mientras carga dibuja un esqueleto con la forma de la tabla en vez de un
 * texto centrado: así la pantalla no salta cuando entran los datos.
 */
@Component({
  selector: 'app-estado-tabla',
  imports: [Esqueleto],
  template: `
    @if (cargando()) {
      <app-esqueleto [filas]="filas()" [columnas]="columnas()" />
    } @else {
      <div class="vacio">
        <span class="vacio-icono" aria-hidden="true">
          @if (hayFiltro()) {
            <!-- Lupa: el problema es la búsqueda, no que falten datos -->
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m20 20-4.4-4.4" />
            </svg>
          } @else {
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M3 8l9-5 9 5-9 5-9-5Z" />
              <path d="M3 8v8l9 5 9-5V8" />
              <path d="M12 13v8" />
            </svg>
          }
        </span>

        <div class="vacio-titulo">
          {{ hayFiltro() ? 'Sin coincidencias' : titulo() }}
        </div>

        <div class="texto-sm">
          {{ hayFiltro() ? 'Pruebe con otro criterio de búsqueda.' : descripcion() }}
        </div>
      </div>
    }
  `,
  styles: `
    .vacio-icono {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 42px;
      height: 42px;
      margin: 0 auto 10px;
      border-radius: 50%;
      background: var(--gris-100);
      color: var(--gris-400);
    }

    .vacio-icono svg { width: 20px; height: 20px; }
  `,
})
export class EstadoTabla {
  readonly cargando = input(false);
  readonly hayFiltro = input(false);
  readonly titulo = input('Sin registros');
  readonly descripcion = input('Todavía no hay datos para mostrar.');

  /** Forma del esqueleto; conviene igualarla a la tabla real de cada módulo. */
  readonly filas = input(5);
  readonly columnas = input(5);
}
