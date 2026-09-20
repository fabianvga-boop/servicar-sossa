import { HttpClient } from '@angular/common/http';
import {
  Component,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
  computed,
} from '@angular/core';

import { TipoCarroceria, VehiculoZona } from '../../core/models/personas.model';
import { urlArchivo } from '../../core/services/api-base';

/** Familia de silueta que realmente dibuja el SVG (varios tipos comparten forma). */
type Familia = 'sedan' | 'suv' | 'pickup' | 'furgon' | 'moto' | 'generico';

const FAMILIA_POR_TIPO: Record<TipoCarroceria, Familia> = {
  Sedan: 'sedan',
  Hatchback: 'sedan',
  Suv: 'suv',
  Pickup: 'pickup',
  Furgon: 'furgon',
  Camion: 'furgon',
  Moto: 'moto',
  Generico: 'generico',
};

/** Zonas clicables por familia, en el orden en que se listan bajo el diagrama. */
const ZONAS_POR_FAMILIA: Record<Familia, { codigo: string; etiqueta: string }[]> = {
  sedan: [
    { codigo: 'parachoques_delantero', etiqueta: 'Parachoques delantero' },
    { codigo: 'capo', etiqueta: 'Capó' },
    { codigo: 'parabrisas', etiqueta: 'Parabrisas' },
    { codigo: 'techo', etiqueta: 'Techo' },
    { codigo: 'puerta_izquierda', etiqueta: 'Puertas (izquierda)' },
    { codigo: 'puerta_derecha', etiqueta: 'Puertas (derecha)' },
    { codigo: 'parte_trasera', etiqueta: 'Maletero y parachoques trasero' },
  ],
  suv: [
    { codigo: 'parachoques_delantero', etiqueta: 'Parachoques delantero' },
    { codigo: 'capo', etiqueta: 'Capó' },
    { codigo: 'parabrisas', etiqueta: 'Parabrisas' },
    { codigo: 'techo', etiqueta: 'Techo' },
    { codigo: 'puerta_izquierda', etiqueta: 'Puertas (izquierda)' },
    { codigo: 'puerta_derecha', etiqueta: 'Puertas (derecha)' },
    { codigo: 'parte_trasera', etiqueta: 'Maletero y parachoques trasero' },
  ],
  pickup: [
    { codigo: 'parachoques_delantero', etiqueta: 'Parachoques delantero' },
    { codigo: 'capo', etiqueta: 'Capó' },
    { codigo: 'parabrisas', etiqueta: 'Parabrisas' },
    { codigo: 'cabina', etiqueta: 'Cabina (techo)' },
    { codigo: 'puerta_izquierda', etiqueta: 'Puertas (izquierda)' },
    { codigo: 'puerta_derecha', etiqueta: 'Puertas (derecha)' },
    { codigo: 'platon', etiqueta: 'Platón de carga' },
  ],
  furgon: [
    { codigo: 'parachoques_delantero', etiqueta: 'Parachoques delantero' },
    { codigo: 'cabina', etiqueta: 'Cabina' },
    { codigo: 'puerta_izquierda', etiqueta: 'Puertas (izquierda)' },
    { codigo: 'puerta_derecha', etiqueta: 'Puertas (derecha)' },
    { codigo: 'caja_carga', etiqueta: 'Caja de carga' },
  ],
  moto: [
    { codigo: 'faro_delantero', etiqueta: 'Faro delantero' },
    { codigo: 'tanque', etiqueta: 'Tanque' },
    { codigo: 'asiento', etiqueta: 'Asiento' },
    { codigo: 'rueda_delantera', etiqueta: 'Rueda delantera' },
    { codigo: 'rueda_trasera', etiqueta: 'Rueda trasera' },
  ],
  generico: [{ codigo: 'general', etiqueta: 'Vehículo (general)' }],
};

/** Etiquetas y atributos que jamás deben sobrevivir en un SVG subido por un usuario. */
const ETIQUETAS_PELIGROSAS = ['script', 'foreignobject', 'iframe', 'embed', 'object', 'style'];

