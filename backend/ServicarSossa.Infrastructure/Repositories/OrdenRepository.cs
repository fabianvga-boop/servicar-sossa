using Microsoft.EntityFrameworkCore;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;
using ServicarSossa.Infrastructure.Data;

namespace ServicarSossa.Infrastructure.Repositories;

/// <inheritdoc cref="IOrdenRepository"/>
public class OrdenRepository(AppDbContext context)
    : Repository<OrdenTrabajo>(context), IOrdenRepository
{
    public async Task<OrdenTrabajo?> GetDetalleAsync(
        string ordenId, CancellationToken ct = default)
        => await ConIncludes(Set.AsNoTracking())
            .FirstOrDefaultAsync(o => o.OrdenId == ordenId, ct);

    public async Task<OrdenTrabajo?> GetParaCierreAsync(
        string ordenId, CancellationToken ct = default)
        => await Set
            .Include(o => o.Servicios)
            .Include(o => o.Repuestos)
            .Include(o => o.Mecanicos)
            .FirstOrDefaultAsync(o => o.OrdenId == ordenId, ct);

    public async Task<IEnumerable<OrdenTrabajo>> BuscarAsync(
        string? clienteId, string? vehiculoId, string? mecanicoId,
        EstadoOrden? estado, CancellationToken ct = default)
    {
        var query = ConIncludes(Set.AsNoTracking());

        if (!string.IsNullOrWhiteSpace(clienteId))
            query = query.Where(o => o.ClienteId == clienteId);

        if (!string.IsNullOrWhiteSpace(vehiculoId))
            query = query.Where(o => o.VehiculoId == vehiculoId);

        // Órdenes en las que el mecánico está asignado o ejecutó algún servicio.
        if (!string.IsNullOrWhiteSpace(mecanicoId))
            query = query.Where(o =>
                o.Mecanicos.Any(m => m.MecanicoId == mecanicoId) ||
                o.Servicios.Any(s => s.MecanicoId == mecanicoId));

        if (estado.HasValue)
            query = query.Where(o => o.Estado == estado.Value);

        return await query.OrderByDescending(o => o.FechaCreacion).ToListAsync(ct);
    }

    // --- Detalles ------------------------------------------------------------

    public async Task<OrdenMecanico?> GetMecanicoAsignadoAsync(
        string ordenId, string mecanicoId, CancellationToken ct = default)
        => await Context.OrdenMecanicos
            .FirstOrDefaultAsync(m => m.OrdenId == ordenId && m.MecanicoId == mecanicoId, ct);

    public async Task<OrdenServicio?> GetServicioAsync(
        string ordenServicioId, CancellationToken ct = default)
        => await Context.OrdenServicios
            .FirstOrDefaultAsync(s => s.OrdenServicioId == ordenServicioId, ct);

    public async Task<OrdenRepuesto?> GetRepuestoAsync(
        string ordenRepuestoId, CancellationToken ct = default)
        => await Context.OrdenRepuestos
            .FirstOrDefaultAsync(r => r.OrdenRepuestoId == ordenRepuestoId, ct);

    public void AgregarMecanico(OrdenMecanico asignacion)
        => Context.OrdenMecanicos.Add(asignacion);

    public void QuitarMecanico(OrdenMecanico asignacion)
        => Context.OrdenMecanicos.Remove(asignacion);

    public async Task AgregarServicioAsync(OrdenServicio servicio, CancellationToken ct = default)
        => await Context.OrdenServicios.AddAsync(servicio, ct);

    public void QuitarServicio(OrdenServicio servicio)
        => Context.OrdenServicios.Remove(servicio);

    public async Task AgregarRepuestoAsync(OrdenRepuesto repuesto, CancellationToken ct = default)
        => await Context.OrdenRepuestos.AddAsync(repuesto, ct);

    public void QuitarRepuesto(OrdenRepuesto repuesto)
        => Context.OrdenRepuestos.Remove(repuesto);

    /// <summary>Includes compartidos por todas las lecturas de consulta.</summary>
    private static IQueryable<OrdenTrabajo> ConIncludes(IQueryable<OrdenTrabajo> query)
        => query
            .Include(o => o.Vehiculo)
            .Include(o => o.Cliente)
            .Include(o => o.Administrador)
            .Include(o => o.Diagnostico)
            .Include(o => o.Mecanicos).ThenInclude(m => m.Mecanico)
            .Include(o => o.Servicios).ThenInclude(s => s.Servicio)
            .Include(o => o.Servicios).ThenInclude(s => s.Mecanico)
            .Include(o => o.Repuestos).ThenInclude(r => r.Repuesto);
}
