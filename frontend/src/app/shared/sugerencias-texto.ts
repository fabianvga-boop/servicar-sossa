/**
 * Utilidad compartida para armar listas de autocompletado ("escriba menos, elija
 * más") a partir de datos que ya existen en el sistema. La usan los módulos que
 * ofrecen un `<datalist>` sobre un campo de texto libre (dirección, nombre de
 * servicio, etc.), además de `vehiculo-sugerencias.ts`.
 */
export function unicosOrdenados(valores: (string | null | undefined)[]): string[] {
  const limpios = valores.map((v) => v?.trim()).filter((v): v is string => !!v);
  return [...new Set(limpios)].sort((a, b) => a.localeCompare(b));
}
