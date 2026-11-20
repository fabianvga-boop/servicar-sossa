import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { FormatoReporte, TipoReporte } from '../models/enums';
import { PaginaResultado } from '../models/paginacion.model';
import { Reporte, ReporteGenerado } from '../models/reporte.model';
import { ApiBase } from './api-base';
import { descargarArchivo, nombreDesdeCabecera } from './descarga';

/** USU017-USU020 — reportes y su exportación. */
@Injectable({ providedIn: 'root' })
export class ReportesService extends ApiBase {
  protected readonly recurso = 'reportes';

  /** Reporte tabular para mostrar en pantalla. */
  generar(tipo: TipoReporte, desde: string, hasta: string): Observable<Reporte> {
    return this.http.get<Reporte>(this.url(TipoReporte[tipo]), {
      params: this.params({ desde, hasta }),
    });
  }

  /**
   * Descarga el reporte como archivo. Pide la respuesta como Blob y lee el
   * nombre de `Content-Disposition`, para que el archivo guardado conserve
   * el nombre que definió el backend.
   */
  exportar(
    tipo: TipoReporte,
    desde: string,
    hasta: string,
    formato: FormatoReporte,
  ): Observable<{ blob: Blob; nombreArchivo: string }> {
    return this.http
      .get(this.url(TipoReporte[tipo], 'exportar'), {
        params: this.params({ desde, hasta, formato: FormatoReporte[formato] }),
        responseType: 'blob',
        observe: 'response',
      })
      .pipe(
        map((respuesta) => ({
          blob: respuesta.body!,
          nombreArchivo:
            nombreDesdeCabecera(respuesta.headers.get('Content-Disposition')) ??
            `${TipoReporte[tipo]}.${extension(formato)}`,
        })),
      );
  }

  getBitacora(
    tipoReporte?: string,
    pagina = 1,
    tamanoPagina = 20,
  ): Observable<PaginaResultado<ReporteGenerado>> {
    return this.http.get<PaginaResultado<ReporteGenerado>>(this.url('bitacora'), {
      params: this.params({ tipoReporte, pagina, tamanoPagina }),
    });
  }

  /** Respaldo de los datos (solo Administrador): baja un archivo .sql con todas las tablas. */
  respaldar(): Observable<{ blob: Blob; nombreArchivo: string }> {
    return this.http
      .post(`${environment.apiUrl}/respaldos`, null, { responseType: 'blob', observe: 'response' })
      .pipe(
        map((respuesta) => ({
          blob: respuesta.body!,
          nombreArchivo: nombreDesdeCabecera(respuesta.headers.get('Content-Disposition')) ?? 'respaldo_servicar.sql',
        })),
      );
  }

  /** Cuándo y quién hizo el último respaldo. */
  ultimoRespaldo(): Observable<{ fecha: string | null; usuario: string | null }> {
    return this.http.get<{ fecha: string | null; usuario: string | null }>(`${environment.apiUrl}/respaldos/ultimo`);
  }

  /** Dispara la descarga en el navegador. */
  descargar(blob: Blob, nombreArchivo: string): void {
    descargarArchivo(blob, nombreArchivo);
  }
}

function extension(formato: FormatoReporte): string {
  switch (formato) {
    case FormatoReporte.Pdf:
      return 'pdf';
    case FormatoReporte.Excel:
      return 'xlsx';
    case FormatoReporte.Csv:
      return 'csv';
  }
}
