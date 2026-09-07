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

        // `Fecha` es timestamptz: Npgsql exige Kind=Utc, y el binding de la query
        // string llega con Kind=Unspecified (lanzaría ArgumentException si se
        // comparara tal cual). `.Date` además descarta cualquier hora que haya
        // llegado por error, ya que el filtro es por día completo.
        if (desde.HasValue)
        {
            var inicio = DateTime.SpecifyKind(desde.Value.Date, DateTimeKind.Utc);
            query = query.Where(c => c.Fecha >= inicio);
        }

        if (hasta.HasValue)
        {
            // El filtro "hasta" incluye todo el día indicado (mismo criterio que auditoría).
            var limite = DateTime.SpecifyKind(hasta.Value.Date.AddDays(1), DateTimeKind.Utc);
            query = query.Where(c => c.Fecha < limite);
        }

        return await query.OrderByDescending(c => c.Fecha).ToListAsync(ct);
    }

    public async Task AgregarDetalleAsync(CompraDetalle detalle, CancellationToken ct = default)
        => await Context.CompraDetalles.AddAsync(detalle, ct);
}
