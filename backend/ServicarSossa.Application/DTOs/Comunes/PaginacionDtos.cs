namespace ServicarSossa.Application.DTOs.Comunes;

/// <summary>
/// Envoltorio estándar para cualquier listado paginado. Reemplaza el patrón
/// anterior de devolver el arreglo completo (o un <c>Take(N)</c> fijo) por
/// una página con el total real, para que el frontend pueda armar los
/// controles de paginación sin adivinar cuántos registros hay.
/// </summary>
public class ResultadoPaginadoDto<T>
{
    public IEnumerable<T> Items { get; set; } = [];
    public int TotalRegistros { get; set; }
    public int Pagina { get; set; }
    public int TamanoPagina { get; set; }
    public int TotalPaginas => TamanoPagina > 0 ? (int)Math.Ceiling(TotalRegistros / (double)TamanoPagina) : 0;
}
