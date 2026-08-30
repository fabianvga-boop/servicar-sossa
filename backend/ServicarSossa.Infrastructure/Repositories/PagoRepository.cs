using Microsoft.EntityFrameworkCore;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;
using ServicarSossa.Infrastructure.Data;

namespace ServicarSossa.Infrastructure.Repositories;

/// <inheritdoc cref="IPagoRepository"/>
public class PagoRepository(AppDbContext context)
    : Repository<Pago>(context), IPagoRepository
{
    public async Task<Pago?> GetByIdCompletoAsync(string pagoId, CancellationToken ct = default)
        => await ConIncludes(Set.AsNoTracking())
            .FirstOrDefaultAsync(p => p.PagoId == pagoId, ct);

    public async Task<IEnumerable<Pago>> BuscarAsync(
        string? facturaId, string? clienteId, MetodoPago? metodoPago,
        DateTime? desde, DateTime? hasta, CancellationToken ct = default)
    {
        var query = ConIncludes(Set.AsNoTracking());

        if (!string.IsNullOrWhiteSpace(facturaId))
            query = query.Where(p => p.FacturaId == facturaId);

        if (!string.IsNullOrWhiteSpace(clienteId))
            query = query.Where(p => p.Factura.Orden.ClienteId == clienteId);

        if (metodoPago.HasValue)
            query = query.Where(p => p.MetodoPago == metodoPago.Value);

        if (desde.HasValue)
            query = query.Where(p => p.FechaPago >= desde.Value);

        if (hasta.HasValue)
            query = query.Where(p => p.FechaPago <= hasta.Value);

        return await query.OrderByDescending(p => p.FechaPago).ToListAsync(ct);
    }

    public async Task<decimal> TotalPagadoAsync(string facturaId, CancellationToken ct = default)
        => await Set.Where(p => p.FacturaId == facturaId)
                    .SumAsync(p => (decimal?)p.Monto, ct) ?? 0m;

    private static IQueryable<Pago> ConIncludes(IQueryable<Pago> query)
        => query
            .Include(p => p.Factura).ThenInclude(f => f.Orden).ThenInclude(o => o.Cliente)
            // Los pagos hermanos permiten calcular el saldo de la factura sin otra consulta.
            .Include(p => p.Factura).ThenInclude(f => f.Pagos);
}
