import { AccionAuditoria } from './enums';

export interface Auditoria {
  auditoriaId: string;
  usuarioId: string;
  nombreUsuario: string;
  accion: AccionAuditoria;
  entidad: string;
  entidadId: string;
  descripcion: string;
  fecha: string;
}

export interface FiltroAuditoria {
  entidad?: string;
  entidadId?: string;
  usuarioId?: string;
  accion?: AccionAuditoria;
  desde?: string;
  hasta?: string;
}