/**
 * Diagrama vectorial del vehículo con zonas clicables (USU022-USU025,
 * USU012-016): en vez de anotar daños/observaciones solo como texto libre,
 * el mecánico marca la zona directamente sobre una silueta.
 *
 * Si `svgUrl` apunta a una plantilla de la biblioteca (Marca+Modelo real,
 * cargada por el Administrador en "Plantillas de vehículo"), se usa ESE SVG
 * tal cual — fiel al vehículo real, no un dibujo genérico. El SVG subido debe
 * marcar cada zona clicable con `data-zona="codigo"` (y opcionalmente
 * `data-etiqueta="Nombre legible"`); si no hay plantilla para ese Marca+Modelo,
 * se cae a la silueta genérica por tipo de carrocería.
 *
 * El SVG se inserta como nodos reales del DOM (no vía `[innerHTML]`): el
 * sanitizador de Angular no reconoce el espacio de nombres SVG y descarta el
 * documento entero. En su lugar se parsea con `DOMParser` y se le aplica acá
 * mismo un saneo mínimo (quitar `<script>`, manejadores `on*`, `javascript:`)
 * antes de anexarlo — el mismo criterio, aplicado a mano porque el subidor es
 * siempre un Administrador y el contenido no es HTML de un tercero cualquiera.
 */
@Component({
  selector: 'app-diagrama-vehiculo',
  templateUrl: './diagrama-vehiculo.html',
  styleUrl: './diagrama-vehiculo.css',
})
export class DiagramaVehiculo {
  private readonly http = inject(HttpClient);

  readonly tipoCarroceria = input.required<TipoCarroceria>();
  /** URL de la plantilla específica del vehículo (Marca+Modelo), si existe. */
  readonly svgUrl = input<string | null>(null);
  /** Historial completo de eventos; el componente se queda solo con el último por zona. */
  readonly zonas = input<VehiculoZona[]>([]);
  readonly interactivo = input(true);
  /** Zona resaltada externamente (ej. la que se está editando en un popover). */
  readonly zonaSeleccionada = input<string | null>(null);

  readonly zonaClick = output<string>();

  private readonly contenedorPersonalizado =
    viewChild<ElementRef<HTMLDivElement>>('contenedorPersonalizado');

  protected readonly familia = computed<Familia>(
    () => FAMILIA_POR_TIPO[this.tipoCarroceria()] ?? 'generico',
  );

  /** true mientras haya una plantilla personalizada cargada y lista para insertar. */
  protected readonly hayPersonalizado = signal(false);
  private elementoPersonalizado: SVGSVGElement | null = null;
  /** Zonas encontradas en la plantilla (leídas de sus atributos data-zona/data-etiqueta). */
  protected readonly zonasPersonalizadas = signal<{ codigo: string; etiqueta: string }[]>([]);

  protected readonly listaZonas = computed(() =>
    this.hayPersonalizado() ? this.zonasPersonalizadas() : ZONAS_POR_FAMILIA[this.familia()],
  );

  /** Último estado registrado por zona (las zonas son eventos, no filas que se sobreescriben). */
  protected readonly estadoPorZona = computed<Record<string, VehiculoZona | undefined>>(() => {
    const mapa: Record<string, VehiculoZona> = {};
    for (const z of this.zonas()) {
      const actual = mapa[z.zona];
      if (!actual || new Date(z.fechaRegistro) > new Date(actual.fechaRegistro)) mapa[z.zona] = z;
    }
    return mapa;
  });

  constructor() {
    // Carga (o limpia) el SVG de la plantilla cuando cambia la URL.
    effect(() => {
      const url = this.svgUrl();

      if (!url) {
        this.elementoPersonalizado = null;
        this.zonasPersonalizadas.set([]);
        this.hayPersonalizado.set(false);
        return;
      }

      // La misma URL también se carga como <img> en la vista previa de Plantillas
      // de vehículo (modo no-cors). Si el navegador cachea esa respuesta opaca,
      // esta petición vía HttpClient (modo cors) la reutiliza y falla como si
      // fuera un error de CORS aunque el servidor responda bien. Se evita
      // compartiendo caché con un parámetro que no cambia la respuesta.
      const urlSinCacheCompartida = `${urlArchivo(url)}?v=cors`;

      this.http.get(urlSinCacheCompartida, { responseType: 'text' }).subscribe({
        next: (markup) => {
          const svg = parsearYSanear(markup);
          if (!svg) {
            this.elementoPersonalizado = null;
            this.hayPersonalizado.set(false);
            return;
          }
          this.elementoPersonalizado = svg;
          this.zonasPersonalizadas.set(extraerZonas(svg));
          this.hayPersonalizado.set(true);
        },
        error: () => {
          // Plantilla rota o inaccesible: se cae a la silueta genérica en silencio.
          this.elementoPersonalizado = null;
          this.hayPersonalizado.set(false);
        },
      });
    });

    // El contenedor recién existe en el DOM una vez que `hayPersonalizado()`
    // pasa a true y Angular renderiza el `@if` — por eso se lee `viewChild()`
    // (también una señal) como dependencia: este efecto se re-ejecuta solo
    // cuando el contenedor realmente aparece, sin adivinar el momento a mano.
    effect(() => {
      const listo = this.hayPersonalizado();
      const contenedor = this.contenedorPersonalizado()?.nativeElement;
      if (!listo || !contenedor || !this.elementoPersonalizado) return;
      if (contenedor.firstElementChild !== this.elementoPersonalizado) {
        contenedor.replaceChildren(this.elementoPersonalizado);
      }
      this.pintarZonasPersonalizadas();
    });

    // El estado/selección no viven en Angular (son nodos insertados a mano),
    // así que se pintan/repintan aquí cada vez que cambian.
    effect(() => {
      this.estadoPorZona();
      this.zonaSeleccionada();
      this.pintarZonasPersonalizadas();
    });
  }

