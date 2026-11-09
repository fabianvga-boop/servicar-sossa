import { DatePipe } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { EstadoZonaVehiculo } from '../../core/models/enums';
import { VehiculoZona } from '../../core/models/personas.model';
import { POLIGONOS } from './inspeccion-poligonos';

/** Lo que se registra al marcar una zona. */
export interface DatosZona {
  zona: string;
  estado: EstadoZonaVehiculo;
  detalle: string | null;
}

interface ZonaDef {
  codigo: string;
  etiqueta: string;
}

interface Sector {
  titulo: string;
  zonas: ZonaDef[];
}

/**
 * Las partes del vehículo que se revisan al recibirlo, por sectores. Cada código es
 * una zona tocable de la planilla (ver inspeccion-poligonos.ts); interior y otro solo
 * están en la lista. Las marcas de códigos que ya no existen (del diagrama anterior)
 * se siguen mostrando en «Marcas anteriores».
 */
export const SECTORES_INSPECCION: Sector[] = [
  {
    titulo: 'Frente',
    zonas: [
      { codigo: 'parachoques_delantero', etiqueta: 'Parachoques delantero' },
      { codigo: 'capo', etiqueta: 'Capó' },
      { codigo: 'parabrisas', etiqueta: 'Parabrisas' },
      { codigo: 'faros_delanteros', etiqueta: 'Faros delanteros' },
    ],
  },
  {
    titulo: 'Costado izquierdo',
    zonas: [
      { codigo: 'guardabarros_del_izq', etiqueta: 'Guardabarros delantero (izquierdo)' },
      { codigo: 'puerta_del_izq', etiqueta: 'Puerta delantera (izquierda)' },
      { codigo: 'puerta_tras_izq', etiqueta: 'Puerta trasera (izquierda)' },
      { codigo: 'guardabarros_tras_izq', etiqueta: 'Guardabarros trasero (izquierdo)' },
      { codigo: 'espejo_izquierdo', etiqueta: 'Espejo izquierdo' },
    ],
  },
  {
    titulo: 'Costado derecho',
    zonas: [
      { codigo: 'guardabarros_del_der', etiqueta: 'Guardabarros delantero (derecho)' },
      { codigo: 'puerta_del_der', etiqueta: 'Puerta delantera (derecha)' },
      { codigo: 'puerta_tras_der', etiqueta: 'Puerta trasera (derecha)' },
      { codigo: 'guardabarros_tras_der', etiqueta: 'Guardabarros trasero (derecho)' },
      { codigo: 'espejo_derecho', etiqueta: 'Espejo derecho' },
    ],
  },
  {
    titulo: 'Atrás',
    zonas: [
      { codigo: 'baul', etiqueta: 'Maletero / portón' },
      { codigo: 'luneta', etiqueta: 'Luneta trasera' },
      { codigo: 'luces_traseras', etiqueta: 'Luces traseras' },
      { codigo: 'parachoques_trasero', etiqueta: 'Parachoques trasero' },
    ],
  },
  {
    titulo: 'Arriba y abajo',
    zonas: [
      { codigo: 'techo', etiqueta: 'Techo' },
      { codigo: 'llantas', etiqueta: 'Llantas' },
    ],
  },
  {
    titulo: 'Interior y otros',
    zonas: [
      { codigo: 'interior', etiqueta: 'Interior y tapizado' },
      { codigo: 'otro', etiqueta: 'Otra parte (describa cuál)' },
    ],
  },
];

/** Marca que resume la revisión completa cuando el vehículo llega sin daños visibles. */
export const ZONA_GENERAL = 'general';

/**
 * Nombre legible de una zona por su código ("capo" → "Capó"). Las marcas de
 * códigos que ya no están en la lista (del diagrama anterior) se muestran con
 * el código, sin guiones bajos.
 */
