import {
  Component,
  DestroyRef,
  computed,
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
 * Modales abiertos a la vez (uno puede abrir otro encima, como una
 * confirmación). La página de atrás se libera recién al cerrar el último.
 */
let modalesAbiertos = 0;

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
    <div class="fondo" (mousedown)="alPresionarFondo($event)" (click)="alSoltarEnFondo($event)">
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
        <div class="cabecera" [class.compacta]="compacto()">
          @switch (iconoVisible()) {
            @case ('peligro') {
              <!-- La acción no se puede deshacer: se ve antes de leer el texto -->
              <span class="icono-cabecera peligro" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4" /><path d="M12 17h.01" />
                </svg>
              </span>
            }
            @case ('atencion') {
              <span class="icono-cabecera atencion" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="9" /><path d="M12 8v4.5" /><path d="M12 16h.01" />
                </svg>
              </span>
            }
            @case ('candado') {
              <span class="icono-cabecera atencion" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
              </span>
            }
            @case ('caja') {
              <span class="icono-cabecera neutro" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 8 12 3 3 8v8l9 5 9-5z" /><path d="m3 8 9 5 9-5M12 13v8" />
                </svg>
              </span>
            }
            @case ('herramienta') {
              <span class="icono-cabecera neutro" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-2.5z" />
                </svg>
              </span>
            }
            @case ('teclado') {
              <span class="icono-cabecera neutro" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2.5" y="6" width="19" height="12" rx="2.5" /><path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M6.5 14h.01M17.5 14h.01M9.5 14h5" />
                </svg>
              </span>
            }
          }

          <div class="titulos">
            <h2 [id]="idTitulo">{{ titulo() }}</h2>
            <ng-content select="[subtitulo]" />
          </div>

          <button type="button" class="cerrar-btn" (click)="cerrar.emit()" aria-label="Cerrar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div class="cuerpo" [class.compacto]="compacto()">
          <ng-content />
        </div>

        <div class="pie" [class.compacto]="compacto()">
          <ng-content select="[pie]" />
        </div>
      </div>
    </div>
  `,
  styles: `
    .fondo {
      position: fixed;
      inset: 0;
      background: rgba(21, 26, 34, 0.42);
      backdrop-filter: blur(2px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 900;
      padding: 20px;
    }

    .panel {
      background: var(--blanco);
      border-radius: var(--radio-lg);
      box-shadow: 0 30px 60px -24px rgba(0, 0, 0, 0.45);
      width: 100%;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      animation: aparecer 0.18s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .panel:focus { outline: none; }

    @keyframes aparecer {
      from { opacity: 0; transform: translateY(6px) scale(0.985); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    /* Quien prefiere menos movimiento no debería recibir la entrada animada */
    @media (prefers-reduced-motion: reduce) {
      .panel { animation: none; }
    }

    .cabecera {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 18px 20px 16px 24px;
      border-bottom: 1px solid var(--gris-100);
    }

    /* Confirmaciones: sin líneas, el ícono y el título arriba del contenido */
    .cabecera.compacta {
      align-items: flex-start;
      padding: 22px 20px 4px 24px;
      border-bottom: 0;
    }

    .titulos {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .titulos h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      letter-spacing: -0.01em;
    }

    .compacta .titulos { padding-top: 2px; }

    /* Ícono sobre su tinte: naranja importante, rojo irreversible, gris neutro */
    .icono-cabecera {
      display: grid;
      place-items: center;
      width: 42px;
      height: 42px;
      flex-shrink: 0;
      border-radius: var(--radio-md);
    }

    .icono-cabecera svg { width: 21px; height: 21px; }
    .icono-cabecera.peligro { background: var(--brand-soft); color: var(--brand); }
    .icono-cabecera.atencion { background: var(--naranja-100); color: var(--naranja-700); }
    .icono-cabecera.neutro { background: var(--gris-100); color: var(--ink); }

    /* Botón con área propia, no una "×" suelta de 24px sin caja */
    .cerrar-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      flex-shrink: 0;
      background: none;
      border: none;
      border-radius: var(--radio-sm);
      cursor: pointer;
      color: var(--gris-400);
      padding: 0;
    }

    .cerrar-btn svg { width: 18px; height: 18px; }

    .cerrar-btn:hover {
      background: var(--gris-100);
      color: var(--ink-soft);
    }

    /* overscroll-behavior: al llegar al final del formulario, la rueda del
       mouse no sigue desplazando la tabla de atrás. */
    .cuerpo {
      padding: 20px 24px;
      overflow-y: auto;
      overscroll-behavior: contain;
      flex: 1;
    }

    .cuerpo.compacto { padding: 12px 24px 4px 78px; }

    .pie {
      padding: 14px 24px;
      border-top: 1px solid var(--gris-100);
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      background: var(--blanco);
      border-radius: 0 0 18px 18px;
    }

    .pie.compacto { border-top: 0; padding: 16px 24px 22px; }

    .pie:empty { display: none; }

    @media (max-width: 520px) {
      .cuerpo.compacto { padding-left: 24px; }
    }
    `,
})
export class Modal {
  readonly titulo = input.required<string>();
  readonly ancho = input(640);

  /** Marca el diálogo como acción irreversible: agrega el ícono de alerta. */
  readonly peligroso = input(false);

  /** Ícono junto al título: atención o candado (naranja), peligro (rojo), teclado o herramienta (gris). */
  readonly icono = input<'atencion' | 'peligro' | 'teclado' | 'candado' | 'herramienta' | 'caja' | null>(null);

  /** Confirmaciones: sin líneas divisorias y el contenido alineado con el título. */
  readonly compacto = input(false);

  protected readonly iconoVisible = computed(() => this.icono() ?? (this.peligroso() ? 'peligro' : null));

  readonly cerrar = output<void>();

  protected readonly idTitulo = `modal-titulo-${contadorModal++}`;

  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  /** Quién tenía el foco antes de abrir, para devolvérselo al cerrar. */
  private readonly origenFoco = document.activeElement as HTMLElement | null;

  /** Si el botón del mouse se presionó sobre el fondo (y no dentro del panel). */
  private presionEnFondo = false;

  constructor() {
    afterNextRender(() => this.enfocarPrimero());
    bloquearScrollDePagina();

    // Al cerrarse, el foco vuelve al botón que abrió el modal; si no, queda
    // en el <body> y el siguiente Tab arranca desde el principio de la página.
    inject(DestroyRef).onDestroy(() => {
      liberarScrollDePagina();
      this.origenFoco?.focus?.();
    });
  }

  protected alPresionarFondo(evento: MouseEvent): void {
    this.presionEnFondo = evento.target === evento.currentTarget;
  }

  /**
   * Clic en el fondo oscuro. Solo cuenta si empezó y terminó afuera: quien
   * selecciona texto de un campo y suelta el botón fuera del panel no está
   * pidiendo cerrar. Y si el diálogo tiene campos, un clic afuera no lo
   * cierra nunca: perder lo cargado por un clic en falso es peor que tener
   * que usar Cancelar o la ×. Los diálogos de solo lectura sí se cierran.
   */
  protected alSoltarEnFondo(evento: MouseEvent): void {
    const desdeElFondo = this.presionEnFondo && evento.target === evento.currentTarget;
    this.presionEnFondo = false;
    if (!desdeElFondo) return;

    if (this.tieneCampos()) {
      this.sacudirPanel();
      return;
    }

    this.cerrar.emit();
  }

  /**
   * Sacudida breve para avisar que el formulario sigue abierto. Va por la
   * Web Animations API y no por una clase CSS: al quitar la clase, el panel
   * volvía a su animación de entrada y parecía que el formulario se recargaba.
   */
  private sacudirPanel(): void {
    const panel = this.panel()?.nativeElement;
    if (!panel || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    panel.animate(
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-5px)' },
        { transform: 'translateX(5px)' },
        { transform: 'translateX(-3px)' },
        { transform: 'translateX(0)' },
      ],
      { duration: 280, easing: 'ease-in-out' },
    );
  }

  private tieneCampos(): boolean {
    return !!this.panel()?.nativeElement.querySelector(
      '.cuerpo input:not([type="hidden"]), .cuerpo select, .cuerpo textarea',
    );
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
      '.cuerpo input:not([disabled]):not([readonly]), .cuerpo select:not([disabled]), .cuerpo textarea:not([disabled])',
    );

    (campo ?? panel).focus();
  }
}

/**
 * Mientras haya un modal abierto, la página de atrás no se desplaza: la rueda
 * del mouse sobre el fondo oscuro movía la tabla tapada. Se compensa el ancho
 * de la barra de desplazamiento para que el contenido no salte al ocultarla.
 */
function bloquearScrollDePagina(): void {
  if (modalesAbiertos++ > 0) return;
  const barra = window.innerWidth - document.documentElement.clientWidth;
  document.documentElement.style.overflow = 'hidden';
  if (barra > 0) document.body.style.paddingRight = `${barra}px`;
}

function liberarScrollDePagina(): void {
  if (--modalesAbiertos > 0) return;
  modalesAbiertos = 0;
  document.documentElement.style.overflow = '';
  document.body.style.paddingRight = '';
}
