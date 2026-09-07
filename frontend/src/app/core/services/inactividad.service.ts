import { Injectable, inject } from '@angular/core';

import { AuthService } from './auth.service';
import { NotificacionService } from './notificacion.service';

/** Minutos de inactividad antes de cerrar sesión automáticamente. */
const MINUTOS_INACTIVIDAD = 15;
/** Aviso previo, para que alcance a reaccionar antes del cierre. */
const MINUTOS_AVISO = 1;

const MS_INACTIVIDAD = MINUTOS_INACTIVIDAD * 60_000;
const MS_AVISO = MS_INACTIVIDAD - MINUTOS_AVISO * 60_000;

const EVENTOS_DE_ACTIVIDAD = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const;

/**
 * Cierra la sesión sola tras un rato sin actividad (CAPA 2.3).
 *
 * Una computadora de mostrador queda desatendida entre clientes, y una
 * sesión de Administrador abierta indefinidamente es una puerta sin llave.
 * Se arranca una sola vez desde el layout autenticado, así que nunca corre
 * en `/login` — no tendría sentido cerrar una sesión que no existe.
 *
 * Este servicio no depende de Zone.js (el proyecto es zoneless): los avisos
 * y el logout escriben en signals, así que la interfaz se actualiza sola sin
 * necesidad de correr dentro de una zona de Angular.
 */
@Injectable({ providedIn: 'root' })
export class InactividadService {
  private readonly auth = inject(AuthService);
  private readonly notificacion = inject(NotificacionService);

  private temporizadorAviso: ReturnType<typeof setTimeout> | null = null;
  private temporizadorLogout: ReturnType<typeof setTimeout> | null = null;
  private iniciado = false;

  private readonly alHaberActividad = (): void => this.reiniciarTemporizadores();

  iniciar(): void {
    if (this.iniciado) return;
    this.iniciado = true;

    for (const evento of EVENTOS_DE_ACTIVIDAD) {
      document.addEventListener(evento, this.alHaberActividad, { passive: true });
    }

    this.reiniciarTemporizadores();
  }

  /** Se llama al cerrar sesión: no tiene sentido seguir vigilando sin usuario. */
  detener(): void {
    if (!this.iniciado) return;
    this.iniciado = false;

    for (const evento of EVENTOS_DE_ACTIVIDAD) {
      document.removeEventListener(evento, this.alHaberActividad);
    }

    this.limpiarTemporizadores();
  }

  private reiniciarTemporizadores(): void {
    this.limpiarTemporizadores();
    this.temporizadorAviso = setTimeout(() => this.avisar(), MS_AVISO);
    this.temporizadorLogout = setTimeout(() => this.cerrarPorInactividad(), MS_INACTIVIDAD);
  }

  private avisar(): void {
    this.notificacion.advertencia(
      `Su sesión se cerrará en ${MINUTOS_AVISO} minuto por inactividad. Mueva el mouse o toque una tecla para continuar.`,
    );
  }

  private cerrarPorInactividad(): void {
    this.detener();
    this.notificacion.advertencia('Sesión cerrada por inactividad.');
    this.auth.logout();
  }

  private limpiarTemporizadores(): void {
    if (this.temporizadorAviso) clearTimeout(this.temporizadorAviso);
    if (this.temporizadorLogout) clearTimeout(this.temporizadorLogout);
  }
}