export function etiquetaZona(codigo: string): string {
  if (codigo === ZONA_GENERAL) return 'Revisión general';
  for (const sector of SECTORES_INSPECCION) {
    const zona = sector.zonas.find((z) => z.codigo === codigo);
    if (zona) return zona.etiqueta;
  }
  const texto = codigo.replace(/_/g, ' ');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

const CODIGOS_DE_LA_LISTA = new Set(SECTORES_INSPECCION.flatMap((s) => s.zonas.map((z) => z.codigo)));


type ClaveVista = 'todo' | 'arriba' | 'izquierda' | 'derecha' | 'frente' | 'atras';

interface Vista {
  clave: ClaveVista;
  titulo: string;
  /** Recorte del lienzo de la planilla (1400 x 775) */
  vb: string;
  grupos: ('izquierda' | 'frente' | 'arriba' | 'atras')[];
  /** El costado derecho es el izquierdo espejado */
  espejo?: boolean;
}

const VISTAS: Vista[] = [
  { clave: 'todo', titulo: 'Planilla', vb: '0 0 1400 775', grupos: ['izquierda', 'frente', 'arriba', 'atras'] },
  { clave: 'arriba', titulo: 'Arriba', vb: '0 360 975 420', grupos: ['arriba'] },
  { clave: 'izquierda', titulo: 'Izquierda', vb: '0 0 975 305', grupos: ['izquierda'] },
  { clave: 'derecha', titulo: 'Derecha', vb: '0 0 975 305', grupos: ['izquierda'], espejo: true },
  { clave: 'frente', titulo: 'Frente', vb: '995 0 410 305', grupos: ['frente'] },
  { clave: 'atras', titulo: 'Atrás', vb: '995 425 410 300', grupos: ['atras'] },
];

const COLOR_ESTADO: Record<string, string> = { Ok: '#2FA85A', Atencion: '#F59E2B', EnReparacion: '#3B82F6' };

/** Códigos de las partes que se ven (y se pueden tocar) en una vista. */
function codigosDe(v: Vista): Set<string> {
  return new Set(v.grupos.flatMap((g) => POLIGONOS[g].map((p) => (v.espejo ? (p.zd ?? p.z) : p.z))));
}

/**
 * Inspección del vehículo: la planilla del auto (lateral, frente, arriba y atrás) donde se
 * toca una parte, más la lista de partes por sectores. Cada parte tiene su estado (Sin
 * novedad, Con daño, En reparación) y una nota. Es opcional: el atajo «Llegó sin daños
 * visibles» deja anotado todo de una vez. Cada marca queda como un evento nuevo: se muestra
 * la última de cada parte y el historial no se pisa.
 */
@Component({
  selector: 'app-inspeccion-vehiculo',
  imports: [FormsModule, DatePipe],
  template: `
    @if (resumen().conNovedad === 0 && resumen().revisadas === 0) {
      <p class="resumen">Todavía no se marcó ninguna parte.</p>
    } @else {
      <p class="resumen">
        @if (resumen().danios > 0) {
          <span class="insignia insignia-naranja con-icono ic-alerta">{{ resumen().danios }} con daño</span>
        }
        @if (resumen().reparacion > 0) {
          <span class="insignia insignia-azul con-icono ic-proceso">{{ resumen().reparacion }} en reparación</span>
        }
        @if (resumen().danios === 0 && resumen().reparacion === 0) {
          <span class="insignia insignia-verde con-icono ic-ok">Sin daños registrados</span>
        }
      </p>
    }

    @if (editable() && !hayMarcas()) {
      <div class="atajo">
        <span>¿El cliente dice que llegó sin daños? No hace falta recorrer el auto.</span>
        <button type="button" class="btn btn-secundario btn-sm" [disabled]="guardando()" (click)="sinDanos()">Llegó sin daños visibles</button>
      </div>
    }

    <div class="vistas" role="tablist" aria-label="Vista del vehículo">
      @for (v of vistas; track v.clave) {
        <button type="button" role="tab" class="vista" [class.activa]="vistaActual().clave === v.clave" [attr.aria-selected]="vistaActual().clave === v.clave" (click)="vista.set(v.clave)">
          {{ v.titulo }}
        </button>
      }
    </div>

    <div class="lienzo">
      <svg [attr.viewBox]="vistaActual().vb" role="group" [attr.aria-label]="'Vista ' + vistaActual().titulo.toLowerCase() + ' del vehículo'">
        <defs>
          <clipPath id="insp-recorte"><rect x="0" y="0" width="975" height="305" /></clipPath>
        </defs>
        <g [attr.transform]="vistaActual().espejo ? 'translate(975,0) scale(-1,1)' : null">
          <g [attr.clip-path]="vistaActual().espejo ? 'url(#insp-recorte)' : null">
            <image href="assets/planilla-vehiculo.svg" x="0" y="0" width="1400" height="775" />
          </g>
          @for (p of poligonos(); track $index) {
            <path
              class="hit"
              [class.marcada]="!!actuales().get(p.z)"
              [class.sel]="abierta() === p.z"
              [class.tocable]="editable()"
              [style.--f]="colorDe(p.z)"
              [attr.d]="p.d"
              [attr.tabindex]="editable() ? 0 : null"
              [attr.role]="editable() ? 'button' : null"
              [attr.aria-label]="etiqueta(p.z)"
              (click)="alternar(p.z)"
              (keydown.enter)="alternar(p.z)"
            />
          }
        </g>
      </svg>
    </div>

    <div class="leyenda" aria-hidden="true">
      <span><i class="punto sin"></i>Sin revisar</span>
      <span><i class="punto ok"></i>Sin novedad</span>
      <span><i class="punto dano"></i>Con daño</span>
      <span><i class="punto rep"></i>En reparación</span>
    </div>

    @if (abierta(); as codigo) {
      <div class="editor">
        <div class="editor-titulo">
          <strong>{{ etiqueta(codigo) }}</strong>
          @let act = actuales().get(codigo);
          @if (act) {
            <span class="zona-fecha">Última marca: {{ act.fechaRegistro | date: 'dd/MM/yyyy' }}</span>
          }
        </div>
        <div class="opciones" role="group" [attr.aria-label]="'Estado de ' + etiqueta(codigo)">
          <button type="button" class="opcion" [class.activa]="estado() === EstadoZona.Ok" (click)="estado.set(EstadoZona.Ok)">Sin novedad</button>
          <button type="button" class="opcion" [class.activa]="estado() === EstadoZona.Atencion" (click)="estado.set(EstadoZona.Atencion)">Con daño</button>
          <button type="button" class="opcion" [class.activa]="estado() === EstadoZona.EnReparacion" (click)="estado.set(EstadoZona.EnReparacion)">En reparación</button>
        </div>
        <label class="campo-nota">
          <span>{{ codigo === 'otro' ? 'Qué parte y cómo está' : 'Nota (opcional)' }}@if (codigo === 'otro') { <b class="obligatorio">*</b> }</span>
          <input
            type="text"
            maxlength="300"
            name="detalleZona"
            autocomplete="off"
            [placeholder]="codigo === 'otro' ? 'Ej. Antena rota' : 'Ej. rayón leve, golpe, falta una pieza'"
            [ngModel]="detalle()"
            (ngModelChange)="detalle.set($event); falta.set(false)"
          />
          @if (falta()) {
            <small class="error">Describa qué parte es.</small>
          }
        </label>
        <div class="botones">
          <button type="button" class="btn btn-secundario btn-sm" (click)="abierta.set(null)">Cancelar</button>
          <button type="button" class="btn btn-primario btn-sm" [disabled]="guardando()" (click)="confirmar(codigo)">
            {{ guardando() ? 'Guardando…' : 'Guardar' }}
          </button>
        </div>
      </div>
    } @else if (editable()) {
      <p class="ayuda-dibujo">Toque una parte del dibujo o de la lista para anotar cómo está. Es opcional.</p>
    }

    @for (sector of sectores; track sector.titulo) {
      <section class="sector">
        <h3>{{ sector.titulo }}</h3>
        @for (z of sector.zonas; track z.codigo) {
          @let actual = actuales().get(z.codigo);
          <button
            type="button"
            class="zona-fila"
            [class.abierta]="abierta() === z.codigo"
            [disabled]="!editable()"
            [attr.aria-expanded]="abierta() === z.codigo"
            (click)="alternar(z.codigo, true)"
          >
            <span class="zona-texto">
              <span class="zona-nombre">{{ z.etiqueta }}</span>
              @if (actual?.detalle) {
                <small>{{ actual!.detalle }}</small>
              }
            </span>
            @if (actual) {
              <span class="zona-fecha">{{ actual.fechaRegistro | date: 'dd/MM/yyyy' }}</span>
            }
            @switch (actual?.estado) {
              @case ('Ok') { <span class="insignia insignia-verde con-icono ic-ok">Sin novedad</span> }
              @case ('Atencion') { <span class="insignia insignia-naranja con-icono ic-alerta">Con daño</span> }
              @case ('EnReparacion') { <span class="insignia insignia-azul con-icono ic-proceso">En reparación</span> }
              @default { <span class="sin-revisar">Sin revisar</span> }
            }
          </button>
        }
      </section>
    }

    @if (otras().length > 0) {
      <section class="sector">
        <h3>Marcas anteriores</h3>
        @for (z of otras(); track z.zonaObsId) {
          <div class="zona-fila sin-boton">
            <span class="zona-texto">
              <span class="zona-nombre">{{ etiqueta(z.zona) }}</span>
              @if (z.detalle) {
                <small>{{ z.detalle }}</small>
              }
            </span>
            <span class="zona-fecha">{{ z.fechaRegistro | date: 'dd/MM/yyyy' }}</span>
            @if (z.estado === 'EnReparacion') {
              <span class="insignia insignia-azul con-icono ic-proceso">En reparación</span>
            } @else {
              <span class="insignia insignia-naranja con-icono ic-alerta">Con daño</span>
            }
          </div>
        }
      </section>
    }
  `,
  styles: `
    :host { display: block; }

    .resumen { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0 0 14px; font-size: 13.5px; color: var(--gris-500); }

    .atajo { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 14px; padding: 10px 14px; border: 1px dashed var(--gris-300); border-radius: var(--radio-md); font-size: 13.5px; color: var(--gris-500); }

    .vistas { display: flex; gap: 6px; margin-bottom: 10px; overflow-x: auto; padding-bottom: 2px; }
    .vista { flex: none; padding: 7px 14px; border: 1px solid var(--gris-300); border-radius: 999px; background: var(--blanco); font: inherit; font-weight: 600; font-size: 13.5px; cursor: pointer; }
    .vista:hover { border-color: var(--ink); }
    .vista.activa { background: var(--ink); border-color: var(--ink); color: var(--blanco); }

    .lienzo { border: 1px solid var(--gris-200); border-radius: var(--radio-md); background: var(--blanco); padding: 6px; }
    .lienzo svg { display: block; width: 100%; height: auto; max-height: 440px; }
    .hit { fill: transparent; stroke: none; outline: none; }
    .hit.tocable { cursor: pointer; }
    .hit.tocable:hover { fill: rgba(245, 158, 43, 0.2); }
    .hit.marcada { fill: var(--f); fill-opacity: 0.5; }
    .hit.sel { stroke: var(--ink); stroke-width: 3; stroke-dasharray: 9 6; vector-effect: non-scaling-stroke; }
    .hit:focus-visible { stroke: var(--ink); stroke-width: 3; vector-effect: non-scaling-stroke; }

    .leyenda { display: flex; flex-wrap: wrap; gap: 6px 16px; margin: 8px 2px 12px; font-size: 12.5px; color: var(--gris-500); }
    .punto { display: inline-block; width: 10px; height: 10px; margin-right: 6px; border-radius: 3px; border: 1px solid var(--gris-300); background: var(--blanco); }
    .punto.ok { background: #2FA85A; border-color: #2FA85A; }
    .punto.dano { background: #F59E2B; border-color: #F59E2B; }
    .punto.rep { background: #3B82F6; border-color: #3B82F6; }

    .ayuda-dibujo { margin: 0 0 16px; font-size: 13.5px; color: var(--gris-500); }

    .editor { display: flex; flex-direction: column; gap: 12px; margin-bottom: 18px; padding: 14px; border: 1px solid var(--ink); border-radius: var(--radio-md); background: var(--blanco); }
    .editor-titulo { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 6px; font-size: 14.5px; }
    .opciones { display: flex; flex-wrap: wrap; gap: 8px; }
    .opcion { padding: 8px 14px; border: 1px solid var(--gris-300); border-radius: 999px; background: var(--blanco); font: inherit; font-weight: 600; font-size: 13.5px; cursor: pointer; }
    .opcion:hover { border-color: var(--ink); }
    .opcion.activa { background: var(--ink); border-color: var(--ink); color: var(--blanco); }

    .campo-nota { display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600; }
    .campo-nota input { font: inherit; font-weight: 400; }
    .campo-nota .error { color: var(--brand); font-weight: 500; }
    .obligatorio { color: var(--brand); margin-left: 2px; }
    .botones { display: flex; justify-content: flex-end; gap: 8px; }

    .sector { margin-bottom: 18px; }
    .sector h3 { margin: 0 0 6px; font-size: 11.5px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--gris-500); }

    .zona-fila { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 48px; padding: 9px 14px; border: 1px solid var(--gris-200); border-radius: var(--radio-md); background: var(--blanco); font: inherit; text-align: left; color: inherit; cursor: pointer; }
    .zona-fila + .zona-fila { margin-top: 6px; }
    .zona-fila:disabled, .zona-fila.sin-boton { cursor: default; }
    .zona-fila:not(:disabled):not(.sin-boton):hover { background: var(--gris-50); }
    .zona-fila.abierta { border-color: var(--ink); }

    .zona-texto { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .zona-nombre { font-weight: 600; font-size: 14.5px; }
    .zona-texto small { font-size: 12.5px; color: var(--gris-500); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .zona-fecha { font-size: 12px; color: var(--gris-400); flex: none; }
    .sin-revisar { font-size: 12.5px; color: var(--gris-400); flex: none; }
  `,
})
export class InspeccionVehiculo {
  /** Todas las marcas registradas del vehículo (la lista muestra la última de cada parte). */
  readonly zonas = input.required<VehiculoZona[]>();
  readonly editable = input(false);
  readonly guardando = input(false);

  readonly guardar = output<DatosZona>();

  protected readonly sectores = SECTORES_INSPECCION;
  protected readonly vistas = VISTAS;
  protected readonly EstadoZona = EstadoZonaVehiculo;
  protected readonly etiqueta = etiquetaZona;

  protected readonly vista = signal<ClaveVista>('todo');
  protected readonly abierta = signal<string | null>(null);
  protected readonly estado = signal<EstadoZonaVehiculo>(EstadoZonaVehiculo.Atencion);
  protected readonly detalle = signal('');
  protected readonly falta = signal(false);

  protected readonly vistaActual = computed(() => VISTAS.find((v) => v.clave === this.vista())!);

  /** Zonas tocables de la vista; en el costado derecho se usa la parte del otro lado. */
  protected readonly poligonos = computed(() => {
    const v = this.vistaActual();
    return v.grupos.flatMap((g) => POLIGONOS[g].map((p) => ({ d: p.d, z: v.espejo ? (p.zd ?? p.z) : p.z })));
  });

  /** La última marca de cada parte: es su estado actual. */
  protected readonly actuales = computed(() => {
    const ultimas = new Map<string, VehiculoZona>();
    for (const z of [...this.zonas()].sort((a, b) => b.fechaRegistro.localeCompare(a.fechaRegistro))) {
      if (!ultimas.has(z.zona)) ultimas.set(z.zona, z);
    }
    return ultimas;
  });

  protected readonly hayMarcas = computed(() => this.zonas().length > 0);

  /** Marcas de partes que ya no están en la lista (del diagrama anterior), solo las que tienen novedad. */
  protected readonly otras = computed(() =>
    [...this.actuales().values()].filter(
      (z) => !CODIGOS_DE_LA_LISTA.has(z.zona) && z.zona !== ZONA_GENERAL && z.estado !== 'Ok',
    ),
  );

  protected readonly resumen = computed(() => {
    const todas = [...this.actuales().values()];
    return {
      danios: todas.filter((z) => z.estado === 'Atencion').length,
      reparacion: todas.filter((z) => z.estado === 'EnReparacion').length,
      conNovedad: todas.filter((z) => z.estado !== 'Ok').length,
      revisadas: todas.length,
    };
  });

  protected colorDe(codigo: string): string {
    return COLOR_ESTADO[this.actuales().get(codigo)?.estado ?? ''] ?? 'transparent';
  }

  /** Abre el editor de una parte; si viene de la lista, salta a la vista donde se ve. */
  protected alternar(codigo: string, desdeLista = false): void {
    if (!this.editable()) return;
    if (this.abierta() === codigo) {
      this.abierta.set(null);
      return;
    }
    const actual = this.actuales().get(codigo);
    // Lo normal al revisar es anotar un daño; si ya lo tiene, se propone el estado actual.
    this.estado.set(
      actual?.estado === 'EnReparacion' ? EstadoZonaVehiculo.EnReparacion : EstadoZonaVehiculo.Atencion,
    );
    this.detalle.set('');
    this.falta.set(false);
    this.abierta.set(codigo);
    if (desdeLista && this.vista() !== 'todo' && !codigosDe(this.vistaActual()).has(codigo)) {
      const destino = VISTAS.filter((v) => v.clave !== 'todo').find((v) => codigosDe(v).has(codigo));
      if (destino) this.vista.set(destino.clave);
    }
  }

  protected sinDanos(): void {
    this.guardar.emit({ zona: ZONA_GENERAL, estado: EstadoZonaVehiculo.Ok, detalle: 'Llegó sin daños visibles' });
  }

  protected confirmar(codigo: string): void {
    const nota = this.detalle().trim();
    if (codigo === 'otro' && !nota) {
      this.falta.set(true);
      return;
    }
    this.guardar.emit({ zona: codigo, estado: this.estado(), detalle: nota || null });
    this.abierta.set(null);
  }
}
