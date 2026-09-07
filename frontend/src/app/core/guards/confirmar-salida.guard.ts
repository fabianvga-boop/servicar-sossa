import { CanDeactivateFn } from '@angular/router';

/**
 * Un componente con estado que se perdería si el usuario navega fuera sin
 * darse cuenta (un carrito armado, un panel de la orden con datos tipeados).
 */
export interface ConfirmarSalida {
  /** true si hay algo que se perdería al salir ahora mismo. */
  hayCambiosSinGuardar(): boolean;
}

/**
 * Protección de salida (CAPA 1.3): antes de abandonar una pantalla con
 * `hayCambiosSinGuardar() === true`, pide confirmación explícita.
 *
 * Se usa `window.confirm` a propósito: es síncrono, no depende de que el
 * componente siga montado para resolver una promesa, y es el único diálogo
 * que el navegador muestra también al cerrar la pestaña (ver el listener de
 * `beforeunload` que cada componente registra para ese caso).
 */
export const confirmarSalidaGuard: CanDeactivateFn<ConfirmarSalida> = (componente) => {
  if (!componente.hayCambiosSinGuardar()) return true;

  return window.confirm(
    'Hay cambios sin guardar en esta pantalla. Si sale ahora se perderán. ¿Salir de todos modos?',
  );
};
