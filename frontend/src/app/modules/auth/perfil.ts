import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { AuthService } from '../../core/services/auth.service';
import { NotificacionService } from '../../core/services/notificacion.service';

/** USU003 — el usuario autenticado cambia su propia contraseña. */
@Component({
  selector: 'app-perfil',
  imports: [ReactiveFormsModule],
  template: `
    <h1 class="mb-2">Mi perfil</h1>

    <div class="columnas">
      <div class="tarjeta">
        <div class="tarjeta-encabezado"><h2>Datos de la sesión</h2></div>
        <div class="tarjeta-cuerpo">
          <dl class="datos">
            <dt>Usuario</dt>
            <dd>{{ auth.sesion()?.username }}</dd>
            <dt>Nombre</dt>
            <dd>{{ auth.nombreCompleto() }}</dd>
            <dt>Rol</dt>
            <dd>{{ auth.rol() }}</dd>
            <dt>Código</dt>
            <dd class="codigo">{{ auth.sesion()?.usuarioId }}</dd>
          </dl>
        </div>
      </div>

      <div class="tarjeta">
        <div class="tarjeta-encabezado"><h2>Cambiar contraseña</h2></div>
        <div class="tarjeta-cuerpo">
          <form [formGroup]="formulario" (ngSubmit)="guardar()">
            <div class="campo">
              <label for="actual">Contraseña actual <span class="obligatorio">*</span></label>
              <input
                id="actual"
                type="password"
                formControlName="passwordActual"
                autocomplete="current-password"
                [class.invalido]="invalido('passwordActual')"
              />
              @if (invalido('passwordActual')) {
                <span class="campo-error">Ingrese su contraseña actual.</span>
              }
            </div>

            <div class="campo">
              <label for="nueva">Contraseña nueva <span class="obligatorio">*</span></label>
              <input
                id="nueva"
                type="password"
                formControlName="passwordNueva"
                autocomplete="new-password"
                [class.invalido]="invalido('passwordNueva')"
              />
              @if (invalido('passwordNueva')) {
                <span class="campo-error">Debe tener al menos 8 caracteres.</span>
              }
            </div>

            <div class="campo">
              <label for="repetir">Repetir contraseña nueva <span class="obligatorio">*</span></label>
              <input
                id="repetir"
                type="password"
                formControlName="repetir"
                autocomplete="new-password"
                [class.invalido]="noCoinciden()"
              />
              @if (noCoinciden()) {
                <span class="campo-error">Las contraseñas no coinciden.</span>
              }
            </div>

            <div class="fila-fin">
              <button type="submit" class="btn btn-primario" [disabled]="enviando()">
                {{ enviando() ? 'Guardando…' : 'Cambiar contraseña' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: `
    .columnas {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 16px;
      align-items: start;
    }

    .datos {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 8px 16px;
      margin: 0;
      font-size: 13px;
    }

    .datos dt { color: var(--gris-500); }
    .datos dd { margin: 0; font-weight: 500; }
  `,
})
export class Perfil {
  private readonly fb = inject(FormBuilder);
  protected readonly auth = inject(AuthService);
  private readonly notificacion = inject(NotificacionService);

  protected readonly enviando = signal(false);

  protected readonly formulario = this.fb.nonNullable.group({
    passwordActual: ['', Validators.required],
    passwordNueva: ['', [Validators.required, Validators.minLength(8)]],
    repetir: ['', Validators.required],
  });

  protected invalido(control: string): boolean {
    const campo = this.formulario.get(control);
    return !!campo && campo.invalid && campo.touched;
  }

  protected noCoinciden(): boolean {
    const repetir = this.formulario.get('repetir') as AbstractControl;
    if (!repetir.touched) return false;

    const { passwordNueva } = this.formulario.getRawValue();
    return repetir.value !== passwordNueva;
  }

  protected guardar(): void {
    if (this.formulario.invalid || this.noCoinciden()) {
      this.formulario.markAllAsTouched();
      return;
    }

    const { passwordActual, passwordNueva } = this.formulario.getRawValue();
    this.enviando.set(true);

    this.auth.cambiarPassword({ passwordActual, passwordNueva }).subscribe({
      next: (respuesta) => {
        this.notificacion.exito(respuesta.mensaje ?? 'Contraseña actualizada.');
        this.formulario.reset();
        this.enviando.set(false);
      },
      error: () => this.enviando.set(false),
    });
  }
}
