import { HttpClient, HttpParams } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { nombreDesdeCabecera } from './descarga';

/**
 * Resuelve una ruta pública devuelta por el backend (ej. "/uploads/vehiculos/FOT-001.jpg")
 * contra su origen. `environment.apiUrl` termina en "/api", así que se recorta.
 */
export function urlArchivo(rutaPublica: string): string {
  const origen = environment.apiUrl.replace(/\/api\/?$/, '');
  return `${origen}${rutaPublica}`;
}

/**
 * Base de todos los servicios de datos: resuelve la URL del recurso y arma
 * los query params omitiendo los vacíos, para no mandar `?buscar=` al backend.
 */
export abstract class ApiBase {
  protected readonly http = inject(HttpClient);

  /** Segmento del recurso, por ejemplo `clientes` o `tipos-servicio`. */
  protected abstract readonly recurso: string;

  protected get base(): string {
    return `${environment.apiUrl}/${this.recurso}`;
  }

  protected url(...segmentos: (string | number)[]): string {
    return [this.base, ...segmentos].join('/');
  }

  /** Convierte un objeto a HttpParams descartando null, undefined y cadenas vacías. */
  protected params(filtros: Record<string, unknown> = {}): HttpParams {
    let params = new HttpParams();

    for (const [clave, valor] of Object.entries(filtros)) {
      if (valor === null || valor === undefined || valor === '') continue;
      params = params.set(clave, String(valor));
    }

    return params;
  }

  protected listar<T>(filtros?: Record<string, unknown>): Observable<T[]> {
    return this.http.get<T[]>(this.base, { params: this.params(filtros) });
  }

  protected obtener<T>(id: string): Observable<T> {
    return this.http.get<T>(this.url(id));
  }

  /**
   * Descarga un archivo del recurso (por ejemplo `facturas/FAC-001/pdf`).
   * Conserva el nombre que el backend puso en Content-Disposition; si la
   * cabecera no llega, cae al que se indique como respaldo.
   */
  protected archivo(
    segmentos: (string | number)[],
    nombrePorDefecto: string,
  ): Observable<{ blob: Blob; nombreArchivo: string }> {
    return this.http
      .get(this.url(...segmentos), { responseType: 'blob', observe: 'response' })
      .pipe(
        map((respuesta) => ({
          blob: respuesta.body!,
          nombreArchivo:
            nombreDesdeCabecera(respuesta.headers.get('Content-Disposition')) ??
            nombrePorDefecto,
        })),
      );
  }
}
