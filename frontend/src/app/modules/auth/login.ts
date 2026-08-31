import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { NotificacionService } from '../../core/services/notificacion.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  template: `
    <div class="pantalla">
      <div class="caja">
        <div class="marca">
          <img src="assets/logo.png" alt="Servicar SOSSA" class="marca-logo" />
          <p class="marca-sistema">Sistema de información del taller — Bermejo, Tarija</p>
        </div>

        <form class="cuerpo" [formGroup]="formulario" (ngSubmit)="ingresar()">
          <div class="campo">
            <label for="username">Usuario</label>
            <input
              id="username"
              type="text"
              formControlName="username"
              autocomplete="username"
              placeholder="Ingrese su usuario"
              [class.invalido]="invalido('username')"
            />
            @if (invalido('username')) {
              <span class="campo-error">El usuario es obligatorio.</span>
            }
          </div>

          <div class="campo">
            <label for="password">Contraseña</label>
            <input
              id="password"
              type="password"
              formControlName="password"
              autocomplete="current-password"
              placeholder="Ingrese su contraseña"
              [class.invalido]="invalido('password')"
            />
            @if (invalido('password')) {
              <span class="campo-error">La contraseña es obligatoria.</span>
            }
          </div>

          <button
            type="submit"
            class="btn btn-primario ancho-total"
            [disabled]="enviando()"
          >
            {{ enviando() ? 'Ingresando…' : 'Iniciar sesión' }}
          </button>
        </form>

        <p class="pie texto-sm texto-tenue">
          Universidad Autónoma Juan Misael Saracho — Tarija, Bolivia
        </p>
      </div>
    </div>
  `,
  styles: `
    .pantalla {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: radial-gradient(circle at 25% 15%, #2a2f38 0%, #0c0e12 70%);
    }

    .caja {
      width: 100%;
      max-width: 390px;
      background: var(--blanco);
      border-radius: 10px;
      box-shadow: var(--sombra-lg);
      overflow: hidden;
    }

    /* Encabezado oscuro con el logo, como el resto del sistema */
    .marca {
      background: var(--ink);
      padding: 26px 28px 22px;
      text-align: center;
      border-bottom: 4px solid var(--brand);
    }

    .marca-logo {
      width: 210px;
      max-width: 100%;
      margin: 0 auto;
    }

    .marca-sistema {
      font-size: 10.5px;
      color: #8b93a1;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      margin: 12px 0 0;
      font-weight: 600;
    }

    .cuerpo {
      padding: 24px 28px 28px;
    }

    .ancho-total { width: 100%; padding: 11px; }

    .pie {
      margin: 18px 28px 24px;
      text-align: center;
      line-height: 1.5;
    }
  `,
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly notificacion = inject(NotificacionService);

  protected readonly enviando = signal(false);

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
