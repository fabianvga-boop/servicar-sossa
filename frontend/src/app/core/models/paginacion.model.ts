/** Envoltorio que devuelve el backend para cualquier listado paginado. */
export interface PaginaResultado<T> {
  items: T[];
  totalRegistros: number;
  pagina: number;
  tamanoPagina: number;
  totalPaginas: number;
}
