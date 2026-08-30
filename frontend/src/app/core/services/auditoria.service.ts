import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Auditoria, FiltroAuditoria } from '../models/auditoria.model';
import { ApiBase } from './api-base';

/** Bitácora de auditoría: quién hizo qué, cuándo y sobre qué registro. */
@Injectable({ providedIn: 'root' })
export class AuditoriaService extends ApiBase {
  protected readonly recurso = 'auditoria';

  getAll(filtros: FiltroAuditoria = {}): Observable<Auditoria[]> {
    return this.listar<Auditoria>({ ...filtros });
  }
}
