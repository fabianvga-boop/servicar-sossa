import { FormatoReporte, TipoReporte } from './enums';

/**
 * Forma genérica que devuelve el backend para todos los reportes:
 * columnas + filas alineadas + totales del pie.
 */
export interface Reporte {
  tipo: TipoReporte;
  titulo: string;
  fechaInicio: string;
  fechaFin: string;
  fechaGeneracion: string;
  generadoPor: string;
  columnas: string[];
  filas: string[][];
  totales: Record<string, string>;
  cantidadFilas: number;
}

export interface ReporteGenerado {
  reporteId: string;
  tipoReporte: string;
  fechaInicio: string;
  fechaFin: string;
  usuarioId: string;
  nombreUsuario: string;
  fechaGeneracion: string;
  formato: FormatoReporte;
}
