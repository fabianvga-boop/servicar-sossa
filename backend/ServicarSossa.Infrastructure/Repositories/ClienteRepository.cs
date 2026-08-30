using Microsoft.EntityFrameworkCore;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Infrastructure.Data;

namespace ServicarSossa.Infrastructure.Repositories;

/// <inheritdoc cref="IClienteRepository"/>
public class ClienteRepository(AppDbContext context)
    : Repository<Cliente>(context), IClienteRepository
{
    public async Task<IEnumerable<Cliente>> BuscarAsync(
        string? buscar, CancellationToken ct = default)
    {
        var query = Set.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(buscar))
        {
            var termino = $"%{buscar.Trim()}%";
            query = query.Where(c =>
                EF.Functions.ILike(c.Nombre, termino) ||
                EF.Functions.ILike(c.Apellido ?? "", termino) ||
                EF.Functions.ILike(c.RazonSocial ?? "", termino) ||
                EF.Functions.ILike(c.CiNit, termino));
        }

        return await query.OrderBy(c => c.ClienteId).ToListAsync(ct);
    }

    public async Task<Dictionary<string, int>> ContarVehiculosPorClienteAsync(
        IEnumerable<string> clienteIds, CancellationToken ct = default)
        => await Context.Vehiculos
            .Where(v => clienteIds.Contains(v.ClienteId))
            .GroupBy(v => v.ClienteId)
            .Select(g => new { ClienteId = g.Key, Cantidad = g.Count() })
            .ToDictionaryAsync(x => x.ClienteId, x => x.Cantidad, ct);
}
