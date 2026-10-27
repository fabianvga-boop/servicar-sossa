/**
 * Reglas de las fotos que se suben al sistema (perfil, repuestos, vehículos).
 * Son las mismas que valida el backend: JPG, PNG o WEBP de hasta 8 MB.
 */
export const FORMATOS_FOTO = ['image/jpeg', 'image/png', 'image/webp'];
export const TAMANO_MAXIMO_FOTO = 8 * 1024 * 1024;
export const AYUDA_FORMATOS_FOTO = 'JPG, PNG o WEBP, hasta 8 MB.';

/**
 * Una foto más liviana que esto se sube tal cual. Las de cámara de celular
 * suelen pesar 3–10 MB: se achican antes de subir (más rápido con datos
 * móviles y sin chocar con el límite de 8 MB).
 */
const TAMANO_SIN_ACHICAR = 2 * 1024 * 1024;

/** Lado mayor de la foto achicada: de sobra para ver un golpe o una pieza. */
const LADO_MAXIMO = 1920;

/**
 * Deja la foto lista para subir, o devuelve el motivo por el que no se puede.
 *
 *   - Si ya es JPG/PNG/WEBP liviana, la devuelve sin tocar.
 *   - Si es pesada, o de otro formato de imagen (HEIC de iPhone), la convierte
 *     a JPG de hasta 1920 px respetando la orientación de la cámara.
 *   - Si no es una imagen, o no se pudo convertir y no cumple las reglas,
 *     devuelve el mensaje para el usuario.
 */
export async function prepararFoto(archivo: File): Promise<File | string> {
  if (!archivo.type.startsWith('image/')) {
    return `El archivo elegido no es una foto. Use ${AYUDA_FORMATOS_FOTO}`;
  }

  const formatoAdmitido = FORMATOS_FOTO.includes(archivo.type);

  if (formatoAdmitido && archivo.size <= TAMANO_SIN_ACHICAR) return archivo;

  const achicada = await achicar(archivo);

  if (achicada) return achicada;
  if (!formatoAdmitido) return `Formato de foto no admitido. Use ${AYUDA_FORMATOS_FOTO}`;
  if (archivo.size > TAMANO_MAXIMO_FOTO) return 'La foto supera los 8 MB y no se pudo achicar.';
  return archivo;
}

async function achicar(archivo: File): Promise<File | null> {
  try {
    const imagen = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
    const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.width, imagen.height));

    const lienzo = document.createElement('canvas');
    lienzo.width = Math.round(imagen.width * escala);
    lienzo.height = Math.round(imagen.height * escala);
    lienzo.getContext('2d')?.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
    imagen.close();

    const blob = await new Promise<Blob | null>((listo) =>
      lienzo.toBlob(listo, 'image/jpeg', 0.85),
    );
    if (!blob || blob.size > TAMANO_MAXIMO_FOTO) return null;

    const nombre = archivo.name.replace(/\.[^.]+$/, '') || 'foto';
    return new File([blob], `${nombre}.jpg`, { type: 'image/jpeg' });
  } catch {
    // El navegador no sabe leer ese formato: quien llama decide qué hacer.
    return null;
  }
}
