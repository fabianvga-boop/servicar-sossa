using Microsoft.EntityFrameworkCore;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;
using ServicarSossa.Infrastructure.Data;
using ServicarSossa.Infrastructure.Extensions;

namespace ServicarSossa.Infrastructure.Repositories;

/// <inheritdoc cref="IPagoRepository"/>
public class PagoRepository(AppDbContext context)
    : Repository<Pago>(context), IPagoRepository
{
    // Sin AsNoTracking(): el Include de abajo trae Proforma.Pagos, que incluye
    // de vuelta al propio Pago raíz. EF Core no permite ese ciclo en consultas
    // sin seguimiento (no puede resolver la referencia circular sin change
    // tracker); con seguimiento sí, y esto es de solo lectura por request, sin
    // ningún SaveChanges de por medio, así que no hay riesgo de escritura.
    public async Task<Pago?> GetByIdCompletoAsync(string pagoId, CancellationToken ct = default)
        => await ConIncludes(Set)
            .FirstOrDefaultAsync(p => p.PagoId == pagoId, ct);

    public async Task<(IEnumerable<Pago> Items, int Total)> BuscarAsync(
        string? proformaId, string? clienteId, MetodoPago? metodoPago,
        DateTime? desde, DateTime? hasta, int pagina, int tamanoPagina, CancellationToken ct = default)
    {
        var query = ConIncludes(Set);

        if (!string.IsNullOrWhiteSpace(proformaId))
            query = query.Where(p => p.ProformaId == proformaId);

        if (!string.IsNullOrWhiteSpace(clienteId))
            query = query.Where(p => p.Proforma.Orden.ClienteId == clienteId);

        if (metodoPago.HasValue)
            query = query.Where(p => p.MetodoPago == metodoPago.Value);

        if (desde.HasValue)
            query = query.Where(p => p.FechaPago >= desde.Value);

        if (hasta.HasValue)
            query = query.Where(p => p.FechaPago <= hasta.Value);

        return await query.OrderByDescending(p => p.FechaPago).ToPagedListAsync(pagina, tamanoPagina, ct);
    }

    public async Task<decimal> TotalPagadoAsync(string proformaId, CancellationToken ct = default)
        => await Set.Where(p => p.ProformaId == proformaId)
                    .SumAsync(p => (decimal?)p.Monto, ct) ?? 0m;

    private static IQueryable<Pago> ConIncludes(IQueryable<Pago> query)
        => query
            .Include(p => p.Proforma).ThenInclude(f => f.Orden).ThenInclude(o => o.Cliente)
            // Los pagos hermanos permiten calcular el saldo de la proforma sin otra consulta.
            .Include(p => p.Proforma).ThenInclude(f => f.Pagos);
}
