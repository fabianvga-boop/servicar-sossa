import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { DATOS_TALLER } from '../../core/datos-taller';
import { AuthService } from '../../core/services/auth.service';
import { NotificacionService } from '../../core/services/notificacion.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  template: `
    <div class="pantalla">
      <!-- Presentación: el logo grande y los datos del taller sobre tinta oscura -->
      <section class="presentacion">
        <div class="presentacion-cabeza">
          <img src="assets/logo.png" alt="Servicar SOSSA, taller automotriz" class="logo" />
          <div class="presentacion-texto">
            <h1 class="titulo">Sistema de información del taller</h1>
            <p class="entrada">Acceso exclusivo para el personal de Servicar SOSSA.</p>
          </div>
        </div>

        <!-- Solo se dibujan los datos cargados en core/datos-taller.ts -->
        <address class="datos">
          <div class="dato">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" />
            </svg>
            <div class="dato-textos">
              <span class="dato-etiqueta">Dirección</span>
              <span class="dato-valor">{{ taller.direccion || taller.ciudad }}</span>
              @if (taller.direccion) {
                <span class="dato-sub">{{ taller.ciudad }}</span>
              }
            </div>
          </div>

          @if (taller.telefono) {
            <div class="dato">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
              </svg>
              <div class="dato-textos">
                <span class="dato-etiqueta">Celular</span>
                <span class="dato-valor">{{ taller.telefono }}</span>
              </div>
            </div>
          }

          @if (taller.correo) {
            <div class="dato">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" />
              </svg>
              <div class="dato-textos">
                <span class="dato-etiqueta">Correo</span>
                <span class="dato-valor">{{ taller.correo }}</span>
              </div>
            </div>
          }

          @if (taller.horario) {
            <div class="dato">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
              </svg>
              <div class="dato-textos">
                <span class="dato-etiqueta">Horario de atención</span>
                <span class="dato-valor">{{ taller.horario }}</span>
              </div>
            </div>
          }
        </address>
      </section>

      <!-- Formulario de ingreso -->
      <section class="acceso">
        <form class="formulario" [formGroup]="formulario" (ngSubmit)="ingresar()">
          <div class="acceso-encabezado">
            <h2 class="acceso-titulo">Ingresar</h2>
            <p class="acceso-sub">Con el usuario que le asignó el administrador.</p>
          </div>

          <div class="campo">
            <label for="username">Usuario</label>
            <input
              id="username"
              type="text"
              formControlName="username"
              autocomplete="username"
              [class.invalido]="invalido('username')"
            />
            @if (invalido('username')) {
              <span class="campo-error">El usuario es obligatorio.</span>
            }
          </div>

          <div class="campo">
            <label for="password">Contraseña</label>
            <!-- Mostrar la contraseña evita errores de tipeo a quien escribe despacio -->
            <div class="clave">
              <input
                id="password"
                [type]="verClave() ? 'text' : 'password'"
                formControlName="password"
                autocomplete="current-password"
                [class.invalido]="invalido('password')"
              />
              <button
                type="button"
                class="ver-clave"
                [attr.aria-pressed]="verClave()"
                [attr.aria-label]="verClave() ? 'Ocultar la contraseña' : 'Mostrar la contraseña'"
                (click)="verClave.update((v) => !v)"
              >
                {{ verClave() ? 'Ocultar' : 'Mostrar' }}
              </button>
            </div>
            @if (invalido('password')) {
              <span class="campo-error">La contraseña es obligatoria.</span>
            }
          </div>

          <button type="submit" class="btn btn-primario btn-ingresar" [disabled]="enviando()">
            {{ enviando() ? 'Ingresando…' : 'Ingresar' }}
          </button>

          <p class="ayuda">¿Olvidó su contraseña? Pídasela al administrador del taller.</p>
        </form>
      </section>
    </div>
  `,
  styles: `
    /* Pantalla partida: presentación del taller a la izquierda y el
       formulario a la derecha. Sin espacio para las dos, se apilan. */
    .pantalla {
      min-height: 100vh;
      min-height: 100dvh;
      display: flex;
      flex-wrap: wrap;
      background: var(--blanco);
    }

    .presentacion {
      flex: 1 1 600px;
      min-height: 420px;
      padding: 56px 64px;
      background: var(--ink);
      color: var(--blanco);
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 48px;
    }

    .presentacion-cabeza {
      max-width: 560px;
      display: flex;
      flex-direction: column;
      gap: 28px;
    }

    /* El logo es lo que más se ve: identifica al taller antes que el texto */
    .logo {
      width: 100%;
      max-width: 520px;
      height: auto;
      display: block;
    }

    .presentacion-texto {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .titulo {
      margin: 0;
      font-size: 30px;
      line-height: 1.2;
      color: var(--blanco);
    }

    .entrada {
      margin: 0;
      font-size: 16px;
      line-height: 1.6;
      color: var(--texto-sobre-oscuro);
    }

    .datos {
      max-width: 560px;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 20px 32px;
      padding-top: 28px;
      border-top: 1px solid #2c333f;
      font-style: normal;
    }

    .dato {
      display: grid;
      grid-template-columns: 20px minmax(0, 1fr);
      gap: 12px;
      align-items: start;
    }

    .dato svg { color: #f26b63; }

    .dato-textos {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .dato-etiqueta {
      font-size: 12px;
      color: #8a93a1;
    }

    .dato-valor {
      font-size: 15px;
      line-height: 1.45;
    }

    .dato-sub {
      font-size: 14px;
      color: var(--texto-sobre-oscuro);
    }

    .acceso {
      flex: 1 1 440px;
      padding: 56px 64px;
      display: flex;
      align-items: center;
    }

    .formulario {
      width: 100%;
      max-width: 380px;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .acceso-encabezado {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .acceso-titulo {
      margin: 0;
      font-size: 26px;
      letter-spacing: -0.02em;
    }

    .acceso-sub {
      margin: 0;
      font-size: 14px;
      color: var(--gris-500);
    }

    /* La separación entre campos la da el gap del formulario */
    .formulario .campo { margin-bottom: 0; }

    /* Campos y botón más altos que en el resto del sistema: es la primera
       pantalla y se usa también desde el celular. */
    .campo input {
      min-height: 48px;
      border-radius: var(--radio-md);
    }

    .clave { position: relative; }

    .clave input {
      width: 100%;
      padding-right: 84px;
    }

    .ver-clave {
      position: absolute;
      top: 50%;
      right: 6px;
      transform: translateY(-50%);
      height: 36px;
      padding: 0 10px;
      border: 0;
      border-radius: var(--radio-xs);
      background: transparent;
      color: var(--gris-500);
      font: inherit;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
    }

    .ver-clave:hover {
      background: var(--gris-100);
      color: var(--ink);
    }

    .btn-ingresar {
      width: 100%;
      min-height: 48px;
      border-radius: var(--radio-md);
      font-size: 15px;
    }

    .ayuda {
      margin: 0;
      font-size: 13px;
      line-height: 1.5;
      color: var(--gris-500);
      text-align: center;
    }

    /* Apiladas, el formulario se centra bajo la presentación */
    @media (max-width: 1039px) {
      .acceso { justify-content: center; }
    }

    /* En el celular la presentación se achica para que el formulario quede
       a la vista sin tener que bajar tanto. */
    @media (max-width: 760px) {
      .presentacion {
        min-height: 0;
        padding: 32px 24px;
        gap: 24px;
      }

      .presentacion-cabeza { gap: 18px; }

      .logo { max-width: 300px; }

      .titulo { font-size: 22px; }

      .entrada { font-size: 14.5px; }

      .datos {
        grid-template-columns: minmax(0, 1fr);
        gap: 14px;
        padding-top: 20px;
      }

      .acceso { padding: 32px 24px 40px; }
    }
  `,
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly notificacion = inject(NotificacionService);

  protected readonly taller = DATOS_TALLER;
  protected readonly enviando = signal(false);
  protected readonly verClave = signal(false);

  protected readonly formulario = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  protected invalido(control: string): boolean {
    const campo = this.formulario.get(control);
    return !!campo && campo.invalid && campo.touched;
  }

  protected ingresar(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.enviando.set(true);

    this.auth.login(this.formulario.getRawValue()).subscribe({
      next: (respuesta) => {
        this.notificacion.exito(`Bienvenido, ${respuesta.nombreCompleto}.`);

        // Vuelve al destino que el guard interceptó, si lo hubo.
        const destino = this.ruta.snapshot.queryParamMap.get('redirigir') ?? '/dashboard';
        void this.router.navigateByUrl(destino);
      },
      // El interceptor ya mostró el mensaje del backend.
      error: () => this.enviando.set(false),
    });
  }
}
