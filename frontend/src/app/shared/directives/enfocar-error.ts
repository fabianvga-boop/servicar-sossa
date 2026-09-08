import { Directive, ElementRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormGroupDirective } from '@angular/forms';

/**
 * Al enviar un formulario inválido, lleva el foco al primer campo con error
 * y lo desplaza a la vista. Sin esto, en un formulario largo el botón
 * "Guardar" simplemente no avanza y el campo que falta puede quedar fuera
 * de pantalla: el usuario no sabe qué corregir.
 *
 * Se aplica sola a cualquier `<form [formGroup]>`, así que basta con importar
 * la directiva en el componente para que todos sus formularios la hereden.
 */
@Directive({
  selector: 'form[formGroup]',
})
export class EnfocarError {
  private readonly host = inject<ElementRef<HTMLFormElement>>(ElementRef);
  private readonly formDir = inject(FormGroupDirective);

  constructor() {
    this.formDir.ngSubmit.pipe(takeUntilDestroyed()).subscribe(() => {
      if (!this.formDir.form.invalid) return;
      // Espera a que Angular pinte las clases .ng-invalid del envío.
      queueMicrotask(() => this.enfocarPrimerError());
    });
  }

  private enfocarPrimerError(): void {
    const form = this.host.nativeElement;

    // Los controles inválidos llevan .ng-invalid; el primero en orden del DOM
    // es el más arriba. Se excluye el propio <form>, que también la lleva.
    for (const el of Array.from(form.querySelectorAll<HTMLElement>('.ng-invalid'))) {
      if (el === form) continue;

      const enfocable = el.matches('input, select, textarea, button, a[href], [tabindex]')
        ? el
        : el.querySelector<HTMLElement>('input, select, textarea, button, a[href], [tabindex]');

      if (enfocable) {
        enfocable.scrollIntoView({ block: 'center', behavior: 'smooth' });
        enfocable.focus({ preventScroll: true });
        return;
      }
    }
  }
}
