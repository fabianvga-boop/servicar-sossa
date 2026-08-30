/**
 * Utilidades de descarga de archivos, compartidas por los módulos que bajan
 * documentos del backend (reportes, proformas, diagnósticos).
 */

/** Dispara la descarga de un blob en el navegador. */
export function descargarArchivo(blob: Blob, nombreArchivo: string): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');

  enlace.href = url;
  enlace.download = nombreArchivo;
  enlace.click();

  // Sin esto el blob queda retenido en memoria hasta recargar la página.
  URL.revokeObjectURL(url);
}

/**
 * Lee `filename` de la cabecera Content-Disposition, para que el archivo
 * guardado conserve el nombre que definió el backend.
 */
export function nombreDesdeCabecera(cabecera: string | null): string | null {
  if (!cabecera) return null;

  const coincidencia = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cabecera);
  return coincidencia ? decodeURIComponent(coincidencia[1]) : null;
}
