import { Component, signal } from '@angular/core';

/** Franja horaria que cubre el tablero: el taller no se dibuja fuera de este rango. */
const HORA_INICIO = 8;
const HORA_FIN = 18;
const RANGO_HORAS = HORA_FIN - HORA_INICIO;

interface CitaEjemplo {
  dia: number; // 0 = lunes … 5 = sábado
  horaInicio: number;
  horaFin: number;
  titulo: string;
  subtitulo: string;
  color: 'azul' | 'naranja' | 'verde';
}

interface TareaEjemplo {
  mecanico: string;
  horaInicio: number;
  horaFin: number;
  titulo: string;
  color: 'azul' | 'naranja' | 'verde';
}

/**
 * Componente base de agenda — Calendario semanal + Gantt de mecánicos.
 *
 * ES UNA MAQUETA CON DATOS DE EJEMPLO, no una pantalla conectada al backend.
 * El modelo de datos real no tiene con qué dibujar un bloque: un diagnóstico
 * (`Diagnostico.fecha`) y una asignación de mecánico (`OrdenMecanico.
 * fechaAsignacion`) son un solo instante, sin hora de inicio ni de fin ni
 * duración en ningún lado. Un bloque necesita ancho — inventar una duración
 * para poder dibujarlo sería fabricar un dato que el sistema no tiene, así
 * que esta vista se queda en ejemplo hasta que el modelo real lo soporte
 * (agregar algo como `horaInicio`/`duracionMinutos` es un cambio de backend,
 * fuera de "solo HTML/CSS y presentación").
 *
 * No está enlazada desde el menú a propósito: no es una función que el
 * taller deba usar todavía, es la base para decidir si vale la pena sumar
 * esos campos.
 */
@Component({
  selector: 'app-agenda',
  imports: [],
  templateUrl: './agenda.html',
  styleUrl: './agenda.css',
})
export class Agenda {
  protected readonly pestania = signal<'calendario' | 'mecanicos'>('calendario');

  protected readonly dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  protected readonly horas = Array.from({ length: RANGO_HORAS }, (_, i) => HORA_INICIO + i);
  protected readonly mecanicos = ['Mecánico A', 'Mecánico B', 'Mecánico C'];

  protected cambiarPestania(valor: 'calendario' | 'mecanicos'): void {
    this.pestania.set(valor);
  }

  /**
   * Citas de ejemplo para el calendario semanal. Los vehículos y clientes son
   * genéricos a propósito: no son registros reales del taller, así que no
   * llevan una placa ni un nombre que pudieran confundirse con datos reales.
   */
  protected readonly citas: CitaEjemplo[] = [
    { dia: 0, horaInicio: 9, horaFin: 10, titulo: 'Diagnóstico', subtitulo: 'Vehículo de ejemplo A', color: 'azul' },
    { dia: 0, horaInicio: 11, horaFin: 12.5, titulo: 'Revisión de frenos', subtitulo: 'Vehículo de ejemplo B', color: 'naranja' },
    { dia: 1, horaInicio: 8.5, horaFin: 9.5, titulo: 'Diagnóstico', subtitulo: 'Vehículo de ejemplo C', color: 'azul' },
    { dia: 1, horaInicio: 14, horaFin: 16, titulo: 'Mantención general', subtitulo: 'Vehículo de ejemplo D', color: 'verde' },
    { dia: 2, horaInicio: 10, horaFin: 11, titulo: 'Diagnóstico', subtitulo: 'Vehículo de ejemplo E', color: 'azul' },
    { dia: 3, horaInicio: 9, horaFin: 10.5, titulo: 'Revisión eléctrica', subtitulo: 'Vehículo de ejemplo F', color: 'naranja' },
    { dia: 3, horaInicio: 15, horaFin: 17, titulo: 'Mantención general', subtitulo: 'Vehículo de ejemplo G', color: 'verde' },
    { dia: 4, horaInicio: 8, horaFin: 9, titulo: 'Diagnóstico', subtitulo: 'Vehículo de ejemplo H', color: 'azul' },
    { dia: 4, horaInicio: 12, horaFin: 13.5, titulo: 'Revisión de frenos', subtitulo: 'Vehículo de ejemplo I', color: 'naranja' },
    { dia: 5, horaInicio: 9, horaFin: 11, titulo: 'Mantención general', subtitulo: 'Vehículo de ejemplo J', color: 'verde' },
  ];

  /** Tareas de ejemplo para el Gantt de mecánicos: nombres genéricos, no reales. */
  protected readonly tareas: TareaEjemplo[] = [
    { mecanico: 'Mecánico A', horaInicio: 8, horaFin: 10, titulo: 'Diagnóstico — ejemplo', color: 'azul' },
    { mecanico: 'Mecánico A', horaInicio: 10.5, horaFin: 13, titulo: 'Reparación — ejemplo', color: 'naranja' },
    { mecanico: 'Mecánico A', horaInicio: 14.5, horaFin: 17, titulo: 'Mantención — ejemplo', color: 'verde' },
    { mecanico: 'Mecánico B', horaInicio: 8.5, horaFin: 11.5, titulo: 'Reparación — ejemplo', color: 'naranja' },
    { mecanico: 'Mecánico B', horaInicio: 12, horaFin: 13, titulo: 'Diagnóstico — ejemplo', color: 'azul' },
    { mecanico: 'Mecánico B', horaInicio: 15, horaFin: 18, titulo: 'Reparación — ejemplo', color: 'naranja' },
    { mecanico: 'Mecánico C', horaInicio: 9, horaFin: 12, titulo: 'Mantención — ejemplo', color: 'verde' },
    { mecanico: 'Mecánico C', horaInicio: 13, horaFin: 15, titulo: 'Diagnóstico — ejemplo', color: 'azul' },
    { mecanico: 'Mecánico C', horaInicio: 15.5, horaFin: 17.5, titulo: 'Reparación — ejemplo', color: 'naranja' },
  ];

  protected citasDelDia(dia: number): CitaEjemplo[] {
    return this.citas.filter((c) => c.dia === dia);
  }

  protected tareasDelMecanico(mecanico: string): TareaEjemplo[] {
    return this.tareas.filter((t) => t.mecanico === mecanico);
  }

  /** Posición y alto del bloque dentro de la columna del día, en porcentaje. */
  protected topPct(horaInicio: number): number {
    return ((horaInicio - HORA_INICIO) / RANGO_HORAS) * 100;
  }

  protected altoPct(horaInicio: number, horaFin: number): number {
    return ((horaFin - horaInicio) / RANGO_HORAS) * 100;
  }

  /** Posición y ancho del bloque dentro de la fila del mecánico, en porcentaje. */
  protected leftPct(horaInicio: number): number {
    return ((horaInicio - HORA_INICIO) / RANGO_HORAS) * 100;
  }

  protected anchoPct(horaInicio: number, horaFin: number): number {
    return ((horaFin - horaInicio) / RANGO_HORAS) * 100;
  }

  protected etiquetaHora(hora: number): string {
    return `${String(hora).padStart(2, '0')}:00`;
  }
}
