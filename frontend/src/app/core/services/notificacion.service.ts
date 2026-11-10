import { Injectable, signal } from '@angular/core';

export type TipoAviso = 'exito' | 'error' | 'advertencia' | 'info';

/** Acción opcional dentro del aviso, por ejemplo "Deshacer". */
export interface AccionAviso {
  etiqueta: string;
  ejecutar: () => void;
}

export interface Aviso {
  id: number;
  tipo: TipoAviso;
  mensaje: string;
  accion?: AccionAviso;
  /** Cuánto dura en pantalla: lo dibuja la línea que se acorta en el aviso. */
  duracionMs: number;
}

/**
 * Avisos flotantes de la aplicación. El componente de avisos lee este signal;
 * cualquier servicio puede empujar un mensaje sin conocer la interfaz.
 */
@Injectable({ providedIn: 'root' })
export class NotificacionService {
  private readonly _avisos = signal<Aviso[]>([]);
  private siguienteId = 1;

  readonly avisos = this._avisos.asReadonly();

  exito(mensaje: string): void {
    this.mostrar('exito', mensaje);
  }

  error(mensaje: string): void {
    // Los errores se quedan más tiempo: suelen requerir que el usuario los lea.
    this.mostrar('error', mensaje, this.tiempoDeLectura(mensaje, 8000));
  }

  advertencia(mensaje: string): void {
    this.mostrar('advertencia', mensaje, this.tiempoDeLectura(mensaje, 6000));
  }

  /**
   * Un aviso largo (una regla del taller que explica qué hacer) necesita tiempo para
   * leerse: la duración crece con el largo del mensaje, hasta un tope. Además, el aviso
   * se detiene mientras el mouse está encima (ver pausar y reanudar).
   */
  private tiempoDeLectura(mensaje: string, minimoMs: number): number {
    return Math.min(25000, Math.max(minimoMs, 3000 + mensaje.length * 75));
  }

  info(mensaje: string): void {
    this.mostrar('info', mensaje);
  }

  /**
   * Aviso con botón de deshacer, para acciones que ya se ejecutaron pero se
   * pueden revertir (quitar un servicio o repuesto de una orden). Dura más que
   * un aviso normal: el usuario necesita tiempo para notar el error y reaccionar.
   */
  deshacer(mensaje: string, revertir: () => void): void {
    this.mostrar('info', mensaje, 9000, {
      etiqueta: 'Deshacer',
      ejecutar: revertir,
    });
  }

  cerrar(id: number): void {
    this.temporizadores.delete(id);
    this._avisos.update((lista) => lista.filter((aviso) => aviso.id !== id));
  }

  /** Mientras se lee (mouse encima) el aviso no se cierra. */
  pausar(id: number): void {
    const t = this.temporizadores.get(id);
    if (!t || t.pausado) return;
    clearTimeout(t.manija);
    t.restante = Math.max(1500, t.restante - (Date.now() - t.inicio));
    t.pausado = true;
  }

  reanudar(id: number): void {
    const t = this.temporizadores.get(id);
    if (!t || !t.pausado) return;
    t.pausado = false;
    t.inicio = Date.now();
    t.manija = setTimeout(() => this.cerrar(id), t.restante);
  }

  private readonly temporizadores = new Map<
    number,
    { manija: ReturnType<typeof setTimeout>; restante: number; inicio: number; pausado: boolean }
  >();

  /** Ejecuta la acción del aviso y lo cierra: ya cumplió su función. */
  ejecutarAccion(aviso: Aviso): void {
    aviso.accion?.ejecutar();
    this.cerrar(aviso.id);
  }

  private mostrar(
    tipo: TipoAviso,
    mensaje: string,
    duracionMs = 4500,
    accion?: AccionAviso,
  ): void {
    const id = this.siguienteId++;

    this._avisos.update((lista) => [...lista, { id, tipo, mensaje, accion, duracionMs }]);

    this.temporizadores.set(id, {
      manija: setTimeout(() => this.cerrar(id), duracionMs),
      restante: duracionMs,
      inicio: Date.now(),
      pausado: false,
    });
  }
}
