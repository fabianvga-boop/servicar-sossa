using Microsoft.EntityFrameworkCore;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;
using ServicarSossa.Infrastructure.Data;

namespace ServicarSossa.Infrastructure.Repositories;

/// <inheritdoc cref="IDiagnosticoRepository"/>
public class DiagnosticoRepository(AppDbContext context)
    : Repository<Diagnostico>(context), IDiagnosticoRepository
{
    public async Task<Diagnostico?> GetByIdCompletoAsync(
        string diagnosticoId, CancellationToken ct = default)
        => await Set.Include(d => d.Vehiculo).ThenInclude(v => v.Cliente)
                    .Include(d => d.Mecanico)
                    .Include(d => d.Orden)
                    .AsNoTracking()
                    .FirstOrDefaultAsync(d => d.DiagnosticoId == diagnosticoId, ct);

    public async Task<IEnumerable<Diagnostico>> BuscarAsync(
        string? vehiculoId,
        string? mecanicoId,
        EstadoDiag? estado,
        CancellationToken ct = default)
    {
        var query = Set.Include(d => d.Vehiculo).ThenInclude(v => v.Cliente)
                       .Include(d => d.Mecanico)
                       .Include(d => d.Orden)
                       .AsNoTracking();

        if (!string.IsNullOrWhiteSpace(vehiculoId))
            query = query.Where(d => d.VehiculoId == vehiculoId);

        if (!string.IsNullOrWhiteSpace(mecanicoId))
            query = query.Where(d => d.MecanicoId == mecanicoId);

        if (estado.HasValue)
            query = query.Where(d => d.Estado == estado.Value);

        // Más recientes primero: es el orden natural del historial clínico del vehículo.
        return await query.OrderByDescending(d => d.Fecha).ToListAsync(ct);
    }
}
