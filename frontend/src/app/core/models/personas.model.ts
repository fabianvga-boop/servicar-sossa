import { EstadoCliente, EstadoUsuario, EstadoZonaVehiculo } from './enums';

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
  /** Placas de sus vehículos: identifican al cliente mejor que un número. */
  placas: string[];
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
  /** Silueta a usar en el diagrama vectorial; inferida de marca/modelo por el backend. */
  tipoCarroceria: TipoCarroceria;
  /** SVG específico de la biblioteca de plantillas para esta marca+modelo, si existe. */
  diagramaSvgUrl: string | null;
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

/** Silueta del diagrama vectorial. Debe coincidir con TipoCarroceria del backend. */
export type TipoCarroceria =
  | 'Sedan'
  | 'Suv'
  | 'Pickup'
  | 'Furgon'
  | 'Moto'
  | 'Camion'
  | 'Hatchback'
  | 'Generico';

// --------------------------------------------- Zonas del vehículo (diagrama)

export interface VehiculoZona {
  zonaObsId: string;
  vehiculoId: string;
  ordenId?: string | null;
  zona: string;
  /** 'Ok' | 'Atencion' | 'EnReparacion', tal como lo serializa el backend. */
  estado: string;
  detalle?: string | null;
  fechaRegistro: string;
}

export interface RegistrarZonaRequest {
  zona: string;
  estado: EstadoZonaVehiculo;
  detalle?: string | null;
  ordenId?: string | null;
}

// --------------------------------- Biblioteca de plantillas (Marca+Modelo)

/** Un SVG fiel a un vehículo real (Marca+Modelo), cargado por el Administrador. */
export interface PlantillaVehiculo {
  plantillaId: string;
  marca: string;
  modelo: string;
  url: string;
  fechaSubida: string;
}

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
