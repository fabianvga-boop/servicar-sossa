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
}

export interface CambiarPassword {
  passwordActual: string;
  passwordNueva: string;
}

/** Sesión activa, derivada del token guardado. */
export interface Sesion {
  usuarioId: string;
  username: string;
  nombreCompleto: string;
  rol: Rol;
  expiraEn: Date;
}
