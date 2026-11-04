import { computed, effect, signal, untracked } from '@angular/core';

/**
 * Paginación en el navegador para las listas que ya se filtran del lado del
 * cliente (chips, buscador, contadores): reparte la lista filtrada en páginas
 * para el `app-paginador`, sin volver a pedir datos a la API.
 *
 * Se crea en un campo del componente (contexto de inyección) porque usa un
 * `effect` para volver a la página 1 cuando cambian los filtros.
 */
export class PaginacionLocal<T> {
  readonly tamanoPagina = signal(20);
  private readonly paginaPedida = signal(1);

  readonly totalRegistros = computed(() => this.fuente().length);
  readonly totalPaginas = computed(() => Math.ceil(this.totalRegistros() / this.tamanoPagina()));

  /** La página pedida, ajustada si la lista se achicó (por ejemplo, al borrar). */
  readonly pagina = computed(() => Math.min(this.paginaPedida(), Math.max(this.totalPaginas(), 1)));

  readonly items = computed(() => {
    const tamano = this.tamanoPagina();
    const inicio = (this.pagina() - 1) * tamano;
    return this.fuente().slice(inicio, inicio + tamano);
  });

  /**
   * @param fuente la lista ya filtrada y ordenada.
   * @param filtros lo que, al cambiar, devuelve a la página 1 (chips, buscador…).
   *   No se usa la fuente para esto: recargar tras guardar no debe mover de página.
   */
  constructor(
    private readonly fuente: () => readonly T[],
    filtros?: () => unknown,
    tamanoInicial = 20,
  ) {
    this.tamanoPagina.set(tamanoInicial);
    if (filtros) {
      effect(() => {
        filtros();
        untracked(() => this.paginaPedida.set(1));
      });
    }
  }

  irA(pagina: number): void {
    this.paginaPedida.set(pagina);
  }

  cambiarTamano(tamano: number): void {
    this.tamanoPagina.set(tamano);
    this.paginaPedida.set(1);
  }
}

/**
 * Tamaño de página para traer una lista completa de la API cuando la pantalla
 * filtra y pagina en el navegador. Un taller no llega a este número; el tope
 * anterior (500) sí podía alcanzarse con los pagos de un par de años.
 */
export const TODOS_LOS_REGISTROS = 10000;
