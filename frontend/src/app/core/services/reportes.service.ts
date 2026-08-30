import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';

import { FormatoReporte, TipoReporte } from '../models/enums';
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

  getBitacora(tipoReporte?: string): Observable<ReporteGenerado[]> {
    return this.http.get<ReporteGenerado[]>(this.url('bitacora'), {
      params: this.params({ tipoReporte }),
    });
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
