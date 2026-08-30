import { HttpInterceptorFn } from '@angular/common/http';

/**
 * Convierte las cadenas vacías del cuerpo de la petición en `null`.
 *
 * Un `<input>` vacío entrega `""`, no `null`. El backend valida los campos
 * opcionales con Data Annotations de formato ([EmailAddress], [Phone]), y esos
 * atributos aceptan `null` pero rechazan `""`: mandar un email vacío devolvía
 * 400 "El formato del email no es válido" aunque el campo no fuera obligatorio.
 *
 * Se resuelve aquí y no en cada formulario porque la convención es la misma en
 * todo el sistema: un campo opcional en blanco significa "sin dato".
 */
export const normalizarInterceptor: HttpInterceptorFn = (req, next) => {
  const body = req.body;

  // FormData, Blob y demás cuerpos binarios se dejan intactos.
  const esJson =
    body !== null &&
    typeof body === 'object' &&
    !(body instanceof FormData) &&
    !(body instanceof Blob) &&
    !(body instanceof ArrayBuffer);

  return next(esJson ? req.clone({ body: normalizar(body) }) : req);
};

function normalizar(valor: unknown): unknown {
  if (typeof valor === 'string') {
    const recortado = valor.trim();
    return recortado === '' ? null : recortado;
  }

  if (Array.isArray(valor)) return valor.map(normalizar);

  if (valor !== null && typeof valor === 'object') {
    // Date y otros objetos con serialización propia no se deben recorrer.
    if (valor instanceof Date) return valor;

    return Object.fromEntries(
      Object.entries(valor as Record<string, unknown>).map(([clave, v]) => [clave, normalizar(v)]),
    );
  }

  return valor;
}
