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
        <div class="vacio-titulo">
          {{ hayFiltro() ? 'Sin coincidencias' : titulo() }}
        </div>
        <div class="texto-sm">
          {{ hayFiltro() ? 'Pruebe con otro criterio de búsqueda.' : descripcion() }}
        </div>
      </div>
    }
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
