import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject } from '@angular/core';

/**
 * Ícono neutro de "sin foto": un marco gris con la silueta de una imagen.
 * Va embebido para que nunca dependa de un archivo que también podría faltar.
 */
const SVG_SIN_FOTO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 72">
<rect width="96" height="72" fill="#eef3f9"/>
<g fill="none" stroke="#9aa1ab" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
<rect x="30" y="22" width="36" height="28" rx="3"/>
<circle cx="40" cy="31" r="3"/>
<path d="M33 47l10-10 7 7 5-5 8 8"/>
</g></svg>`;

export const SRC_SIN_FOTO = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(SVG_SIN_FOTO)}`;

/**
 * Reemplaza cualquier <img> que no cargue por el ícono "sin foto".
 *
 * Una foto puede faltar por motivos ajenos a quien usa el sistema (se borró
 * del almacenamiento, el sistema se mudó de computadora sin sus archivos):
 * mostrar el ícono de imagen rota del navegador da la impresión de un sistema
 * dañado. Se escucha en fase de captura sobre el documento porque el evento
 * "error" de una imagen no burbujea; así cubre todas las pantallas sin tener
 * que tocar cada <img>.
 */
export function reemplazarImagenesFaltantes(): void {
  const documento = inject(DOCUMENT);

  const alFallar = (evento: Event) => {
    const img = evento.target;
    if (!(img instanceof HTMLImageElement)) return;

    // Si el propio reemplazo fallara, no hay que entrar en un bucle.
    if (img.dataset['sinFoto'] === 'si' || img.src.startsWith('data:')) return;

    img.dataset['sinFoto'] = 'si';
    img.src = SRC_SIN_FOTO;
    img.style.objectFit = 'cover';
  };

  documento.addEventListener('error', alFallar, true);
  inject(DestroyRef).onDestroy(() => documento.removeEventListener('error', alFallar, true));
}
