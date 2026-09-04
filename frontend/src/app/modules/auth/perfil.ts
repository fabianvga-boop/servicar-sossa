import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { urlArchivo } from '../../core/services/api-base';
import { AuthService } from '../../core/services/auth.service';
import { NotificacionService } from '../../core/services/notificacion.service';

/** Límite del backend; se valida aquí también para avisar antes de subir. */
const TAMANIO_MAXIMO_BYTES = 8 * 1024 * 1024;

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
          <div class="foto-fila">
            @if (auth.fotoUrl(); as foto) {
              <img class="foto" [src]="urlArchivo(foto)" alt="Foto de {{ auth.nombreCompleto() }}" />
            } @else {
              <span class="foto foto-vacia">{{ iniciales() }}</span>
            }

            <div class="foto-acciones">
              <!-- El input real queda oculto: el botón es la etiqueta -->
              <input
                id="foto"
                type="file"
                class="foto-input"
                accept="image/jpeg,image/png,image/webp"
                (change)="seleccionarFoto($event)"
              />
              <label for="foto" class="btn btn-secundario btn-sm">
                {{ subiendoFoto() ? 'Subiendo…' : auth.fotoUrl() ? 'Cambiar foto' : 'Subir foto' }}
              </label>

              @if (auth.fotoUrl()) {
                <button
                  type="button"
                  class="btn btn-peligro btn-sm"
                  [disabled]="subiendoFoto()"
                  (click)="quitarFoto()"
                >
                  Quitar
                </button>
              }

              <p class="texto-tenue texto-sm mb-0">JPG, PNG o WEBP, hasta 8 MB.</p>
            </div>
          </div>

          <dl class="datos mt-2">
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

    .foto-fila {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .foto {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      object-fit: cover;
      flex-shrink: 0;
      border: 1px solid var(--gris-200);
    }

    /* Sin foto: las mismas iniciales del encabezado, en grande */
    .foto-vacia {
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--brand);
      color: var(--blanco);
      border-color: transparent;
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 24px;
      font-weight: 600;
    }

    .foto-acciones {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    /* Oculto pero accesible: la etiqueta hace de botón y el teclado lo alcanza */
    .foto-input {
      position: absolute;
      width: 1px;
      height: 1px;
      opacity: 0;
      pointer-events: none;
    }

    .foto-input:focus-visible + label {
      outline: 2px solid var(--brand);
      outline-offset: 1px;
    }

    .foto-acciones label { cursor: pointer; }
    .foto-acciones p { flex-basis: 100%; }
  `,
})
export class Perfil {
  private readonly fb = inject(FormBuilder);
  protected readonly auth = inject(AuthService);
  private readonly notificacion = inject(NotificacionService);

  protected readonly enviando = signal(false);
  protected readonly subiendoFoto = signal(false);
  protected readonly urlArchivo = urlArchivo;

  protected readonly formulario = this.fb.nonNullable.group({
    passwordActual: ['', Validators.required],
    passwordNueva: ['', [Validators.required, Validators.minLength(8)]],
    repetir: ['', Validators.required],
  });

  protected invalido(control: string): boolean {
    const campo = this.formulario.get(control);
    return !!campo && campo.invalid && campo.touched;
  }

  /** Iniciales para el círculo cuando no hay foto, igual que en el encabezado. */
  protected iniciales(): string {
    return this.auth
      .nombreCompleto()
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((parte) => parte[0]?.toUpperCase() ?? '')
      .join('');
  }

  protected seleccionarFoto(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0];
    if (!archivo) return;

    // Se limpia siempre: si no, elegir el mismo archivo dos veces no dispara change.
    input.value = '';

    if (archivo.size > TAMANIO_MAXIMO_BYTES) {
      this.notificacion.advertencia('La foto no puede superar los 8 MB.');
      return;
    }

    this.subiendoFoto.set(true);

    this.auth.subirFoto(archivo).subscribe({
      next: () => {
        this.notificacion.exito('Foto de perfil actualizada.');
        this.subiendoFoto.set(false);
      },
      error: () => this.subiendoFoto.set(false),
    });
  }

  protected quitarFoto(): void {
    this.subiendoFoto.set(true);

    this.auth.eliminarFoto().subscribe({
      next: () => {
        this.notificacion.exito('Foto de perfil eliminada.');
        this.subiendoFoto.set(false);
      },
      error: () => this.subiendoFoto.set(false),
    });
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
