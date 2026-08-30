import { Directive, ElementRef, inject, input } from '@angular/core';

/**
 * Dispara el clic del botón cuando se pulsa una tecla suelta.
 *
 *   <button appAtajo="n" ...>+ Nueva orden</button>
 *
 * Se aplica sobre el propio botón en lugar de cablear un manejador en cada
 * componente: el atajo queda declarado junto a la acción que ejecuta, y no hay
 * forma de que uno sobreviva al otro cuando la plantilla cambia.
 */
@Directive({
  selector: 'button[appAtajo]',
  host: {
    '(document:keydown)': 'alTeclear($event)',
  },
})
export class Atajo {
  /** Tecla que activa el botón, en minúscula. */
  readonly appAtajo = input.required<string>();

  private readonly elemento = inject<ElementRef<HTMLButtonElement>>(ElementRef);

  protected alTeclear(evento: KeyboardEvent): void {
    if (evento.key.toLowerCase() !== this.appAtajo().toLowerCase()) return;

    // Con modificadores la tecla pertenece a un atajo del navegador o del
    // sistema (Ctrl+N abre una ventana): no hay que robársela.
    if (evento.ctrlKey || evento.metaKey || evento.altKey) return;

    if (this.escribiendo(evento.target)) return;

    // Un diálogo abierto tapa el botón: activarlo desde atrás abriría un
    // segundo formulario encima del primero.
    if (document.querySelector('[aria-modal="true"]')) return;

    const boton = this.elemento.nativeElement;

    // `offsetParent` en null significa oculto: el atajo no debe alcanzar un
    // botón que el usuario tampoco podría clicar.
    if (boton.disabled || boton.offsetParent === null) return;

    evento.preventDefault();
    boton.click();
  }

  /** El usuario está tecleando dentro de un campo: la tecla es contenido. */
  private escribiendo(destino: EventTarget | null): boolean {
    const elemento = destino as HTMLElement | null;
    if (!elemento) return false;

    return (
      elemento.isContentEditable ||
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(elemento.tagName)
    );
  }
}
