import { EstadoCliente, EstadoUsuario } from './enums';

// ------------------------------------------------------------------ Usuarios

export interface Usuario {
  usuarioId: string;
  nombre: string;
  apellido: string;
  nombreCompleto: string;
  email: string;
  username: string;
  rolId: string;
  nombreRol: string;
  telefono?: string | null;
  estado: EstadoUsuario;
  fechaRegistro: string;
}

export interface UsuarioRequest {
  nombre: string;
  apellido: string;
  email: string;
  username: string;
  password: string;
  rolId: string;
  telefono?: string | null;
}

export interface UsuarioUpdate {
  nombre: string;
  apellido: string;
  email: string;
  rolId: string;
  telefono?: string | null;
}

export interface Rol {
  rolId: string;
  nombreRol: string;
  descripcion?: string | null;
}

// ------------------------------------------------------------------ Clientes

export interface Cliente {
  clienteId: string;
  nombre: string;
  apellido?: string | null;
  razonSocial?: string | null;
  ciNit: string;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
  fechaRegistro: string;
  estado: EstadoCliente;
  cantidadVehiculos: number;
}

export interface ClienteRequest {
  nombre: string;
  apellido?: string | null;
  razonSocial?: string | null;
  ciNit: string;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
}

// ----------------------------------------------------------------- Vehículos

export interface Vehiculo {
  vehiculoId: string;
  clienteId: string;
  nombreCliente: string;
  placa: string;
  marca: string;
  modelo: string;
  anio?: number | null;
  color?: string | null;
  numMotor?: string | null;
  numChasis?: string | null;
  kilometraje?: number | null;
  fechaRegistro: string;
}

export interface VehiculoRequest {
  clienteId: string;
  placa: string;
  marca: string;
  modelo: string;
  anio?: number | null;
  color?: string | null;
  numMotor?: string | null;
  numChasis?: string | null;
  kilometraje?: number | null;
}

export type VehiculoUpdate = Omit<VehiculoRequest, 'clienteId'>;

// -------------------------------------------------- Fotos del vehículo (galería)

export interface VehiculoFoto {
  fotoId: string;
  vehiculoId: string;
  /** Ruta pública relativa al origen del backend, ej. "/uploads/vehiculos/FOT-001.jpg". */
  url: string;
  fechaSubida: string;
}

// ------------------------------------------------------- Historial (vehículo)

export interface ResumenHistorial {
  totalVisitas: number;
  gastoAcumulado: number;
  ultimaVisita?: string | null;
}

export interface EventoHistorial {
  tipo: 'Diagnostico' | 'Orden';
  id: string;
  fecha: string;
  estado: string;
  detalle: string;
}

export interface ServicioFrecuente {
  nombre: string;
  cantidad: number;
}

export interface HistorialVehiculo {
  resumen: ResumenHistorial;
  eventos: EventoHistorial[];
  serviciosFrecuentes: ServicioFrecuente[];
}
