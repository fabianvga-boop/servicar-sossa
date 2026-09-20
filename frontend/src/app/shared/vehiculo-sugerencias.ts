import { Vehiculo } from '../core/models/personas.model';
import { unicosOrdenados } from './sugerencias-texto';

/**
 * Ayudas para que el alta de un vehículo se llene eligiendo, no escribiendo.
 * Compartido entre el módulo de Vehículos y el alta rápida dentro de Clientes,
 * para que ambos ofrezcan exactamente las mismas listas.
 */

/**
 * Marcas frecuentes en Bolivia: solo el punto de partida del autocompletado.
 * Se combinan con las que ya existen en la base, así el primer alta de una
 * marca nueva la deja disponible para las siguientes sin escribirla de nuevo.
 */
export const MARCAS_COMUNES = [
  'Toyota', 'Nissan', 'Suzuki', 'Hyundai', 'Kia', 'Chevrolet', 'Volkswagen',
  'Ford', 'Mitsubishi', 'Honda', 'Mazda', 'Subaru', 'Renault', 'Peugeot',
  'Fiat', 'Jeep', 'Chery', 'JAC', 'Great Wall', 'BYD', 'Daihatsu',
];

/** Colores de un clic: cubren la mayoría de los autos sin teclear nada. */
export const COLORES_RAPIDOS = ['Blanco', 'Negro', 'Gris', 'Plata', 'Rojo', 'Azul'];

/** Lista completa para el autocompletado del color (además de los rápidos). */
export const COLORES_COMUNES = [
  'Blanco', 'Negro', 'Gris', 'Plata', 'Plomo', 'Rojo', 'Azul', 'Celeste',
  'Verde', 'Amarillo', 'Naranja', 'Beige', 'Dorado', 'Vino', 'Marrón', 'Morado',
];

/**
 * Paleta aproximada para el bullet junto al nombre del color: es una ayuda
 * visual, no un dato normalizado del sistema (el color se guarda como texto
 * libre). Un nombre no reconocido cae a un gris neutro en vez de fallar.
 */
export const COLORES_VEHICULO: Record<string, string> = {
  negro: '#1f2328',
  blanco: '#f8fafc',
  gris: '#9ca3af',
  plata: '#c7ccd1',
  plomo: '#9ca3af',
  rojo: '#dc2626',
  azul: '#2563eb',
  verde: '#16a34a',
  amarillo: '#eab308',
  naranja: '#ea580c',
  marron: '#78350f',
  marrón: '#78350f',
  cafe: '#78350f',
  café: '#78350f',
  beige: '#d6c7a1',
  dorado: '#ca8a04',
  celeste: '#38bdf8',
  vino: '#7f1d1d',
  morado: '#7c3aed',
  violeta: '#7c3aed',
  rosado: '#ec4899',
  rosa: '#ec4899',
};

/** Color aproximado para el bullet; un nombre desconocido cae a gris neutro. */
export function colorPunto(nombre: string | null | undefined): string {
  if (!nombre) return 'transparent';
  return COLORES_VEHICULO[nombre.trim().toLowerCase()] ?? '#9ca3af';
}

/** Marcas para el autocompletado: las frecuentes más las ya registradas. */
export function marcasSugeridas(vehiculos: Vehiculo[]): string[] {
  return unicosOrdenados([...MARCAS_COMUNES, ...vehiculos.map((v) => v.marca)]);
}

/**
 * Modelos ya vistos, acotados a la marca en curso cuando hay una: así la
 * lista es corta y relevante en vez de mostrar todos los modelos del taller.
 */
export function modelosSugeridos(vehiculos: Vehiculo[], marca: string): string[] {
  const objetivo = marca.trim().toLowerCase();
  return unicosOrdenados(
    vehiculos
      .filter((v) => !objetivo || v.marca?.trim().toLowerCase() === objetivo)
      .map((v) => v.modelo),
  );
}

/** Colores para el autocompletado: los comunes más los ya registrados. */
export function coloresSugeridos(vehiculos: Vehiculo[]): string[] {
  return unicosOrdenados([...COLORES_COMUNES, ...vehiculos.map((v) => v.color)]);
}
