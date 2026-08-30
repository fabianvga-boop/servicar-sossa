using Microsoft.EntityFrameworkCore;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Infrastructure.Data;

namespace ServicarSossa.Infrastructure.Repositories;

/// <inheritdoc cref="ICompraRepository"/>
public class CompraRepository(AppDbContext context)
    : Repository<Compra>(context), ICompraRepository
{
    public async Task<Compra?> GetDetalleAsync(string compraId, CancellationToken ct = default)
        => await Set
            .Include(c => c.Proveedor)
            .Include(c => c.Usuario)
            .Include(c => c.Detalles).ThenInclude(d => d.Repuesto)
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.CompraId == compraId, ct);

    public async Task<IEnumerable<Compra>> BuscarAsync(
        string? proveedorId, DateTime? desde, DateTime? hasta, CancellationToken ct = default)
    {
        var query = Set
            .Include(c => c.Proveedor)
            .Include(c => c.Usuario)
            .Include(c => c.Detalles)
            .AsNoTracking();

        if (!string.IsNullOrWhiteSpace(proveedorId))
            query = query.Where(c => c.ProveedorId == proveedorId);

        if (desde.HasValue)
            query = query.Where(c => c.Fecha >= desde.Value);

        if (hasta.HasValue)
            query = query.Where(c => c.Fecha <= hasta.Value);

        return await query.OrderByDescending(c => c.Fecha).ToListAsync(ct);
    }

    public async Task AgregarDetalleAsync(CompraDetalle detalle, CancellationToken ct = default)
        => await Context.CompraDetalles.AddAsync(detalle, ct);
}
