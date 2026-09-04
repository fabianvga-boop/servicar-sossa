import { Component, computed, forwardRef, input, output, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface OpcionSelector {
  valor: string;
  etiqueta: string;
  /** Línea secundaria: precio, stock, placa… lo que ayude a elegir. */
  detalle?: string;
  deshabilitada?: boolean;
  /** Motivo por el que no se puede elegir, como ayuda contextual. */
  razonDeshabilitada?: string;
}

/**
 * Rango de tildes sueltas que deja `normalize('NFD')` al separar cada letra
 * de su acento (U+0300–U+036F). Se arma con `fromCharCode` para que el código
 * fuente quede en ASCII puro y nadie lo rompa al reindentar o recodificar.
 */
const DIACRITICOS = new RegExp(
  `[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`,
  'g',
);

/** Quita tildes y pasa a minúscula: "Bujía" y "bujia" deben coincidir. */
function normalizar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(DIACRITICOS, '');
}

/**
 * Selector con búsqueda incremental. Implementa ControlValueAccessor, así que
 * se usa igual que un `<select>`: con `[(ngModel)]` o con `formControlName`.
 *
 * Un `<select>` nativo con cien repuestos obliga a recorrer la lista a ojo;
 * aquí se escribe parte del nombre y la lista se reduce. El teclado navega con
 * flechas, Enter elige y Escape cierra.
 */
@Component({
  selector: 'app-selector-busqueda',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectorBusqueda),
      multi: true,
    },
  ],
  template: `
    <div class="selector" [class.deshabilitado]="deshabilitado()">
      <input
        type="text"
        role="combobox"
        autocomplete="off"
        [id]="idCampo()"
        [attr.aria-expanded]="abierto()"
        [placeholder]="marcador()"
        [value]="textoVisible()"
        [disabled]="deshabilitado()"
        [class.invalido]="invalido()"
        (focus)="alEnfocar()"
        (input)="alEscribir($any($event.target).value)"
        (blur)="alSalir()"
        (keydown)="alTeclear($event)"
      />

      @if (valorActual() && !deshabilitado()) {
        <button
          type="button"
          class="limpiar"
          aria-label="Quitar selección"
          (mousedown)="$event.preventDefault()"
          (click)="limpiar()"
        >
          &times;
        </button>
      }

      @if (abierto()) {
        <ul class="lista" role="listbox">
          @if (filtradas().length === 0) {
            <li class="sin-resultados">Sin coincidencias para «{{ busqueda() }}»</li>
          } @else {
            @for (opcion of filtradas(); track opcion.valor; let i = $index) {
              <li
                role="option"
                [attr.aria-selected]="opcion.valor === valorActual()"
                [class.resaltada]="i === indiceResaltado()"
                [class.no-disponible]="opcion.deshabilitada"
                [title]="opcion.razonDeshabilitada ?? ''"
                (mousedown)="$event.preventDefault()"
                (click)="elegir(opcion)"
                (mouseenter)="indiceResaltado.set(i)"
              >
                <span class="etiqueta">{{ opcion.etiqueta }}</span>
                @if (opcion.detalle) {
                  <span class="detalle">{{ opcion.detalle }}</span>
                }
              </li>
            }
          }
        </ul>
      }
    </div>
  `,
  styles: `
    .selector { position: relative; }

    .limpiar {
      position: absolute;
      top: 50%;
      right: 8px;
      transform: translateY(-50%);
      background: none;
      border: none;
      font-size: 17px;
      line-height: 1;
      color: var(--gris-400);
      cursor: pointer;
      padding: 0 4px;
    }

    .limpiar:hover { color: var(--ink-soft); }

    .lista {
      position: absolute;
      top: calc(100% + 3px);
      left: 0;
      right: 0;
      z-index: 40;
      margin: 0;
      padding: 4px;
      list-style: none;
      max-height: 240px;
      overflow-y: auto;
      background: var(--blanco);
      border: 1px solid var(--gris-200);
      border-radius: var(--radio-sm);
      box-shadow: var(--sombra-md);
    }

    .lista li {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 10px;
      padding: 7px 10px;
      border-radius: var(--radio-sm);
      font-size: 13px;
      cursor: pointer;
    }

    .lista li.resaltada { background: var(--gris-100); }

    .lista li.no-disponible {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .etiqueta { font-weight: 500; }

    .detalle {
      font-size: 11.5px;
      color: var(--gris-500);
      white-space: nowrap;
      flex-shrink: 0;
    }

    .sin-resultados {
      padding: 12px 10px;
      font-size: 12.5px;
      color: var(--gris-500);
      cursor: default;
    }
  `,
})
export class SelectorBusqueda implements ControlValueAccessor {
  readonly opciones = input<OpcionSelector[]>([]);
  readonly marcador = input('Escriba para buscar…');
  readonly idCampo = input('');
  readonly invalido = input(false);

