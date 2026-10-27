import { CategoriaRepuesto, CategoriaResumen } from '../core/models/inventario.model';

/** Valor del filtro de Repuestos para los que todavía no tienen categoría. */
export const SIN_CATEGORIA = 'sin-categoria';

/** Minúsculas y sin tildes: "Batería" y "bateria" son lo mismo. */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

interface Regla {
  /** Nombre de la categoría tal como viene cargada de fábrica (normalizado). */
  categoria: string;
  patron: RegExp;
  excluir?: RegExp;
}

/**
 * Del nombre de un repuesto a su categoría. El orden importa: gana la
 * primera regla, y "Filtro de aceite" es filtro antes que aceite. Es la misma
 * clasificación que hizo la migración con los repuestos que ya existían.
 */
const REGLAS_REPUESTO: Regla[] = [
  { categoria: 'filtro de aceite', patron: /filtro.*aceite/ },
  { categoria: 'filtro de aire', patron: /filtro.*(aire|cabina)/ },
  { categoria: 'filtro de combustible', patron: /filtro.*(combust|gasol|diesel)/ },
  { categoria: 'aceite de transmision', patron: /aceite.*(transmisi|caja|diferencial)|\batf\b/ },
  { categoria: 'aceite de motor', patron: /aceite|lubricante/ },
  { categoria: 'pastillas de freno', patron: /pastilla/ },
  { categoria: 'discos de freno', patron: /disco/, excluir: /embrague/ },
  { categoria: 'liquido de frenos', patron: /liquido.*freno|\bdot ?[34]\b/ },
  { categoria: 'bateria', patron: /bater/ },
  { categoria: 'bujias', patron: /buj/ },
  { categoria: 'refrigerante', patron: /refrigerante|anticongelante/ },
  { categoria: 'amortiguadores', patron: /amortiguador/ },
  { categoria: 'correas', patron: /correa|banda/ },
  { categoria: 'embrague', patron: /embrague|clutch/ },
  { categoria: 'llantas', patron: /llanta|neumatic/ },
  { categoria: 'iluminacion', patron: /foco|faro|bombilla/ },
  { categoria: 'fusibles y electricos', patron: /fusible/ },
  { categoria: 'limpiaparabrisas', patron: /plumilla|limpiaparabrisas/ },
];

/**
 * Del nombre de un servicio a las categorías que lleva. Acá suman todas las
 * que coinciden: "Cambio de aceite y filtro" lleva aceite y filtro.
 */
const REGLAS_SERVICIO: Regla[] = [
  { categoria: 'aceite de motor', patron: /aceite/, excluir: /transmisi|caja|^[^y]*filtro de aceite/ },
  { categoria: 'filtro de aceite', patron: /aceite.*filtro|filtro.*aceite/ },
  { categoria: 'filtro de aire', patron: /filtro.*aire/ },
  { categoria: 'filtro de combustible', patron: /filtro.*(combust|gasol|diesel)/ },
  { categoria: 'aceite de transmision', patron: /aceite.*(transmisi|caja)/ },
  { categoria: 'pastillas de freno', patron: /pastilla/ },
  { categoria: 'discos de freno', patron: /disco.*freno/ },
  { categoria: 'liquido de frenos', patron: /liquido.*freno/ },
  { categoria: 'bateria', patron: /bater/ },
  { categoria: 'bujias', patron: /buj/ },
  { categoria: 'refrigerante', patron: /refrigerante|anticongelante/ },
  { categoria: 'amortiguadores', patron: /amortiguador/ },
  { categoria: 'correas', patron: /correa|banda/ },
  { categoria: 'embrague', patron: /embrague|clutch/ },
  { categoria: 'llantas', patron: /llanta|neumatic/ },
];

function cumple(regla: Regla, nombre: string): boolean {
  return regla.patron.test(nombre) && !(regla.excluir?.test(nombre) ?? false);
}

/** Busca la categoría por nombre: si el Administrador la renombró, no se sugiere. */
function buscar<T extends CategoriaResumen>(categorias: T[], nombre: string): T | undefined {
  return categorias.find((c) => normalizar(c.nombre) === nombre);
}

/** Categoría que corresponde al nombre de un repuesto, o null si no se reconoce. */
export function sugerirCategoriaRepuesto(
  nombre: string,
  categorias: CategoriaRepuesto[],
): CategoriaRepuesto | null {
  const texto = normalizar(nombre);
  if (texto.length < 3) return null;

  const regla = REGLAS_REPUESTO.find((r) => cumple(r, texto));
  return (regla && buscar(categorias, regla.categoria)) ?? null;
}

/** Categorías que lleva un servicio según su nombre ("Cambio de bujías" → Bujías). */
export function sugerirCategoriasServicio(
  nombre: string,
  categorias: CategoriaRepuesto[],
): CategoriaRepuesto[] {
  const texto = normalizar(nombre);
  if (texto.length < 3) return [];

  return REGLAS_SERVICIO.filter((r) => cumple(r, texto))
    .map((r) => buscar(categorias, r.categoria))
    .filter((c): c is CategoriaRepuesto => !!c);
}
