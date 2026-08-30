using Microsoft.EntityFrameworkCore;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;
using ServicarSossa.Infrastructure.Data;

namespace ServicarSossa.Infrastructure.Repositories;

/// <inheritdoc cref="IComisionRepository"/>
public class ComisionRepository(AppDbContext context)
    : Repository<Comision>(context), IComisionRepository
{
    public async Task<Comision?> GetByIdCompletaAsync(
        string comisionId, CancellationToken ct = default)
        => await ConIncludes(Set.AsNoTracking())
            .FirstOrDefaultAsync(c => c.ComisionId == comisionId, ct);

    public async Task<IEnumerable<Comision>> BuscarAsync(
        string? mecanicoId, string? ordenId, EstadoPago? estadoPago,
        DateTime? desde, DateTime? hasta, CancellationToken ct = default)
    {
        var query = ConIncludes(Set.AsNoTracking());

        if (!string.IsNullOrWhiteSpace(mecanicoId))
            query = query.Where(c => c.MecanicoId == mecanicoId);

        if (!string.IsNullOrWhiteSpace(ordenId))
            query = query.Where(c => c.OrdenId == ordenId);

        if (estadoPago.HasValue)
            query = query.Where(c => c.EstadoPago == estadoPago.Value);

        if (desde.HasValue)
            query = query.Where(c => c.FechaCalculo >= desde.Value);

        if (hasta.HasValue)
            query = query.Where(c => c.FechaCalculo <= hasta.Value);

        return await query.OrderByDescending(c => c.FechaCalculo).ToListAsync(ct);
    }

    public async Task<List<Comision>> GetParaPagoAsync(
        IEnumerable<string> comisionIds, CancellationToken ct = default)
        => await Set.Where(c => comisionIds.Contains(c.ComisionId)).ToListAsync(ct);

    public async Task<IEnumerable<Comision>> GetPorIdsAsync(
        IEnumerable<string> comisionIds, CancellationToken ct = default)
        => await ConIncludes(Set.AsNoTracking())
            .Where(c => comisionIds.Contains(c.ComisionId))
            .OrderBy(c => c.ComisionId)
            .ToListAsync(ct);

    private static IQueryable<Comision> ConIncludes(IQueryable<Comision> query)
        => query
            .Include(c => c.Mecanico)
            .Include(c => c.Orden).ThenInclude(o => o.Vehiculo)
            .Include(c => c.Orden).ThenInclude(o => o.Servicios).ThenInclude(s => s.Servicio);
}

/// <inheritdoc cref="IComisionConfigRepository"/>
public class ComisionConfigRepository(AppDbContext context)
    : Repository<ComisionConfig>(context), IComisionConfigRepository
{
    public async Task<ComisionConfig?> GetPorMecanicoAsync(
        string mecanicoId, CancellationToken ct = default)
        => await Set.FirstOrDefaultAsync(c => c.MecanicoId == mecanicoId, ct);

    public async Task<IEnumerable<ComisionConfig>> GetTodasConMecanicoAsync(
        CancellationToken ct = default)
        => await Set.Include(c => c.Mecanico)
                    .AsNoTracking()
                    .OrderBy(c => c.MecanicoId)
                    .ToListAsync(ct);
}