  /**
   * Valor recién elegido (cadena vacía al limpiar).
   *
   * `ngModelChange` solo existe con formularios de plantilla; este output
   * permite reaccionar a la selección también bajo `formControlName`, que es
   * como lo usan los formularios reactivos del proyecto.
   */
  readonly seleccion = output<string>();

  protected readonly valorActual = signal('');
  protected readonly abierto = signal(false);
  protected readonly indiceResaltado = signal(0);
  protected readonly deshabilitado = signal(false);

  /**
   * Texto tecleado mientras se busca. En `null` significa "no está buscando",
   * y entonces el campo muestra la etiqueta de lo ya seleccionado.
   */
  protected readonly busqueda = signal<string | null>(null);

  private alCambiar: (valor: string) => void = () => {};
  private alTocar: () => void = () => {};

  protected readonly etiquetaSeleccionada = computed(
    () => this.opciones().find((o) => o.valor === this.valorActual())?.etiqueta ?? '',
  );

  protected readonly textoVisible = computed(
    () => this.busqueda() ?? this.etiquetaSeleccionada(),
  );

  protected readonly filtradas = computed(() => {
    const criterio = this.busqueda();

    // Recién abierto (sin teclear) se ofrece la lista completa.
    if (criterio === null || criterio.trim() === '') return this.opciones();

    const buscado = normalizar(criterio);

    return this.opciones().filter(
      (o) =>
        normalizar(o.etiqueta).includes(buscado) ||
        (o.detalle ? normalizar(o.detalle).includes(buscado) : false),
    );
  });

  // --- ControlValueAccessor ------------------------------------------------

  writeValue(valor: string | null): void {
    this.valorActual.set(valor ?? '');
    this.busqueda.set(null);
  }

  registerOnChange(fn: (valor: string) => void): void {
    this.alCambiar = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.alTocar = fn;
  }

  setDisabledState(deshabilitado: boolean): void {
    this.deshabilitado.set(deshabilitado);
  }

  // --- Interacción ---------------------------------------------------------

  protected alEnfocar(): void {
    // Cadena vacía, no null: así la lista se abre completa pero el campo queda
    // en blanco y el usuario puede teclear encima sin borrar lo anterior.
    this.busqueda.set('');
    this.indiceResaltado.set(0);
    this.abierto.set(true);
  }

  protected alEscribir(texto: string): void {
    this.busqueda.set(texto);
    this.indiceResaltado.set(0);
    this.abierto.set(true);
  }

  protected alSalir(): void {
    this.abierto.set(false);
    this.busqueda.set(null);
    this.alTocar();
  }

  protected alTeclear(evento: KeyboardEvent): void {
    const total = this.filtradas().length;

    switch (evento.key) {
      case 'ArrowDown':
        evento.preventDefault();
        this.abierto.set(true);
        if (total > 0) this.indiceResaltado.update((i) => (i + 1) % total);
        break;

      case 'ArrowUp':
        evento.preventDefault();
        if (total > 0) this.indiceResaltado.update((i) => (i - 1 + total) % total);
        break;

      case 'Enter': {
        // Evita que Enter envíe el formulario mientras se está eligiendo.
        if (!this.abierto()) break;
        evento.preventDefault();
        const opcion = this.filtradas()[this.indiceResaltado()];
        if (opcion) this.elegir(opcion);
        break;
      }

      case 'Escape':
        this.abierto.set(false);
        this.busqueda.set(null);
        break;
    }
  }

  protected elegir(opcion: OpcionSelector): void {
    if (opcion.deshabilitada) return;

    this.valorActual.set(opcion.valor);
    this.busqueda.set(null);
    this.abierto.set(false);
    this.alCambiar(opcion.valor);
    this.seleccion.emit(opcion.valor);
  }

  protected limpiar(): void {
    this.valorActual.set('');
    this.busqueda.set(null);
    this.abierto.set(false);
    this.alCambiar('');
    this.seleccion.emit('');
  }
}
