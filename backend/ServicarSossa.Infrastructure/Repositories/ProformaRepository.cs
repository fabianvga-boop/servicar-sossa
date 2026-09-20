using Microsoft.EntityFrameworkCore;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;
using ServicarSossa.Infrastructure.Data;
using ServicarSossa.Infrastructure.Extensions;

namespace ServicarSossa.Infrastructure.Repositories;

/// <inheritdoc cref="IProformaRepository"/>
public class ProformaRepository(AppDbContext context)
    : Repository<Proforma>(context), IProformaRepository
{
    public async Task<Proforma?> GetByIdCompletaAsync(
        string proformaId, CancellationToken ct = default)
        => await ConIncludes(Set.AsNoTracking())
            .FirstOrDefaultAsync(p => p.ProformaId == proformaId, ct);

    public async Task<(IEnumerable<Proforma> Items, int Total)> BuscarAsync(
        string? ordenId, string? clienteId, EstadoProforma? estado,
        DateTime? desde, DateTime? hasta, int pagina, int tamanoPagina, CancellationToken ct = default)
    {
        var query = ConIncludes(Set.AsNoTracking());

        if (!string.IsNullOrWhiteSpace(ordenId))
            query = query.Where(p => p.OrdenId == ordenId);

        if (!string.IsNullOrWhiteSpace(clienteId))
            query = query.Where(p => p.Orden.ClienteId == clienteId);

        if (estado.HasValue)
            query = query.Where(p => p.Estado == estado.Value);

        if (desde.HasValue)
            query = query.Where(p => p.FechaEmision >= desde.Value);

        if (hasta.HasValue)
            query = query.Where(p => p.FechaEmision <= hasta.Value);

        return await query.OrderByDescending(p => p.FechaEmision).ToPagedListAsync(pagina, tamanoPagina, ct);
    }

    public async Task<bool> TienePagosAsync(string proformaId, CancellationToken ct = default)
        => await Context.Pagos.AnyAsync(p => p.ProformaId == proformaId, ct);

    private static IQueryable<Proforma> ConIncludes(IQueryable<Proforma> query)
        => query
            .Include(p => p.Orden).ThenInclude(o => o.Vehiculo)
            .Include(p => p.Orden).ThenInclude(o => o.Cliente)
            .Include(p => p.Pagos);
}
