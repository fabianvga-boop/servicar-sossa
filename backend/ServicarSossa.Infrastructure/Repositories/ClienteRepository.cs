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

    public async Task<Dictionary<string, List<string>>> ObtenerPlacasPorClienteAsync(
        IEnumerable<string> clienteIds, CancellationToken ct = default)
    {
        // Solo cliente y placa: no se materializan entidades Vehiculo completas.
        var filas = await Context.Vehiculos
            .Where(v => clienteIds.Contains(v.ClienteId))
            .OrderBy(v => v.Placa)
            .Select(v => new { v.ClienteId, v.Placa })
            .ToListAsync(ct);

        return filas
            .GroupBy(f => f.ClienteId)
            .ToDictionary(g => g.Key, g => g.Select(f => f.Placa).ToList());
    }
}
