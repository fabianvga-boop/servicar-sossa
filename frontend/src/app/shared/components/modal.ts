import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';

/** Para enlazar el título con el diálogo (aria-labelledby) sin repetir ids. */
let contadorModal = 0;

/**
 * Diálogo modal genérico. El contenido y los botones se proyectan:
 *
 *   <app-modal titulo="Nuevo cliente" (cerrar)="..."> ... </app-modal>
 *
 * El foco queda atrapado dentro del panel mientras está abierto y vuelve al
 * botón que lo abrió al cerrarse: sin eso, con el teclado se sigue navegando
 * la pantalla de atrás, que está tapada.
 */
@Component({
  selector: 'app-modal',
  template: `
    <div class="fondo" (click)="cerrar.emit()">
      <!-- El clic dentro del panel no debe cerrar el modal -->
      <div
        #panel
        class="panel"
        [style.max-width.px]="ancho()"
        (click)="$event.stopPropagation()"
        (keydown)="alTeclear($event)"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="idTitulo"
        tabindex="-1"
      >
        <div class="cabecera">
          @if (peligroso()) {
            <!-- La acción no se puede deshacer: se ve antes de leer el texto -->
            <span class="icono-alerta" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
              </svg>
            </span>
          }

          <h2 [id]="idTitulo">{{ titulo() }}</h2>

          <button type="button" class="cerrar-btn" (click)="cerrar.emit()" aria-label="Cerrar">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div class="cuerpo">
          <ng-content />
        </div>

        <div class="pie">
          <ng-content select="[pie]" />
        </div>
      </div>
    </div>
  `,
  styles: `
    .fondo {
      position: fixed;
      inset: 0;
      background: rgba(15, 41, 66, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 900;
      padding: 20px;
    }

    .panel {
      background: var(--blanco);
      border-radius: var(--radio);
      box-shadow: var(--sombra-lg);
      width: 100%;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      animation: aparecer 0.15s ease-out;
    }

    .panel:focus { outline: none; }

    @keyframes aparecer {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Quien prefiere menos movimiento no debería recibir la entrada animada */
    @media (prefers-reduced-motion: reduce) {
      .panel { animation: none; }
    }

    .cabecera {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 15px 20px;
      border-bottom: 1px solid var(--gris-200);
    }

    .cabecera h2 {
      font-size: 16px;
      flex: 1;
      min-width: 0;
    }

    /* Ícono de alerta sobre su tinte: mismo lenguaje que las insignias */
    .icono-alerta {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      flex-shrink: 0;
      border-radius: 50%;
      background: var(--brand-soft);
      color: var(--brand-dk);
    }

    .icono-alerta svg { width: 16px; height: 16px; }

    /* Botón con área propia, no una "×" suelta de 24px sin caja */
    .cerrar-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      flex-shrink: 0;
      background: none;
      border: none;
      border-radius: var(--radio-sm);
      cursor: pointer;
      color: var(--gris-400);
      padding: 0;
    }

    .cerrar-btn svg { width: 17px; height: 17px; }

    .cerrar-btn:hover {
      background: var(--gris-100);
      color: var(--ink-soft);
    }

    .cuerpo {
      padding: 20px;
      overflow-y: auto;
      flex: 1;
    }

    .pie {
      padding: 14px 20px;
      border-top: 1px solid var(--gris-200);
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      background: var(--gris-50);
      border-radius: 0 0 var(--radio) var(--radio);
    }

    .pie:empty { display: none; }
  `,
})
export class Modal {
  readonly titulo = input.required<string>();
  readonly ancho = input(560);

  /** Marca el diálogo como acción irreversible: agrega el ícono de alerta. */
  readonly peligroso = input(false);

  readonly cerrar = output<void>();

  protected readonly idTitulo = `modal-titulo-${contadorModal++}`;

  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  /** Quién tenía el foco antes de abrir, para devolvérselo al cerrar. */
  private readonly origenFoco = document.activeElement as HTMLElement | null;

  constructor() {
    afterNextRender(() => this.enfocarPrimero());

    // Al cerrarse, el foco vuelve al botón que abrió el modal; si no, queda
    // en el <body> y el siguiente Tab arranca desde el principio de la página.
    inject(DestroyRef).onDestroy(() => this.origenFoco?.focus?.());
  }

  /**
   * Escape cierra y Tab circula dentro del panel. El listener vive en el
   * panel (no en document) y el foco está atrapado adentro: así, con dos
   * modales encimados, Escape siempre cierra el de arriba.
   */
  protected alTeclear(evento: KeyboardEvent): void {
    if (evento.key === 'Escape') {
      evento.stopPropagation();
      this.cerrar.emit();
      return;
    }

    if (evento.key !== 'Tab') return;

    const enfocables = this.enfocables();
    if (enfocables.length === 0) return;

    const primero = enfocables[0];
    const ultimo = enfocables[enfocables.length - 1];
    const activo = document.activeElement;

    if (evento.shiftKey && (activo === primero || activo === this.panel()?.nativeElement)) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && activo === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  }

  private enfocables(): HTMLElement[] {
    const panel = this.panel()?.nativeElement;
    if (!panel) return [];

    return [
      ...panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ].filter((el) => el.offsetParent !== null);
  }

  /**
   * El foco entra al primer campo del formulario. Si el diálogo no tiene
   * campos (una confirmación), se enfoca el panel: así Escape funciona sin
   * dejar el cursor sobre el botón destructivo.
   */
  private enfocarPrimero(): void {
    const panel = this.panel()?.nativeElement;
    if (!panel) return;

    const campo = panel.querySelector<HTMLElement>(
      '.cuerpo input:not([disabled]), .cuerpo select:not([disabled]), .cuerpo textarea:not([disabled])',
    );

    (campo ?? panel).focus();
  }
}
