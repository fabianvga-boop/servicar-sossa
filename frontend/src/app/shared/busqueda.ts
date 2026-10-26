/**
 * Búsqueda por palabras para los filtros que se hacen en el navegador. Es la
 * misma regla que aplica el backend (ver BusquedaPorPalabras.cs): cada palabra
 * escrita debe aparecer en alguno de los campos, en cualquier orden. Así
 * "Javier Mendoza Salinas" o "Toyota Hilux" encuentran su registro aunque el
 * nombre y el apellido, o la marca y el modelo, sean campos distintos.
 */

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
export function normalizarTexto(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(DIACRITICOS, '');
}

/** Palabras de una consulta, ya normalizadas. Vacío si no se escribió nada. */
export function palabrasDeBusqueda(consulta: string | null | undefined): string[] {
  return normalizarTexto(consulta ?? '')
    .split(/\s+/)
    .filter((p) => p.length > 0);
}

/**
 * True si cada palabra de la consulta aparece en al menos uno de los campos.
 * Una consulta vacía coincide con todo.
 */
export function coincidePorPalabras(
  consulta: string | null | undefined,
  ...campos: (string | null | undefined)[]
): boolean {
  const palabras = palabrasDeBusqueda(consulta);
  if (palabras.length === 0) return true;

  const texto = campos
    .filter((c): c is string => !!c)
    .map(normalizarTexto)
    .join(' ');

  return palabras.every((p) => texto.includes(p));
}
