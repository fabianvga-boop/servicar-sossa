import { Repuesto } from '../core/models/inventario.model';
import { normalizarTexto, palabrasDeBusqueda } from './busqueda';

/**
 * Búsqueda por palabras de un repuesto, incluidos sus vehículos compatibles.
 * Es la misma regla que el backend (RepuestoRepository.BuscarAsync): cada
 * palabra debe estar en el código, el nombre, la descripción o en la marca o
 * el modelo de algún vehículo compatible, y un año ("2017") también vale si
 * cae dentro del rango de alguno. Así "Toyota Corolla 2017" encuentra las
 * pastillas indicadas para ese auto aunque su nombre no lo diga.
 */
export function coincideRepuesto(consulta: string | null | undefined, repuesto: Repuesto): boolean {
  const palabras = palabrasDeBusqueda(consulta);
  if (palabras.length === 0) return true;

  const compatibilidades = repuesto.compatibilidades ?? [];
  const texto = [
    repuesto.repuestoId,
    repuesto.nombre,
    repuesto.descripcion,
    ...compatibilidades.flatMap((c) => [c.marca, c.modelo]),
  ]
    .filter((c): c is string => !!c)
    .map(normalizarTexto)
    .join(' ');

  return palabras.every((p) => texto.includes(p) || admiteAnio(repuesto, p));
}

function admiteAnio(repuesto: Repuesto, palabra: string): boolean {
  if (!/^\d{4}$/.test(palabra)) return false;
  const anio = Number(palabra);
  return (repuesto.compatibilidades ?? []).some(
    (c) => (c.anioDesde == null || c.anioDesde <= anio) && (c.anioHasta == null || c.anioHasta >= anio),
  );
}
