import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';

/** Para enlazar el título con el panel (aria-labelledby) sin repetir ids. */
let contadorCajon = 0;

/** Paneles abiertos: el contenido recupera su ancho recién al cerrar el último. */
let cajonesAbiertos = 0;

/**
 * Panel lateral: el formulario o el detalle se abre a la derecha y la lista
 * sigue a la vista. En el escritorio empuja el contenido en vez de taparlo,
 * así se puede elegir otra fila sin cerrar el panel; en el celular ocupa la
 * pantalla. El cuerpo se proyecta directo y los botones, en un elemento con
 * el atributo `pie` (igual que app-modal):
 *
 *   <app-cajon titulo="Editar servicio" etiqueta="SER-001" (cerrar)="...">
 *     ...campos...
 *     <div pie>...botones...</div>
 *   </app-cajon>
 */
@Component({
  selector: 'app-cajon',
  host: { '(document:keydown)': 'alTeclear($event)' },
  template: `
    <aside
      #panel
      class="cajon"
      role="dialog"
      tabindex="-1"
      [attr.aria-labelledby]="idTitulo"
      [style.width.px]="ancho()"
    >
      <header class="cabecera">
        <div class="cabecera-textos">
          @if (etiqueta()) {
            <span class="etiqueta">{{ etiqueta() }}</span>
          }
          <h2 [id]="idTitulo">{{ titulo() }}</h2>
          @if (subtitulo()) {
            <span class="subtitulo">{{ subtitulo() }}</span>
          }
        </div>
        <button type="button" class="cerrar" aria-label="Cerrar" (click)="cerrar.emit()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </header>

      <div class="cajon-cuerpo">
        <ng-content />
      </div>

      <footer class="pie">
        <ng-content select="[pie]" />
      </footer>
    </aside>
  `,
  styles: `
    .cajon {
      position: fixed;
      top: var(--alto-encabezado);
      right: 0;
      bottom: 0;
      z-index: 46;
      display: flex;
      flex-direction: column;
      max-width: 100%;
      background: var(--blanco);
      border-left: 1px solid var(--gris-200);
      animation: entrar 0.22s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .cajon:focus { outline: none; }

    @keyframes entrar {
      from { transform: translateX(24px); opacity: 0; }
      to { transform: none; opacity: 1; }
    }

    @media (prefers-reduced-motion: reduce) {
      .cajon { animation: none; }
    }

    .cabecera {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      padding: 20px 24px 16px;
      border-bottom: 1px solid var(--gris-100);
    }

    .cabecera-textos {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .etiqueta {
      font-family: var(--fuente-mono);
      font-size: 12px;
      font-weight: 500;
      color: var(--gris-400);
    }

    h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: var(--ink);
    }

    .subtitulo {
      font-size: 13px;
      color: var(--gris-500);
    }

    .cerrar {
      width: 36px;
      height: 36px;
      flex-shrink: 0;
      display: grid;
      place-items: center;
      border: 0;
      border-radius: 8px;
      background: transparent;
      color: var(--gris-500);
      cursor: pointer;
    }

    .cerrar:hover {
      background: var(--gris-100);
      color: var(--ink);
    }

    .cajon-cuerpo {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 18px;
      padding: 20px 24px;
    }

    .pie {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 16px 24px;
      border-top: 1px solid var(--gris-100);
    }

    .pie:empty { display: none; }

    /* En el celular el panel ocupa la pantalla debajo de la barra superior */
    @media (max-width: 900px) {
      .cajon {
        left: 0;
        width: auto !important;
        border-left: none;
      }

      .cabecera,
      .cajon-cuerpo,
      .pie {
        padding-left: 16px;
        padding-right: 16px;
      }
    }
  `,
})
export class Cajon {
  readonly titulo = input.required<string>();
  /** Línea chica sobre el título: el código del registro, por ejemplo. */
  readonly etiqueta = input('');
  /** Una línea de explicación debajo del título, en letra normal. */
  readonly subtitulo = input('');
  readonly ancho = input(440);

  readonly cerrar = output<void>();

  protected readonly idTitulo = `cajon-titulo-${contadorCajon++}`;

  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  /** Quién tenía el foco antes de abrir, para devolvérselo al cerrar. */
  private readonly origenFoco = document.activeElement as HTMLElement | null;

  constructor() {
    afterNextRender(() => this.enfocarPrimero());

    // El contenido de la página deja lugar al panel (ver body.con-cajon en styles.css)
    cajonesAbiertos++;
    document.body.classList.add('con-cajon');
    effect(() => document.body.style.setProperty('--ancho-cajon', `${this.ancho()}px`));

    inject(DestroyRef).onDestroy(() => {
      cajonesAbiertos = Math.max(0, cajonesAbiertos - 1);
      if (cajonesAbiertos === 0) {
        document.body.classList.remove('con-cajon');
        document.body.style.removeProperty('--ancho-cajon');
      }
      this.origenFoco?.focus?.();
    });
  }

  /**
   * Escape cierra el panel, salvo que esté escribiendo en un campo (ahí
   * Escape deshace lo de la lista desplegable y no debe perder el formulario)
   * o que haya un diálogo abierto encima, que se cierra primero.
   */
  protected alTeclear(evento: KeyboardEvent): void {
    if (evento.key !== 'Escape') return;

    const destino = evento.target as HTMLElement | null;
    const escribiendo =
      !!destino &&
      (destino.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(destino.tagName));
    if (escribiendo || document.querySelector('[aria-modal="true"]')) return;

    this.cerrar.emit();
  }

  /** El foco entra al primer campo; si no hay campos, al panel. */
  private enfocarPrimero(): void {
    const panel = this.panel()?.nativeElement;
    if (!panel) return;

    const campo = panel.querySelector<HTMLElement>(
      '.cajon-cuerpo input:not([disabled]):not([readonly]), .cajon-cuerpo select:not([disabled]), .cajon-cuerpo textarea:not([disabled])',
    );

    (campo ?? panel).focus();
  }
}
