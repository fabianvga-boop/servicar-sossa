/**
 * Borradores de formularios largos (un diagnóstico extenso, por ejemplo).
 *
 * Si la sesión se cierra por inactividad con el formulario a medio llenar, lo
 * escrito queda guardado en este navegador y se ofrece recuperarlo al volver.
 * El prefijo no empieza con "servicar." a propósito: el cierre de sesión borra
 * esas claves, y justamente el borrador tiene que sobrevivir a ese cierre.
 * Cada borrador es de un usuario, así otro que use la misma PC no lo ve.
 */
const PREFIJO = 'borrador.';

/** Un borrador más viejo que esto ya no es trabajo en curso: se descarta. */
const VIGENCIA_MS = 7 * 24 * 60 * 60 * 1000;

export interface Borrador<T> {
  datos: T;
  /** Cuándo se guardó por última vez (ISO). */
  fecha: string;
}

function claveDe(usuarioId: string, clave: string): string {
  return `${PREFIJO}${usuarioId}.${clave}`;
}

export function guardarBorrador<T>(usuarioId: string | null, clave: string, datos: T): void {
  if (!usuarioId) return;
  try {
    const borrador: Borrador<T> = { datos, fecha: new Date().toISOString() };
    localStorage.setItem(claveDe(usuarioId, clave), JSON.stringify(borrador));
  } catch {
    // Sin almacenamiento disponible el formulario sigue funcionando igual.
  }
}

export function leerBorrador<T>(usuarioId: string | null, clave: string): Borrador<T> | null {
  if (!usuarioId) return null;
  try {
    const crudo = localStorage.getItem(claveDe(usuarioId, clave));
    if (!crudo) return null;

    const borrador = JSON.parse(crudo) as Borrador<T>;
    if (Date.now() - new Date(borrador.fecha).getTime() > VIGENCIA_MS) {
      borrarBorrador(usuarioId, clave);
      return null;
    }
    return borrador;
  } catch {
    return null;
  }
}

export function borrarBorrador(usuarioId: string | null, clave: string): void {
  if (!usuarioId) return;
  try {
    localStorage.removeItem(claveDe(usuarioId, clave));
  } catch {
    // Nada que hacer: el borrador simplemente no existía o no se puede tocar.
  }
}
