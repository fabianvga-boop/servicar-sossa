import { Component, computed, input } from '@angular/core';

interface Parte {
  texto: string;
  resaltado: boolean;
}

/**
 * Lo que va entre comillas (“Cambio de bujías”, "Pago total", 'REP-001') se
 * muestra en negrita y sin las comillas: el nombre se ve de un vistazo y no
 * quedan signos sueltos. También reconoce las comillas angulares (« »)
 * de los registros de auditoría anteriores a este cambio.
 *
 *   <app-texto-resaltado [texto]="aviso.mensaje" />
 */
@Component({
  selector: 'app-texto-resaltado',
  // En una sola línea a propósito: cualquier salto agregaría espacios al texto.
  template: `@for (parte of partes(); track $index) {@if (parte.resaltado) {<strong>{{ parte.texto }}</strong>} @else {<span>{{ parte.texto }}</span>}}`,
  styles: `strong { font-weight: 700; color: inherit; }`,
})
export class TextoResaltado {
  readonly texto = input<string | null | undefined>('');

  protected readonly partes = computed(() => resaltar(this.texto() ?? ''));
}

/**
 * Comillas tipográficas, angulares, rectas dobles, o simples alrededor de un
 * texto corto. Las simples exigen no estar pegadas a una letra por fuera, para
 * no confundir un apóstrofo con una comilla.
 */
const PATRON = /“([^”]+)”|«([^»]+)»|"([^"]+)"|(?<![\p{L}\d])'([^'\n]{1,80})'(?![\p{L}\d])/gu;

export function resaltar(texto: string): Parte[] {
  const partes: Parte[] = [];
  let desde = 0;

  for (const m of texto.matchAll(PATRON)) {
    const inicio = m.index ?? 0;
    if (inicio > desde) partes.push({ texto: texto.slice(desde, inicio), resaltado: false });
    partes.push({ texto: m[1] ?? m[2] ?? m[3] ?? m[4] ?? '', resaltado: true });
    desde = inicio + m[0].length;
  }

  if (desde < texto.length) partes.push({ texto: texto.slice(desde), resaltado: false });
  return partes;
}
