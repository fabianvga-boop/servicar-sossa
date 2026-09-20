using Microsoft.EntityFrameworkCore;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;
using ServicarSossa.Infrastructure.Data;
using ServicarSossa.Infrastructure.Extensions;

namespace ServicarSossa.Infrastructure.Repositories;

/// <inheritdoc cref="IFacturaRepository"/>
public class FacturaRepository(AppDbContext context)
    : Repository<Factura>(context), IFacturaRepository
{
    public async Task<Factura?> GetByIdCompletaAsync(
        string facturaId, CancellationToken ct = default)
        => await ConIncludes(Set.AsNoTracking())
            .FirstOrDefaultAsync(f => f.FacturaId == facturaId, ct);

    public async Task<(IEnumerable<Factura> Items, int Total)> BuscarAsync(
        string? ordenId, string? ventaId, EstadoFactura? estado, EstadoSiat? estadoSiat,
        DateTime? desde, DateTime? hasta, int pagina, int tamanoPagina, CancellationToken ct = default)
    {
        var query = ConIncludes(Set.AsNoTracking());

        if (!string.IsNullOrWhiteSpace(ordenId))
            query = query.Where(f => f.OrdenId == ordenId);

        if (!string.IsNullOrWhiteSpace(ventaId))
            query = query.Where(f => f.VentaId == ventaId);

        if (estado.HasValue)
            query = query.Where(f => f.Estado == estado.Value);

        if (estadoSiat.HasValue)
            query = query.Where(f => f.EstadoSiat == estadoSiat.Value);

        if (desde.HasValue)
            query = query.Where(f => f.FechaEmision >= desde.Value);

        if (hasta.HasValue)
            query = query.Where(f => f.FechaEmision <= hasta.Value);

        return await query.OrderByDescending(f => f.FechaEmision).ToPagedListAsync(pagina, tamanoPagina, ct);
    }

    /// <summary>
    /// El XML no se incluye: son campos grandes y ninguna pantalla los lista.
    /// Se leen aparte, por factura, cuando alguien pide el respaldo.
    /// </summary>
    private static IQueryable<Factura> ConIncludes(IQueryable<Factura> query)
        => query
            .Include(f => f.Orden!).ThenInclude(o => o.Vehiculo)
            .Include(f => f.Orden!).ThenInclude(o => o.Cliente)
            .Include(f => f.Venta!).ThenInclude(v => v.Cliente);
}
