import {
  Component,
  ElementRef,
  computed,
  effect,
  forwardRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import { coincidePorPalabras, normalizarTexto } from '../busqueda';

/** Etiqueta de color de una opción: lo que tiene que verse de un vistazo. */
export interface MarcaOpcion {
  texto: string;
  tono: 'verde' | 'naranja' | 'roja' | 'azul' | 'gris';
}

export interface OpcionSelector {
  valor: string;
  etiqueta: string;
  /** Línea secundaria: precio, stock, placa… lo que ayude a elegir. */
  detalle?: string;
  /**
   * Avisos que tienen que verse de un vistazo ("Para este servicio",
   * "Compatible", "Stock bajo"): van como etiquetas de color en una segunda
   * línea bajo el nombre, no perdidos en el detalle.
   */
  marcas?: MarcaOpcion[];
  /**
   * Foto para reconocer la opción de un vistazo (un repuesto). Con url null
   * se muestran las iniciales de la etiqueta en su lugar.
   */
  miniatura?: { url: string | null };
  deshabilitada?: boolean;
  /** Motivo por el que no se puede elegir, como ayuda contextual. */
  razonDeshabilitada?: string;
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
        #campo
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
        (mouseup)="alSoltarClic($event)"
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

      <!-- La flecha avisa que hay una lista para elegir; la lista no se abre
           sola al entrar al campo: se abre con la flecha, al escribir o con ↓. -->
      @if (!deshabilitado()) {
        <button
          type="button"
          class="desplegar"
          tabindex="-1"
          [class.abierta]="abierto()"
          [attr.aria-label]="abierto() ? 'Cerrar la lista' : 'Ver todas las opciones'"
          [title]="abierto() ? 'Cerrar la lista' : 'Ver todas las opciones'"
          (mousedown)="$event.preventDefault()"
          (click)="alternarLista()"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      }

      @if (abierto()) {
        <ul
          #lista
          class="lista"
          role="listbox"
          [attr.popover]="esFlotante() ? 'manual' : null"
          [class.en-linea]="listaEnLinea()"
          [class.flotante]="esFlotante()"
        >
          @if (filtradas().length === 0) {
            <li class="sin-resultados">Sin coincidencias para <strong>{{ busqueda() }}</strong></li>
          } @else {
            @for (opcion of filtradas(); track opcion.valor; let i = $index) {
              <li
                role="option"
                [attr.aria-selected]="opcion.valor === valorActual()"
                [class.resaltada]="i === indiceResaltado()"
                [class.no-disponible]="opcion.deshabilitada"
                [class.con-marcas]="!!opcion.marcas?.length"
                [class.con-miniatura]="!!opcion.miniatura"
                [title]="opcion.razonDeshabilitada ?? ''"
                (mousedown)="$event.preventDefault()"
                (click)="elegir(opcion)"
                (mouseenter)="indiceResaltado.set(i)"
              >
                @if (opcion.miniatura; as miniatura) {
                  @if (miniatura.url) {
                    <img class="miniatura" [src]="miniatura.url" alt="" loading="lazy" />
                  } @else {
                    <span class="miniatura miniatura-vacia" aria-hidden="true">{{ iniciales(opcion.etiqueta) }}</span>
                  }
                }
                @if (opcion.marcas?.length) {
                  <span class="contenido">
                  <span class="fila-principal">
                    <span class="etiqueta">{{ opcion.etiqueta }}</span>
                    @if (opcion.detalle) {
                      <span class="detalle">{{ opcion.detalle }}</span>
                    }
                  </span>
                  <span class="marcas">
                    @for (marca of opcion.marcas; track marca.texto) {
                      <span class="marca insignia insignia-{{ marca.tono }}">{{ marca.texto }}</span>
                    }
                  </span>
                  </span>
                } @else {
                  <span class="etiqueta">{{ opcion.etiqueta }}</span>
                  @if (opcion.detalle) {
                    <span class="detalle">{{ opcion.detalle }}</span>
                  }
                }
              </li>
            }
          }
          @if (accionCrear()) {
            <li
              class="accion-crear"
              [class.resaltada]="filtradas().length === 0"
              (mousedown)="$event.preventDefault()"
              (click)="pedirCrear()"
            >
              <span class="accion-crear-mas" aria-hidden="true">+</span>
              @if (busqueda()?.trim(); as texto) {
                <span>Crear {{ accionCrear() }}: <strong>{{ texto }}</strong></span>
              } @else {
                <span>Crear {{ accionCrear() }}</span>
              }
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: `
    .selector { position: relative; }

    /* Lugar para la X y la flecha a la derecha, sin que tapen el texto. */
    .selector input { padding-right: 64px; }

    .desplegar {
      position: absolute;
      top: 50%;
      right: 6px;
      transform: translateY(-50%);
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      padding: 0;
      border: none;
      border-radius: var(--radio-sm);
      background: none;
      color: var(--ink-soft);
      cursor: pointer;
    }

    .desplegar:hover { background: var(--gris-100); color: var(--ink); }

    .desplegar svg {
      width: 18px;
      height: 18px;
      transition: transform 0.15s;
    }

    .desplegar.abierta svg { transform: rotate(180deg); }

    .limpiar {
      position: absolute;
      top: 50%;
      right: 36px;
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
      /* En una columna angosta (fila de una grilla) la lista igual se lee. */
      min-width: 220px;
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
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 7px 10px;
      border-radius: var(--radio-sm);
      font-size: 13px;
      cursor: pointer;
    }

    .lista li.resaltada { background: var(--gris-100); }

    /* Lo que ya está elegido se reconoce en la lista. */
    .lista li[aria-selected='true'] .etiqueta { color: var(--brand-dk); }
    .lista li[aria-selected='true'] .etiqueta::before { content: '✓ '; }

    /* Con etiquetas: nombre y detalle arriba, etiquetas abajo. */
    .lista li.con-marcas {
      align-items: center;
      gap: 11px;
      padding: 9px 10px;
    }

    .contenido {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .miniatura {
      width: 46px;
      height: 46px;
      flex-shrink: 0;
      border: 1px solid var(--gris-200);
      border-radius: var(--radio-sm);
      object-fit: cover;
      background: var(--blanco);
    }

    .miniatura-vacia {
      display: grid;
      place-items: center;
      background: var(--gris-100);
      color: var(--gris-500);
      font-size: 14px;
      font-weight: 700;
    }

    /*
     * Flotante: la lista sube a la capa superior del navegador (popover), así
     * no la recorta ni le pone barra de desplazamiento la tabla o la ventana
     * que contiene al campo. Su lugar en pantalla se calcula desde el campo.
     */
    .lista.flotante {
      position: fixed;
      inset: auto;
      margin: 0;
      color: inherit;
    }

    /* Fija al pie: con la lista completa se ve sin tener que bajar hasta el final. */
    .accion-crear {
      position: sticky;
      bottom: -4px;
      background: var(--blanco);
      justify-content: flex-start !important;
      gap: 8px !important;
      margin-top: 4px;
      border-top: 1px solid var(--gris-200);
      border-radius: 0 0 var(--radio-sm) var(--radio-sm) !important;
      color: var(--brand-dk);
      font-weight: 500;
    }

    .accion-crear-mas {
      display: grid;
      place-items: center;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: var(--brand-soft);
      font-size: 15px;
      font-weight: 700;
      flex-shrink: 0;
    }

    .lista.en-linea {
      position: static;
      margin-top: 4px;
      box-shadow: none;
    }

    /* Filas con foto son más altas: la lista crece para mostrar varias. */
    .lista:has(li.con-miniatura) { max-height: min(360px, 50vh); }

    .lista li.con-miniatura:not(.con-marcas) { justify-content: flex-start; }
    .lista li.con-miniatura:not(.con-marcas) .detalle { margin-left: auto; }

    .lista li.con-marcas + li.con-marcas { border-top: 1px solid var(--gris-100); }

    .fila-principal {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 10px;
    }

    .marcas {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }

    /* No disponible: se nota, pero sin borrar el texto (su motivo va en la
       marca o en el title). */
    .lista li.no-disponible {
      opacity: 0.7;
      cursor: not-allowed;
    }

    .lista li.no-disponible .etiqueta { text-decoration: line-through; }

    .etiqueta { font-weight: 500; color: var(--ink); }

    .marca { padding: 2px 9px; font-size: 11.5px; }

    .detalle {
      font-size: 12.5px;
      color: var(--ink-soft);
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
  /** Dos letras del nombre para la miniatura de una opción sin foto. */
  protected iniciales(etiqueta: string): string {
    // Sin "de", "la", "y": "Filtro de prueba" → "FP", no "FD".
    const palabras = etiqueta.trim().split(/\s+/).filter((p) => p.length > 2);
    return (palabras.length > 1 ? palabras[0][0] + palabras[1][0] : etiqueta.slice(0, 2)).toUpperCase();
  }

  readonly opciones = input<OpcionSelector[]>([]);
  readonly marcador = input('Escriba para buscar…');
  readonly idCampo = input('');
  readonly invalido = input(false);

  /**
   * Cómo se llama un valor nuevo ("marca nueva", "modelo nuevo"). Si se indica, lo escrito que no
   * esté en la lista aparece al final como opción para agregarlo: se puede
   * cargar un valor nuevo, pero solo eligiéndolo a propósito, no por tipear
   * algo parecido a uno existente. En ese caso el valor es el propio texto.
   */
  readonly permitirNuevo = input('');

  /**
   * La lista se abre dentro del flujo (empuja lo de abajo) en vez de flotar.
   * Dentro de una ventana corta evita que el borde la recorte.
   */
  readonly listaEnLinea = input(false);

  /**
   * La lista flota por encima de todo (capa superior del navegador), en todo
   * el sistema: dentro de una ventana o de una tabla con desplazamiento, una
   * lista común quedaba recortada y había que buscarla con la barra.
   */
  readonly flotante = input(true);

  /** Una lista en línea (dentro del flujo) nunca flota. */
  protected readonly esFlotante = computed(() => this.flotante() && !this.listaEnLinea());

  /**
   * Qué se puede crear desde la lista ("repuesto nuevo"). Si se indica, al
   * final de la lista aparece "Crear …" con lo escrito, y se avisa por
   * `crear`: quien usa el selector abre su propio formulario.
   */
  readonly accionCrear = input('');
  readonly crear = output<string>();

  private readonly campo = viewChild<ElementRef<HTMLInputElement>>('campo');
  private readonly lista = viewChild<ElementRef<HTMLUListElement>>('lista');

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

  constructor() {
    // Lista flotante: se muestra en la capa superior y sigue al campo si la
    // página o la ventana se desplazan mientras está abierta.
    effect((alLimpiar) => {
      const lista = this.lista()?.nativeElement;
      if (!lista || !this.esFlotante()) return;

      lista.showPopover?.();
      const ubicar = () => this.ubicarLista(lista);
      ubicar();
      window.addEventListener('scroll', ubicar, true);
      window.addEventListener('resize', ubicar);
      alLimpiar(() => {
        window.removeEventListener('scroll', ubicar, true);
        window.removeEventListener('resize', ubicar);
      });
    });
  }

  /** Debajo del campo; si abajo no hay lugar, encima. Nunca más angosta que 320 px. */
  private ubicarLista(lista: HTMLElement): void {
    const campo = this.campo()?.nativeElement;
    if (!campo) return;

    const r = campo.getBoundingClientRect();
    const ancho = Math.min(Math.max(r.width, 320), window.innerWidth - 16);
    const izquierda = Math.min(r.left, window.innerWidth - ancho - 8);
    const abajo = window.innerHeight - r.bottom;

    lista.style.left = `${Math.max(8, izquierda)}px`;
    lista.style.width = `${ancho}px`;
    if (abajo < 260 && r.top > abajo) {
      lista.style.top = 'auto';
      lista.style.bottom = `${window.innerHeight - r.top + 3}px`;
      lista.style.maxHeight = `${Math.min(360, r.top - 16)}px`;
    } else {
      lista.style.bottom = 'auto';
      lista.style.top = `${r.bottom + 3}px`;
      lista.style.maxHeight = `${Math.min(360, abajo - 16)}px`;
    }
  }

  private alCambiar: (valor: string) => void = () => {};
  private alTocar: () => void = () => {};

  protected readonly etiquetaSeleccionada = computed(
    () =>
      this.opciones().find((o) => o.valor === this.valorActual())?.etiqueta ??
      (this.permitirNuevo() ? this.valorActual() : ''),
  );

  protected readonly textoVisible = computed(
    () => this.busqueda() ?? this.etiquetaSeleccionada(),
  );

  protected readonly filtradas = computed(() => {
    const criterio = this.busqueda();

    // Recién abierto (sin teclear) se ofrece la lista completa.
    if (criterio === null || criterio.trim() === '') return this.opciones();

    // Cada palabra en la etiqueta o en el detalle: "Hilux Mendoza" encuentra
    // el vehículo aunque la placa y el dueño estén en líneas distintas.
    const coincidentes = this.opciones().filter((o) =>
      coincidePorPalabras(criterio, o.etiqueta, o.detalle),
    );

    const texto = criterio.trim();
    if (!this.permitirNuevo() || this.coincidenciaExacta(texto)) return coincidentes;

    // Al final, para que Enter prefiera lo que ya existe en la lista.
    return [
      ...coincidentes,
      { valor: texto, etiqueta: `+ ${texto}`, detalle: `agregar ${this.permitirNuevo()}` },
    ];
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

  /** Se pidió seleccionar el texto al soltar el clic que enfocó el campo. */
  private seleccionarAlSoltar = false;

  /**
   * Al entrar al campo no se borra lo elegido ni se abre la lista: antes el
   * nombre desaparecía y parecía que se había perdido la selección. El texto
   * queda seleccionado, así lo que se escriba lo reemplaza para buscar otro.
   */
  protected alEnfocar(): void {
    this.campo()?.nativeElement.select();
    this.seleccionarAlSoltar = true;
  }

  /**
   * Un clic sobre lo ya elegido lo selecciona entero (también si el campo ya
   * estaba activo), así lo que se escriba lo reemplaza. Mientras se busca, el
   * clic se comporta normal para poder corregir lo escrito.
   */
  protected alSoltarClic(evento: MouseEvent): void {
    const campo = this.campo()?.nativeElement;
    if (!campo) return;
    const arrastro = campo.selectionStart !== campo.selectionEnd && !this.seleccionarAlSoltar;
    this.seleccionarAlSoltar = false;
    if (this.busqueda() !== null || arrastro) return;
    evento.preventDefault();
    campo.select();
  }

  /** La flecha: muestra todas las opciones, con lo elegido resaltado. */
  protected alternarLista(): void {
    if (this.abierto()) {
      this.abierto.set(false);
      this.busqueda.set(null);
      return;
    }
    this.campo()?.nativeElement.focus();
    this.seleccionarAlSoltar = false;
    this.abrirCompleta();
  }

  private abrirCompleta(): void {
    this.busqueda.set(null);
    const elegida = this.opciones().findIndex((o) => o.valor === this.valorActual());
    this.indiceResaltado.set(Math.max(0, elegida));
    this.abierto.set(true);
  }

  protected alEscribir(texto: string): void {
    // Si se escribió a continuación del nombre elegido (el texto no estaba
    // seleccionado), se busca solo lo nuevo: "Juana Bravo" + "lote" busca "lote".
    const etiqueta = this.etiquetaSeleccionada();
    if (this.busqueda() === null && etiqueta && texto.length > etiqueta.length && texto.startsWith(etiqueta)) {
      texto = texto.slice(etiqueta.length);
      const campo = this.campo()?.nativeElement;
      if (campo) campo.value = texto;
    }
    this.busqueda.set(texto);
    this.indiceResaltado.set(0);
    this.abierto.set(true);
  }

  protected alSalir(): void {
    // Quien escribe el nombre completo y pasa al campo siguiente con Tab
    // espera que quede elegido, aunque no haya pulsado Enter.
    const exacta = this.permitirNuevo() ? this.coincidenciaExacta(this.busqueda()?.trim() ?? '') : null;
    if (exacta && exacta.valor !== this.valorActual()) {
      this.elegir(exacta);
      this.alTocar();
      return;
    }

    this.abierto.set(false);
    this.busqueda.set(null);
    this.alTocar();
  }

  protected alTeclear(evento: KeyboardEvent): void {
    const total = this.filtradas().length;

    switch (evento.key) {
      case 'ArrowDown':
        evento.preventDefault();
        // Cerrada, la flecha abajo la abre completa (como la flecha del campo).
        if (!this.abierto()) {
          this.abrirCompleta();
          break;
        }
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
        else if (this.accionCrear()) this.pedirCrear();
        break;
      }

      case 'Escape':
        // Con la lista abierta, Escape solo la cierra: sin esto el mismo
        // Escape llegaba al modal y cerraba el formulario entero.
        if (this.abierto()) evento.stopPropagation();
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

  /** "Crear …": cierra la lista y entrega lo escrito para usarlo de nombre. */
  protected pedirCrear(): void {
    const texto = this.busqueda()?.trim() ?? '';
    this.abierto.set(false);
    this.busqueda.set(null);
    this.crear.emit(texto);
  }

  /** Opción cuya etiqueta es exactamente el texto, sin mirar mayúsculas ni tildes. */
  private coincidenciaExacta(texto: string): OpcionSelector | null {
    if (!texto) return null;
    const buscado = normalizarTexto(texto);
    return this.opciones().find((o) => normalizarTexto(o.etiqueta) === buscado) ?? null;
  }

  protected limpiar(): void {
    this.valorActual.set('');
    this.busqueda.set(null);
    this.abierto.set(false);
    this.alCambiar('');
    this.seleccion.emit('');
  }
}
