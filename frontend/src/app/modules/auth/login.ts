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
        <!-- Panel de bienvenida: identidad del taller sobre tinta oscura -->
        <div class="bienvenida">
          <svg class="deco" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <defs>
              <linearGradient id="trazo" x1="0" y1="1" x2="1" y2="0">
                <stop offset="0%" stop-color="#8f0400" />
                <stop offset="55%" stop-color="#e10600" />
                <stop offset="100%" stop-color="#ff5a3c" />
              </linearGradient>
              <radialGradient id="resplandor">
                <stop offset="0%" stop-color="#e10600" stop-opacity="0.45" />
                <stop offset="100%" stop-color="#e10600" stop-opacity="0" />
              </radialGradient>
            </defs>

            <circle cx="315" cy="70" r="165" fill="url(#resplandor)" />

            <!-- Estelas diagonales: la velocidad del taller, en el rojo de marca -->
            <g transform="translate(55 105) rotate(-45 200 300)" fill="url(#trazo)">
              <rect x="-40" y="214" width="150" height="30" rx="15" opacity="0.35" />
              <rect x="130" y="214" width="90" height="30" rx="15" opacity="0.55" />
              <rect x="20" y="262" width="215" height="34" rx="17" opacity="0.85" />
              <rect x="255" y="262" width="70" height="34" rx="17" opacity="0.4" />
              <rect x="-30" y="314" width="120" height="26" rx="13" opacity="0.5" />
              <rect x="110" y="310" width="260" height="42" rx="21" />
              <rect x="60" y="370" width="175" height="30" rx="15" opacity="0.6" />
              <rect x="255" y="370" width="60" height="30" rx="15" opacity="0.3" />
              <rect x="150" y="418" width="130" height="24" rx="12" opacity="0.35" />
            </g>
          </svg>

          <div class="bienvenida-texto">
            <img src="assets/logo.png" alt="Servicar SOSSA" class="marca-logo" />
            <h1 class="titulo">Bienvenido</h1>
            <p class="entrada">
              Órdenes de trabajo, diagnósticos, inventario y comisiones del taller,
              en un solo sistema.
            </p>
          </div>
        </div>

        <!-- Panel del formulario -->
        <div class="acceso">
          <div class="acceso-encabezado">
            <h2 class="acceso-titulo">Iniciar sesión</h2>
            <p class="acceso-sub">Bermejo, Tarija</p>
          </div>

          <form [formGroup]="formulario" (ngSubmit)="ingresar()">
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
    </div>
  `,
  styles: `
    .pantalla {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: radial-gradient(circle at 25% 15%, #2a2f38 0%, #0c0e12 70%);
    }

    /* Tarjeta partida: bienvenida a la izquierda, formulario a la derecha */
    .caja {
      width: 100%;
      max-width: 900px;
      display: grid;
      grid-template-columns: 1.1fr 0.9fr;
      background: var(--blanco);
      border-radius: 12px;
      box-shadow: var(--sombra-lg);
      overflow: hidden;
    }

    .bienvenida {
      position: relative;
      background: var(--ink);
      padding: 44px 40px;
      display: flex;
      align-items: flex-start;
      min-height: 460px;
      overflow: hidden;
    }

    .deco {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      z-index: 0;
    }

    /* Velo sobre las estelas: garantiza el contraste del logo y del texto
       sin tapar la decoración del lado opuesto. */
    .bienvenida::after {
      content: '';
      position: absolute;
      inset: 0;
      z-index: 1;
      background: linear-gradient(
        155deg,
        rgba(20, 23, 28, 0.94) 0%,
        rgba(20, 23, 28, 0.78) 38%,
        rgba(20, 23, 28, 0) 72%
      );
    }

    .bienvenida-texto {
      position: relative;
      z-index: 2;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 18px;
    }

    .marca-logo {
      width: 210px;
      max-width: 100%;
      height: auto;
      display: block;
    }

    .titulo {
      margin: 0;
      font-size: 40px;
      line-height: 1.05;
      color: var(--blanco);
      text-transform: none;
      letter-spacing: 0.01em;
    }

    .entrada {
      margin: 0;
      max-width: 30ch;
      font-size: 13.5px;
      line-height: 1.6;
      color: #c6cbd3;
    }

    .acceso {
      padding: 44px 40px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .acceso-encabezado {
      margin-bottom: 22px;
    }

    .acceso-titulo {
      margin: 0;
      font-size: 19px;
      color: var(--ink);
    }

    .acceso-sub {
      margin: 5px 0 0;
      font-size: 10.5px;
      font-weight: 600;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--gris-500);
    }

    .ancho-total { width: 100%; padding: 11px; }

    .pie {
      margin: 22px 0 0;
      line-height: 1.5;
    }

    /* En pantallas angostas la tarjeta se apila y el panel decorativo
       se reduce a una franja: el formulario es lo que importa ahí. */
    @media (max-width: 760px) {
      .caja {
        grid-template-columns: 1fr;
        max-width: 420px;
      }

      .bienvenida {
        min-height: 0;
        padding: 30px 28px;
        align-items: center;
        justify-content: center;
        text-align: center;
      }

      .bienvenida-texto {
        align-items: center;
        gap: 12px;
      }

      /* El panel es muy bajo aquí: las estelas se cortarían a la mitad
         y se leerían como manchas sueltas. */
      .deco,
      .bienvenida::after {
        display: none;
      }

      .titulo { font-size: 28px; }

      .entrada { display: none; }

      .acceso { padding: 28px; }
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
