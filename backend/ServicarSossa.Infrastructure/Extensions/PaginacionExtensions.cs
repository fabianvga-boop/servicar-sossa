using Microsoft.EntityFrameworkCore;

namespace ServicarSossa.Infrastructure.Extensions;

/// <summary>
/// Aplica Skip/Take a una consulta ya filtrada y ordenada, devolviendo también
/// el total de registros (antes de paginar) en la misma llamada: así el
/// frontend arma los controles de paginación sin adivinar cuántos hay.
/// </summary>
public static class PaginacionExtensions
{
    private const int TamanoPaginaPorDefecto = 20;

    /// <summary>
    /// Algunas pantallas no listan: alimentan un selector de búsqueda que
    /// filtra en el propio navegador (ver SelectorBusqueda) y necesitan el
    /// catálogo completo, no una página. El tope existe para no cargar la
    /// tabla entera por error, pero queda holgado para cubrir ese caso.
    /// </summary>
    private const int TamanoPaginaMaximo = 500;

    public static async Task<(List<T> Items, int Total)> ToPagedListAsync<T>(
        this IQueryable<T> query, int pagina, int tamanoPagina, CancellationToken ct = default)
    {
        pagina = pagina < 1 ? 1 : pagina;
        tamanoPagina = tamanoPagina switch
        {
            < 1 => TamanoPaginaPorDefecto,
            > TamanoPaginaMaximo => TamanoPaginaMaximo,
            _ => tamanoPagina
        };

        var total = await query.CountAsync(ct);
        var items = await query.Skip((pagina - 1) * tamanoPagina).Take(tamanoPagina).ToListAsync(ct);
        return (items, total);
    }
}
