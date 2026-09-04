import { Rol } from './enums';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  expiraEn: string;
  usuarioId: string;
  username: string;
  nombreCompleto: string;
  rol: Rol;
  /** Ruta de la foto de perfil, o null si el usuario no subió ninguna. */
  fotoUrl: string | null;
}

export interface CambiarPassword {
  passwordActual: string;
  passwordNueva: string;
}

/** Datos del usuario autenticado que devuelve /auth/perfil y sus acciones. */
export interface PerfilResponse {
  usuarioId: string;
  nombreCompleto: string;
  username: string;
  nombreRol: string;
  fotoUrl: string | null;
}

/** Sesión activa, derivada del token guardado. */
export interface Sesion {
  usuarioId: string;
  username: string;
  nombreCompleto: string;
  rol: Rol;
  expiraEn: Date;
  fotoUrl: string | null;
}
