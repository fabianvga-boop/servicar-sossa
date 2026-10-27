import { Component, computed, inject } from '@angular/core';

import { InactividadService } from '../core/services/inactividad.service';
import { Modal } from '../shared/components/modal';

/**
 * Último minuto antes de cerrar la sesión por inactividad: ventana con
 * cuenta regresiva y un botón para seguir. Cualquier movimiento del mouse o
 * tecla también la cierra, porque ya cuenta como actividad.
 */
@Component({
  selector: 'app-aviso-inactividad',
  imports: [Modal],
  template: `
    @if (inactividad.avisoVisible()) {
      <app-modal titulo="¿Sigue ahí?" [ancho]="420" (cerrar)="inactividad.continuar()">
        <p class="cuenta" aria-live="polite">{{ tiempo() }}</p>
        <p class="texto">
          Por seguridad, la sesión se cierra tras 15 minutos sin uso. Si tiene un formulario a
          medio llenar, lo que no haya guardado se pierde (los diagnósticos quedan como borrador
          para recuperarlos al volver).
        </p>
        <div pie>
          <button type="button" class="btn btn-primario" (click)="inactividad.continuar()">
            Seguir trabajando
          </button>
        </div>
      </app-modal>
    }
  `,
  styles: `
    .cuenta {
      margin: 0 0 10px;
      text-align: center;
      font-size: 34px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      color: var(--brand-dk);
    }

    .texto {
      margin: 0;
      font-size: 14px;
      line-height: 1.5;
      color: var(--ink-soft);
    }
  `,
})
export class AvisoInactividad {
  protected readonly inactividad = inject(InactividadService);

  protected readonly tiempo = computed(() => {
    const s = this.inactividad.segundosRestantes();
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  });
}
