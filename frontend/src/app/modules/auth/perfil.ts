import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { urlArchivo } from '../../core/services/api-base';
import { AuthService } from '../../core/services/auth.service';
import { NotificacionService } from '../../core/services/notificacion.service';
import { ElegirFoto } from '../../shared/components/elegir-foto';

/** USU003 — la cuenta del usuario: su foto, sus datos y el cambio de su contraseña. */
@Component({
  selector: 'app-perfil',
  imports: [ReactiveFormsModule, ElegirFoto],
  template: `
    <div class="encabezado-pagina mb-2">
      <h1>Mi perfil</h1>
      <p class="texto-tenue texto-sm mb-0">Su foto, sus datos y su contraseña.</p>
    </div>

    <div class="perfil-columnas">
      <section class="tarjeta perfil-bloque">
        <div class="perfil-cabecera">
          @if (auth.fotoUrl(); as foto) {
            <img class="perfil-foto" [src]="urlArchivo(foto)" alt="Foto de {{ auth.nombreCompleto() }}" />
          } @else {
            <span class="perfil-foto perfil-foto-vacia" aria-hidden="true">{{ iniciales() }}</span>
          }
          <div class="perfil-titulo">
            <h2>{{ auth.nombreCompleto() }}</h2>
            <span>
              <span
                class="insignia perfil-rol"
                [class.insignia-roja]="auth.esAdministrador()"
                [class.insignia-gris]="!auth.esAdministrador()"
              >
                {{ auth.esAdministrador() ? 'Administrador' : 'Mecánico' }}
              </span>
            </span>
          </div>
        </div>

        <div class="perfil-foto-acciones">
          <app-elegir-foto
            [etiqueta]="auth.fotoUrl() ? 'Cambiar foto' : 'Subir foto'"
            [ocupado]="subiendoFoto()"
            [chico]="true"
            [mostrarAyuda]="false"
            (archivo)="subirFoto($event)"
          />
          @if (auth.fotoUrl()) {
            <button type="button" class="btn-enlace texto-rojo" [disabled]="subiendoFoto()" (click)="quitarFoto()">
              Quitar la foto
            </button>
          }
          <span class="perfil-ayuda">JPG, PNG o WEBP, hasta 8 MB. Se ve arriba, junto a su nombre.</span>
        </div>

        <dl class="perfil-datos">
          <div><dt>Usuario</dt><dd class="monto-mono">{{ auth.sesion()?.username }}</dd></div>
          <div><dt>Rol</dt><dd>{{ auth.esAdministrador() ? 'Administrador' : 'Mecánico' }}</dd></div>
          <div><dt>Código</dt><dd class="monto-mono">{{ auth.sesion()?.usuarioId }}</dd></div>
        </dl>
        <span class="perfil-ayuda">El nombre, el correo y el rol los cambia el Administrador desde Usuarios.</span>
      </section>

      <section class="tarjeta perfil-bloque">
        <div class="perfil-bloque-titulo">
          <h2>Cambiar contraseña</h2>
          <button
            type="button"
            class="ver-claves"
            [attr.aria-pressed]="verClaves()"
            [attr.aria-label]="verClaves() ? 'Ocultar las contraseñas' : 'Mostrar las contraseñas'"
            (click)="verClaves.update((v) => !v)"
          >
            {{ verClaves() ? 'Ocultar' : 'Mostrar' }}
          </button>
        </div>

        <form class="perfil-form" [formGroup]="formulario" (ngSubmit)="guardar()">
          <div class="campo">
            <label for="actual">Contraseña actual</label>
            <input
              id="actual"
              [type]="verClaves() ? 'text' : 'password'"
              formControlName="passwordActual"
              autocomplete="current-password"
              [class.invalido]="invalido('passwordActual')"
            />
            @if (invalido('passwordActual')) {
              <span class="campo-error">Ingrese su contraseña actual.</span>
            }
          </div>

          <div class="campo">
            <label for="nueva">Contraseña nueva</label>
            <input
              id="nueva"
              [type]="verClaves() ? 'text' : 'password'"
              formControlName="passwordNueva"
              autocomplete="new-password"
              [class.invalido]="invalido('passwordNueva')"
            />
            @if (invalido('passwordNueva')) {
              <span class="campo-error">Debe tener al menos 8 caracteres.</span>
            } @else {
              <span class="campo-ayuda">Al menos 8 caracteres.</span>
            }
          </div>

          <div class="campo">
            <label for="repetir">Repetir la contraseña nueva</label>
            <input
              id="repetir"
              [type]="verClaves() ? 'text' : 'password'"
              formControlName="repetir"
              autocomplete="new-password"
              [class.invalido]="noCoinciden()"
            />
            @if (noCoinciden()) {
              <span class="campo-error">Las contraseñas no coinciden.</span>
            }
          </div>

          <button type="submit" class="btn btn-primario perfil-guardar" [disabled]="enviando()">
            {{ enviando() ? 'Guardando…' : 'Cambiar contraseña' }}
          </button>
        </form>
      </section>
    </div>
  `,
  styles: `
    .perfil-columnas {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      align-items: start;
      gap: 20px;
      max-width: 1040px;
    }

    .perfil-bloque {
      display: flex;
      flex-direction: column;
      gap: 18px;
      padding: 24px;
    }

    .perfil-bloque h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
    }

    .perfil-cabecera {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .perfil-foto {
      width: 72px;
      height: 72px;
      flex: none;
      border-radius: 50%;
      object-fit: cover;
      border: 1px solid var(--gris-200);
    }

    /* Sin foto: las mismas iniciales del encabezado, en grande */
    .perfil-foto-vacia {
      display: grid;
      place-items: center;
      border-color: transparent;
      background: var(--brand);
      font-size: 24px;
      font-weight: 600;
      color: var(--blanco);
    }

    .perfil-titulo {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    }

    .perfil-titulo h2 { font-size: 20px; }

    .perfil-rol { font-weight: 500; }

    .perfil-foto-acciones {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
    }

    .perfil-foto-acciones .btn-enlace { padding: 0; }

    .perfil-ayuda {
      flex-basis: 100%;
      font-size: 12px;
      color: var(--gris-400);
    }

    .perfil-datos {
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 0.8fr);
      gap: 16px;
      margin: 0;
      padding: 16px;
      border-radius: 12px;
      background: var(--fondo-app);
    }

    .perfil-datos div {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .perfil-datos dt {
      font-size: 12px;
      color: var(--gris-400);
    }

    .perfil-datos dd {
      margin: 0;
      font-size: 14px;
      overflow-wrap: anywhere;
    }

    .perfil-bloque-titulo {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    .ver-claves {
      height: 36px;
      padding: 0 12px;
      border: 1px solid var(--gris-300);
      border-radius: 8px;
      background: var(--blanco);
      font: inherit;
      font-size: 13px;
      font-weight: 500;
      color: var(--gris-500);
      cursor: pointer;
    }

    .ver-claves:hover { color: var(--ink); }

    .perfil-form {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .perfil-form .campo { margin-bottom: 0; }

    .perfil-guardar {
      justify-content: center;
      min-height: 44px;
    }

    @media (max-width: 900px) {
      .perfil-columnas { grid-template-columns: minmax(0, 1fr); }

      .perfil-bloque { padding: 16px; }

      .perfil-datos { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
  `,
})
export class Perfil {
  private readonly fb = inject(FormBuilder);
  protected readonly auth = inject(AuthService);
  private readonly notificacion = inject(NotificacionService);

  protected readonly enviando = signal(false);
  protected readonly subiendoFoto = signal(false);
  /** Mostrar las contraseñas mientras se escriben: evita errores de tipeo. */
  protected readonly verClaves = signal(false);
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

  /** La foto llega ya validada y achicada por app-elegir-foto. */
  protected subirFoto(archivo: File): void {
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
