import { Vehiculo } from '../core/models/personas.model';
import { normalizarTexto } from './busqueda';
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

/**
 * Modelos frecuentes de cada marca de {@link MARCAS_COMUNES}. Igual que las
 * marcas, son el punto de partida del catálogo: se suman a los modelos de los
 * vehículos registrados y de las plantillas, y fijan una escritura de
 * referencia ("RAV4", no "rav 4") para que vehículos y repuestos coincidan.
 */
export const MODELOS_COMUNES: Record<string, string[]> = {
  Toyota: [
    'Corolla', 'Hilux', 'RAV4', 'Yaris', 'Land Cruiser', 'Land Cruiser Prado', '4Runner',
    'Fortuner', 'Rush', 'Avanza', 'Probox', 'Vitz', 'Ipsum', 'Noah', 'Hiace', 'Starlet',
    'Corona', 'Camry', 'Auris', 'Premio', 'Allion', 'Raize',
  ],
  Nissan: [
    'Sentra', 'Versa', 'March', 'Tiida', 'X-Trail', 'Frontier', 'Navara', 'Pathfinder',
    'Patrol', 'Kicks', 'Qashqai', 'Note', 'Sunny',
  ],
  Suzuki: ['Swift', 'Alto', 'Vitara', 'Grand Vitara', 'Jimny', 'S-Presso', 'Ertiga', 'Baleno', 'Celerio', 'Dzire'],
  Hyundai: ['Accent', 'Elantra', 'Tucson', 'Santa Fe', 'Creta', 'i10', 'Grand i10', 'H-1', 'Venue'],
  Kia: ['Rio', 'Picanto', 'Sportage', 'Sorento', 'Cerato', 'Soluto', 'Seltos', 'Sonet'],
  Chevrolet: ['Spark', 'Sail', 'Onix', 'Aveo', 'Tracker', 'Captiva', 'S10', 'Cruze', 'N300'],
  Volkswagen: ['Gol', 'Polo', 'Virtus', 'Jetta', 'Amarok', 'Tiguan', 'T-Cross'],
  Ford: ['Ranger', 'Explorer', 'EcoSport', 'Escape', 'F-150', 'Fiesta', 'Focus'],
  Mitsubishi: ['L200', 'Montero', 'Montero Sport', 'Outlander', 'ASX', 'Lancer', 'Mirage'],
  Honda: ['Civic', 'CR-V', 'Fit', 'City', 'HR-V', 'Accord'],
  Mazda: ['Mazda2', 'Mazda3', 'CX-3', 'CX-5', 'CX-30', 'BT-50'],
  Subaru: ['Forester', 'Impreza', 'Outback', 'XV'],
  Renault: ['Duster', 'Logan', 'Sandero', 'Kwid', 'Oroch', 'Koleos'],
  Peugeot: ['208', '2008', '3008', '301', 'Partner'],
  Fiat: ['Uno', 'Palio', 'Strada', 'Mobi', 'Cronos', 'Fiorino'],
  Jeep: ['Wrangler', 'Cherokee', 'Grand Cherokee', 'Compass', 'Renegade'],
  Chery: ['Tiggo 2', 'Tiggo 4', 'Tiggo 7', 'QQ', 'Arrizo 5'],
  JAC: ['S2', 'S3', 'T6', 'J4', 'Refine'],
  'Great Wall': ['Wingle', 'Haval H6', 'Poer'],
  BYD: ['F3', 'Dolphin', 'Song', 'Yuan'],
  Daihatsu: ['Terios', 'Sirion', 'Hijet', 'Mira'],
};

/** Lo único que el catálogo necesita de un vehículo o de una plantilla. */
export interface MarcaModelo {
  marca?: string | null;
  modelo?: string | null;
}

/** Clave de comparación: sin mayúsculas, espacios de más ni tildes. */
function clave(texto: string | null | undefined): string {
  return normalizarTexto((texto ?? '').trim()).replace(/\s+/g, ' ');
}

/**
 * Como {@link unicosOrdenados}, pero "Toyota" y "toyota" cuentan como uno
 * solo: se queda la primera escritura, por eso el catálogo va primero.
 */
function unicosSinDistinguir(valores: (string | null | undefined)[]): string[] {
  const vistos = new Map<string, string>();
  for (const valor of valores) {
    const limpio = valor?.trim();
    if (limpio && !vistos.has(clave(limpio))) vistos.set(clave(limpio), limpio);
  }
  return [...vistos.values()].sort((a, b) => a.localeCompare(b));
}

/** Marcas para el autocompletado: las frecuentes más las ya registradas. */
export function marcasSugeridas(registrados: MarcaModelo[]): string[] {
  return unicosSinDistinguir([...MARCAS_COMUNES, ...registrados.map((v) => v.marca)]);
}

/**
 * Modelos de la marca en curso (los frecuentes más los ya registrados); sin
 * marca, solo los ya vistos en el taller, para que la lista no sea enorme.
 */
export function modelosSugeridos(registrados: MarcaModelo[], marca: string): string[] {
  const objetivo = clave(marca);
  const comunes = objetivo
    ? Object.entries(MODELOS_COMUNES).find(([m]) => clave(m) === objetivo)?.[1] ?? []
    : [];
  return unicosSinDistinguir([
    ...comunes,
    ...registrados
      .filter((v) => !objetivo || clave(v.marca) === objetivo)
      .map((v) => v.modelo),
  ]);
}

/**
 * Si `valor` no está en `opciones` pero se le parece mucho (una o dos letras
 * de diferencia), devuelve la opción parecida: "Corola" → "Corolla". Sirve
 * para avisar de un error de tipeo antes de que entre al catálogo.
 */
export function parecidoEnCatalogo(valor: string, opciones: string[]): string | null {
  const buscado = clave(valor);
  if (!buscado || opciones.some((o) => clave(o) === buscado)) return null;

  const tolerancia = buscado.length <= 4 ? 1 : 2;
  let mejor: string | null = null;
  let menor = tolerancia + 1;
  for (const opcion of opciones) {
    const d = distancia(buscado, clave(opcion));
    if (d < menor) {
      menor = d;
      mejor = opcion;
    }
  }
  return mejor;
}

/** Distancia de edición (Levenshtein): letras a cambiar, quitar o agregar. */
function distancia(a: string, b: string): number {
  let previa = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const actual = [i];
    for (let j = 1; j <= b.length; j++) {
      actual[j] = Math.min(
        previa[j] + 1,
        actual[j - 1] + 1,
        previa[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previa = actual;
  }
  return previa[b.length];
}

/** Colores para el autocompletado: los comunes más los ya registrados. */
export function coloresSugeridos(vehiculos: Vehiculo[]): string[] {
  return unicosOrdenados([...COLORES_COMUNES, ...vehiculos.map((v) => v.color)]);
}
