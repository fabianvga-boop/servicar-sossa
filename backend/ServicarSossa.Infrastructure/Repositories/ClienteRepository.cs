using Microsoft.EntityFrameworkCore;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Infrastructure.Data;
using ServicarSossa.Infrastructure.Extensions;

namespace ServicarSossa.Infrastructure.Repositories;

/// <inheritdoc cref="IClienteRepository"/>
public class ClienteRepository(AppDbContext context)
    : Repository<Cliente>(context), IClienteRepository
{
    public async Task<(IEnumerable<Cliente> Items, int Total)> BuscarAsync(
        string? buscar, int pagina, int tamanoPagina, CancellationToken ct = default)
    {
        var query = Set.AsNoTracking();

        query = query.BuscarPorPalabras(buscar,
            c => c.ClienteId, c => c.Nombre, c => c.Apellido, c => c.RazonSocial,
            c => c.CiNit, c => c.Telefono);

        // Los más recientes primero: el cliente recién registrado aparece arriba
        // en la lista y en los selectores (propietario, venta…), no en la última
        // página. El código desempata los registrados en el mismo instante.
        return await query.OrderByDescending(c => c.FechaRegistro)
                          .ThenByDescending(c => c.ClienteId)
                          .ToPagedListAsync(pagina, tamanoPagina, ct);
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
