using Microsoft.EntityFrameworkCore;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Infrastructure.Data;

namespace ServicarSossa.Infrastructure.Repositories;

/// <inheritdoc cref="IVehiculoRepository"/>
public class VehiculoRepository(AppDbContext context)
    : Repository<Vehiculo>(context), IVehiculoRepository
{
    public async Task<Vehiculo?> GetByIdConClienteAsync(
        string vehiculoId, CancellationToken ct = default)
        => await Set.Include(v => v.Cliente)
                    .AsNoTracking()
                    .FirstOrDefaultAsync(v => v.VehiculoId == vehiculoId, ct);

    public async Task<IEnumerable<Vehiculo>> BuscarAsync(
        string? buscar, string? clienteId, CancellationToken ct = default)
    {
        var query = Set.Include(v => v.Cliente).AsNoTracking();

        if (!string.IsNullOrWhiteSpace(clienteId))
            query = query.Where(v => v.ClienteId == clienteId);       // USU011

        if (!string.IsNullOrWhiteSpace(buscar))
        {
            var termino = $"%{buscar.Trim()}%";
            query = query.Where(v =>
                EF.Functions.ILike(v.Placa, termino) ||
                EF.Functions.ILike(v.Marca, termino) ||
                EF.Functions.ILike(v.Modelo, termino));
        }

        return await query.OrderBy(v => v.VehiculoId).ToListAsync(ct);
    }
}
