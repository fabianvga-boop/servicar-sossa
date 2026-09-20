using Microsoft.EntityFrameworkCore;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;
using ServicarSossa.Infrastructure.Data;
using ServicarSossa.Infrastructure.Extensions;

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
        => await ConstruirConsulta(vehiculoId, mecanicoId, estado).ToListAsync(ct);

    public async Task<(IEnumerable<Diagnostico> Items, int Total)> BuscarPaginadoAsync(
        string? vehiculoId,
        string? mecanicoId,
        EstadoDiag? estado,
        string? buscar,
        int pagina, int tamanoPagina,
        CancellationToken ct = default)
        => await ConstruirConsulta(vehiculoId, mecanicoId, estado, buscar)
            .ToPagedListAsync(pagina, tamanoPagina, ct);

    public async Task<IEnumerable<Diagnostico>> ObtenerConOrdenParaSugerenciasAsync(
        CancellationToken ct = default)
        => await Set
            .Where(d => d.Orden != null)
            .Include(d => d.Orden!).ThenInclude(o => o.Servicios).ThenInclude(s => s.Servicio)
            .Include(d => d.Orden!).ThenInclude(o => o.Repuestos).ThenInclude(r => r.Repuesto)
            .AsNoTracking()
            .ToListAsync(ct);

    // Más recientes primero: es el orden natural del historial clínico del vehículo.
    private IQueryable<Diagnostico> ConstruirConsulta(
        string? vehiculoId, string? mecanicoId, EstadoDiag? estado, string? buscar = null)
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

        if (!string.IsNullOrWhiteSpace(buscar))
        {
            var termino = $"%{buscar.Trim()}%";
            query = query.Where(d =>
                EF.Functions.ILike(d.DescripcionFalla, termino) ||
                (d.ObservacionesTecnicas != null && EF.Functions.ILike(d.ObservacionesTecnicas, termino)) ||
                EF.Functions.ILike(d.Vehiculo.Placa, termino));
        }

        return query.OrderByDescending(d => d.Fecha);
    }
}
