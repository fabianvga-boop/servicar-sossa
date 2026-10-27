import { Component, inject, input, output, signal } from '@angular/core';

import { NotificacionService } from '../../core/services/notificacion.service';
import { AYUDA_FORMATOS_FOTO, FORMATOS_FOTO, prepararFoto } from '../fotos';

/**
 * Botones para cargar una foto: "Tomar foto" abre directamente la cámara
 * trasera (solo en celulares y tablets) y "Elegir archivo" busca una guardada.
 * Revisa el formato y el tamaño en el momento y achica las fotos pesadas de
 * la cámara: a quien lo usa solo le llega un archivo listo para subir.
 *
 *   <app-elegir-foto etiqueta="Subir foto" [ocupado]="subiendo()" (archivo)="subir($event)" />
 */
@Component({
  selector: 'app-elegir-foto',
  template: `
    <div class="botones">
      @if (hayCamara) {
        <label class="btn btn-secundario" [class.btn-sm]="chico()" [class.inactivo]="bloqueado()">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            [disabled]="bloqueado()"
            (change)="alElegir($event)"
          />
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
            <circle cx="12" cy="13" r="3" />
          </svg>
          {{ textoOcupado() ?? 'Tomar foto' }}
        </label>
      }

      <label class="btn btn-secundario" [class.btn-sm]="chico()" [class.inactivo]="bloqueado()">
        <input
          type="file"
          [accept]="formatos"
          [disabled]="bloqueado()"
          (change)="alElegir($event)"
        />
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" />
          <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
        </svg>
        {{ textoOcupado() ?? etiqueta() }}
      </label>
    </div>

    @if (mostrarAyuda()) {
      <span class="ayuda">{{ ayuda }}</span>
    }
  `,
  styles: `
    :host { display: inline-flex; flex-direction: column; gap: 4px; }

    .botones { display: flex; flex-wrap: wrap; gap: 8px; }

    .botones .btn { margin: 0; position: relative; }
    .botones svg { width: 16px; height: 16px; flex-shrink: 0; }

    /* El input real queda oculto pero alcanzable con Tab: el botón es la
       etiqueta que lo abre, y muestra el foco cuando el teclado llega a él. */
    .botones input {
      position: absolute;
      width: 1px;
      height: 1px;
      opacity: 0;
      pointer-events: none;
    }

    .botones label:has(input:focus-visible) {
      outline: 2px solid var(--brand);
      outline-offset: 1px;
    }

    .inactivo { opacity: 0.55; cursor: not-allowed; pointer-events: none; }

    .ayuda { font-size: 12.5px; color: var(--gris-500); }
  `,
})
export class ElegirFoto {
  /** Texto del botón de archivo: "Subir foto", "Cambiar", "Elegir archivo"… */
  readonly etiqueta = input('Elegir archivo');
  /** Mientras se sube, los botones se bloquean y dicen "Subiendo…". */
  readonly ocupado = input(false);
  readonly chico = input(false);
  readonly mostrarAyuda = input(true);

  /** La foto ya validada (y achicada si hacía falta), lista para subir. */
  readonly archivo = output<File>();

  private readonly notificacion = inject(NotificacionService);

  /**
   * Puntero grueso = pantalla táctil (celular o tablet): ahí la cámara está a
   * mano. En una computadora el botón no aportaría nada.
   */
  protected readonly hayCamara =
    typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

  protected readonly formatos = FORMATOS_FOTO.join(',');
  protected readonly ayuda = AYUDA_FORMATOS_FOTO;
  private readonly preparando = signal(false);

  protected bloqueado(): boolean {
    return this.ocupado() || this.preparando();
  }

  protected textoOcupado(): string | null {
    if (this.preparando()) return 'Preparando…';
    return this.ocupado() ? 'Subiendo…' : null;
  }

  protected async alElegir(evento: Event): Promise<void> {
    const input = evento.target as HTMLInputElement;
    const elegido = input.files?.[0];
    // Se limpia siempre: si no, elegir el mismo archivo dos veces no dispara change.
    input.value = '';
    if (!elegido) return;

    this.preparando.set(true);
    const resultado = await prepararFoto(elegido);
    this.preparando.set(false);

    if (typeof resultado === 'string') {
      this.notificacion.advertencia(resultado);
      return;
    }

    this.archivo.emit(resultado);
  }
}
