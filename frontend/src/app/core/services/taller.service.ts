import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { EstadoDiag, EstadoServicio } from '../models/enums';
import { PaginaResultado } from '../models/paginacion.model';
import {
  Diagnostico,
  DiagnosticoRequest,
  DiagnosticoUpdate,
  ResponderDiagnostico,
  SugerenciaDiagnostico,
  TipoServicio,
  TipoServicioRequest,
} from '../models/taller.model';
import { ApiBase } from './api-base';

/** USU013 — catálogo de tipos de servicio. */
@Injectable({ providedIn: 'root' })
export class TiposServicioService extends ApiBase {
  protected readonly recurso = 'tipos-servicio';

  /** Por defecto oculta los dados de baja, que es lo que necesitan los selectores. */
  getAll(
    buscar?: string,
    soloActivos = true,
    pagina = 1,
    tamanoPagina = 20,
  ): Observable<PaginaResultado<TipoServicio>> {
    return this.listarPaginado<TipoServicio>({ buscar, soloActivos, pagina, tamanoPagina });
  }

  getById(id: string): Observable<TipoServicio> {
    return this.obtener<TipoServicio>(id);
  }

  crear(datos: TipoServicioRequest): Observable<TipoServicio> {
    return this.http.post<TipoServicio>(this.base, datos);
  }

  actualizar(id: string, datos: TipoServicioRequest): Observable<TipoServicio> {
    return this.http.put<TipoServicio>(this.url(id), datos);
  }

  cambiarEstado(id: string, estado: EstadoServicio): Observable<TipoServicio> {
    return this.http.patch<TipoServicio>(this.url(id, 'estado'), { estado });
  }
}

/** USU012, USU014-USU016 — diagnósticos de vehículos. */
@Injectable({ providedIn: 'root' })
export class DiagnosticosService extends ApiBase {
  protected readonly recurso = 'diagnosticos';

  getAll(filtros: {
    vehiculoId?: string;
    mecanicoId?: string;
    estado?: EstadoDiag;
    buscar?: string;
    pagina?: number;
    tamanoPagina?: number;
  } = {}): Observable<PaginaResultado<Diagnostico>> {
    return this.listarPaginado<Diagnostico>(filtros);
  }

  getById(id: string): Observable<Diagnostico> {
    return this.obtener<Diagnostico>(id);
  }

  /** El mecánico sale del token: no se envía en el cuerpo. */
  crear(datos: DiagnosticoRequest): Observable<Diagnostico> {
    return this.http.post<Diagnostico>(this.base, datos);
  }

  actualizar(id: string, datos: DiagnosticoUpdate): Observable<Diagnostico> {
    return this.http.put<Diagnostico>(this.url(id), datos);
  }

  cambiarEstado(id: string, estado: EstadoDiag): Observable<Diagnostico> {
    return this.http.patch<Diagnostico>(this.url(id, 'estado'), { estado });
  }

  /** Registra la respuesta del cliente al presupuesto (Aprobado / Rechazado). */
  responder(id: string, datos: ResponderDiagnostico): Observable<Diagnostico> {
    return this.http.patch<Diagnostico>(this.url(id, 'respuesta'), datos);
  }

  /** Presupuesto preliminar en PDF para entregar al cliente. */
  pdf(id: string): Observable<{ blob: Blob; nombreArchivo: string }> {
    return this.archivo([id, 'pdf'], `${id}-presupuesto.pdf`);
  }

  // --- Diagnóstico asistido ---------------------------------------------------

  /** Sugerencias mientras se redacta la falla (antes de guardar el diagnóstico). */
  sugerencias(descripcionFalla: string): Observable<SugerenciaDiagnostico> {
    return this.http.get<SugerenciaDiagnostico>(this.url('sugerencias'), {
      params: { descripcion: descripcionFalla },
    });
  }

  /** Misma sugerencia, a partir de la falla ya guardada de un diagnóstico existente. */
  sugerenciasPorId(id: string): Observable<SugerenciaDiagnostico> {
    return this.http.get<SugerenciaDiagnostico>(this.url(id, 'sugerencias'));
  }
}
