import { Component, input } from '@angular/core';

/**
 * Réplica visual de una placa vehicular boliviana: fondo blanco, marco azul,
 * "BOLIVIA" junto a la bandera en una franja superior, número en azul grueso
 * debajo. Es un solo componente para que toda referencia a una placa en el
 * sistema —listados, chips, el encabezado de una orden— se vea igual, en vez
 * de reinventar el marcado en cada módulo.
 */
@Component({
  selector: 'app-placa',
  template: `
    <span class="placa-bo" [class.grande]="tamano() === 'grande'">
      <span class="placa-bo-franja">
        <!-- Bandera de Bolivia: rojo arriba, amarillo al medio, verde abajo.
             Cada franja lleva su propio "y" — sin eso, las tres parten de
             y=0 y la más chica (dibujada al final) queda encima, invirtiendo
             visualmente el orden de los colores. -->
        <svg class="placa-bo-bandera" viewBox="0 0 3 2" aria-hidden="true">
          <rect width="3" height="0.67" y="0" fill="#d52b1e" />
          <rect width="3" height="0.67" y="0.67" fill="#f9e300" />
          <rect width="3" height="0.66" y="1.34" fill="#007934" />
        </svg>
        <span class="placa-bo-pais">BOLIVIA</span>
      </span>
      <span class="placa-bo-numero">{{ valor() }}</span>
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex-shrink: 0;
    }

    .placa-bo {
      display: inline-flex;
      flex-direction: column;
      align-items: stretch;
      width: fit-content;
      border: 2px solid var(--azul-600);
      border-radius: 5px;
      background: var(--blanco);
      overflow: hidden;
      box-shadow: var(--sombra-sm);
    }

    .placa-bo-franja {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 3px;
      padding: 1.5px 4px;
      background: var(--azul-100);
      border-bottom: 1.5px solid var(--azul-600);
    }

    .placa-bo-bandera {
      width: 10px;
      height: 6.7px;
      flex-shrink: 0;
      border-radius: 1px;
      box-shadow: 0 0 0 0.5px rgba(0, 0, 0, 0.2);
    }

    .placa-bo-pais {
      font-size: 6px;
      font-weight: 800;
      letter-spacing: 0.05em;
      color: #14417f;
      line-height: 1;
    }

    .placa-bo-numero {
      padding: 2px 8px 3px;
      font-family: 'Arial Narrow', Arial, sans-serif;
      font-size: 12.5px;
      font-weight: 800;
      letter-spacing: 0.03em;
      color: var(--azul-600);
      line-height: 1.15;
      text-align: center;
      white-space: nowrap;
    }

    /* Variante grande: el encabezado del detalle de una orden, donde la placa
       es el dato principal de la pantalla, no un chip más de la fila. */
    .placa-bo.grande {
      border-width: 3px;
      border-radius: 8px;
    }

    .placa-bo.grande .placa-bo-franja {
      padding: 3px 8px;
      gap: 5px;
      border-bottom-width: 2px;
    }

    .placa-bo.grande .placa-bo-bandera {
      width: 16px;
      height: 10.7px;
    }

    .placa-bo.grande .placa-bo-pais {
      font-size: 10px;
    }

    .placa-bo.grande .placa-bo-numero {
      padding: 5px 16px 7px;
      font-size: 26px;
      letter-spacing: 0.06em;
    }
  `,
})
export class Placa {
  /** El texto de la placa tal como lo guarda el sistema (ej. "6921UHD"). */
  readonly valor = input.required<string>();

  /** "grande" para un encabezado destacado; el resto de la app usa el chip normal. */
  readonly tamano = input<'normal' | 'grande'>('normal');
}
