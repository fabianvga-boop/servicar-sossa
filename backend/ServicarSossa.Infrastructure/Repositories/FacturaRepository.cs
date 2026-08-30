using Microsoft.EntityFrameworkCore;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;
using ServicarSossa.Infrastructure.Data;

namespace ServicarSossa.Infrastructure.Repositories;

/// <inheritdoc cref="IFacturaRepository"/>
public class FacturaRepository(AppDbContext context)
    : Repository<Factura>(context), IFacturaRepository
{
    public async Task<Factura?> GetByIdCompletaAsync(
        string facturaId, CancellationToken ct = default)
        => await ConIncludes(Set.AsNoTracking())
            .FirstOrDefaultAsync(f => f.FacturaId == facturaId, ct);

    public async Task<IEnumerable<Factura>> BuscarAsync(
        string? ordenId, string? clienteId, EstadoFactura? estado,
        DateTime? desde, DateTime? hasta, CancellationToken ct = default)
    {
        var query = ConIncludes(Set.AsNoTracking());

        if (!string.IsNullOrWhiteSpace(ordenId))
            query = query.Where(f => f.OrdenId == ordenId);

        if (!string.IsNullOrWhiteSpace(clienteId))
            query = query.Where(f => f.Orden.ClienteId == clienteId);

        if (estado.HasValue)
            query = query.Where(f => f.Estado == estado.Value);

        if (desde.HasValue)
            query = query.Where(f => f.FechaEmision >= desde.Value);

        if (hasta.HasValue)
            query = query.Where(f => f.FechaEmision <= hasta.Value);

        return await query.OrderByDescending(f => f.FechaEmision).ToListAsync(ct);
    }

    public async Task<bool> TienePagosAsync(string facturaId, CancellationToken ct = default)
        => await Context.Pagos.AnyAsync(p => p.FacturaId == facturaId, ct);

    private static IQueryable<Factura> ConIncludes(IQueryable<Factura> query)
        => query
            .Include(f => f.Orden).ThenInclude(o => o.Vehiculo)
            .Include(f => f.Orden).ThenInclude(o => o.Cliente)
            .Include(f => f.Pagos);
}
