/**
 * Cuántos días se considera "nuevo" un cliente o vehículo en los selectores.
 * Una semana cubre el caso real: se registra al cliente en recepción y en los
 * días siguientes se le cargan el vehículo, el diagnóstico y la orden.
 */
const DIAS_NUEVO = 7;

/** True si la fecha (ISO, UTC) cae dentro de los últimos {@link DIAS_NUEVO} días. */
export function esReciente(fechaIso: string | null | undefined): boolean {
  if (!fechaIso) return false;
  const fecha = new Date(fechaIso).getTime();
  return !Number.isNaN(fecha) && Date.now() - fecha < DIAS_NUEVO * 24 * 60 * 60 * 1000;
}

/** Antepone "Nuevo ·" al detalle de una opción registrada hace pocos días. */
export function detalleConNuevo(detalle: string | null | undefined, fechaIso: string | null | undefined): string {
  const base = detalle ?? '';
  return esReciente(fechaIso) ? (base ? `Nuevo · ${base}` : 'Nuevo') : base;
}