  private pintarZonasPersonalizadas(): void {
    const contenedor = this.contenedorPersonalizado()?.nativeElement;
    if (!contenedor) return;

    for (const el of Array.from(contenedor.querySelectorAll<HTMLElement>('[data-zona]'))) {
      const codigo = el.dataset['zona']!;
      const estado = this.estadoPorZona()[codigo]?.estado;
      el.classList.add('zona');
      el.classList.toggle('estado-ok', estado === 'Ok');
      el.classList.toggle('estado-atencion', estado === 'Atencion');
      el.classList.toggle('estado-reparacion', estado === 'EnReparacion');
      el.classList.toggle('seleccionada', this.zonaSeleccionada() === codigo);
    }
  }

  protected onContenedorClick(evento: MouseEvent): void {
    if (!this.interactivo()) return;
    const zona = (evento.target as HTMLElement).closest<HTMLElement>('[data-zona]');
    if (zona?.dataset['zona']) this.zonaClick.emit(zona.dataset['zona']);
  }

  protected claseZona(codigo: string): Record<string, boolean> {
    const estado = this.estadoPorZona()[codigo]?.estado;
    return {
      zona: true,
      seleccionada: this.zonaSeleccionada() === codigo,
      'estado-ok': estado === 'Ok',
      'estado-atencion': estado === 'Atencion',
      'estado-reparacion': estado === 'EnReparacion',
    };
  }

  protected etiquetaEstado(codigo: string): string {
    const estado = this.estadoPorZona()[codigo]?.estado;
    if (estado === 'Ok') return 'Ok';
    if (estado === 'Atencion') return 'Atención';
    if (estado === 'EnReparacion') return 'En reparación';
    return 'Sin marcar';
  }

  protected onZonaClick(codigo: string): void {
    if (this.interactivo()) this.zonaClick.emit(codigo);
  }
}

/** Parsea el SVG de una plantilla y le quita cualquier cosa ejecutable. */
function parsearYSanear(markup: string): SVGSVGElement | null {
  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg || doc.querySelector('parsererror')) return null;

  for (const tag of ETIQUETAS_PELIGROSAS) {
    svg.querySelectorAll(tag).forEach((el) => el.remove());
  }

  for (const el of [svg, ...Array.from(svg.querySelectorAll('*'))]) {
    for (const attr of Array.from(el.attributes)) {
      const nombre = attr.name.toLowerCase();
      const valor = attr.value.trim().toLowerCase();
      if (nombre.startsWith('on') || valor.startsWith('javascript:')) {
        el.removeAttribute(attr.name);
      }
    }
  }

  return svg as unknown as SVGSVGElement;
}

/** Lee los `data-zona`/`data-etiqueta` del SVG ya saneado de una plantilla subida. */
function extraerZonas(svg: SVGSVGElement): { codigo: string; etiqueta: string }[] {
  const vistos = new Set<string>();
  const zonas: { codigo: string; etiqueta: string }[] = [];

  for (const el of Array.from(svg.querySelectorAll('[data-zona]'))) {
    const codigo = el.getAttribute('data-zona');
    if (!codigo || vistos.has(codigo)) continue;
    vistos.add(codigo);
    zonas.push({ codigo, etiqueta: el.getAttribute('data-etiqueta') || codigo });
  }

  return zonas;
}
