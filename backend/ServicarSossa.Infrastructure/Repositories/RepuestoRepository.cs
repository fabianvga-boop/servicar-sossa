using Microsoft.EntityFrameworkCore;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Infrastructure.Data;

namespace ServicarSossa.Infrastructure.Repositories;

/// <inheritdoc cref="IRepuestoRepository"/>
public class RepuestoRepository(AppDbContext context)
    : Repository<Repuesto>(context), IRepuestoRepository
{
    public async Task<Repuesto?> GetByIdConProveedorAsync(
        string repuestoId, CancellationToken ct = default)
        => await Set.Include(r => r.Proveedor)
                    .AsNoTracking()
                    .FirstOrDefaultAsync(r => r.RepuestoId == repuestoId, ct);

    public async Task<IEnumerable<Repuesto>> BuscarAsync(
        string? buscar, string? proveedorId, bool soloStockBajo, CancellationToken ct = default)
    {
        var query = Set.Include(r => r.Proveedor).AsNoTracking();

        if (!string.IsNullOrWhiteSpace(proveedorId))
            query = query.Where(r => r.ProveedorId == proveedorId);

        if (soloStockBajo)
            query = query.Where(r => r.StockActual <= r.StockMinimo);   // USU030

        if (!string.IsNullOrWhiteSpace(buscar))
        {
            var termino = $"%{buscar.Trim()}%";
            query = query.Where(r =>
                EF.Functions.ILike(r.Nombre, termino) ||
                EF.Functions.ILike(r.Descripcion ?? "", termino));
        }

        return await query.OrderBy(r => r.Nombre).ToListAsync(ct);
    }

    public async Task<bool> TieneMovimientosAsync(
        string repuestoId, CancellationToken ct = default)
        => await Context.CompraDetalles.AnyAsync(d => d.RepuestoId == repuestoId, ct)
        || await Context.OrdenRepuestos.AnyAsync(o => o.RepuestoId == repuestoId, ct)
        || await Context.VentaDetalles.AnyAsync(v => v.RepuestoId == repuestoId, ct);
}
