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
    this.mostrar('error', mensaje, 8000);
  }

  advertencia(mensaje: string): void {
    this.mostrar('advertencia', mensaje, 6000);
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
    this._avisos.update((lista) => lista.filter((aviso) => aviso.id !== id));
  }

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

    this._avisos.update((lista) => [...lista, { id, tipo, mensaje, accion }]);

    setTimeout(() => this.cerrar(id), duracionMs);
  }
}
