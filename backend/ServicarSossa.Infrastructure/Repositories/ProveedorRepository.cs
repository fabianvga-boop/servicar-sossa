using Microsoft.EntityFrameworkCore;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Infrastructure.Data;
using ServicarSossa.Infrastructure.Extensions;

namespace ServicarSossa.Infrastructure.Repositories;

/// <inheritdoc cref="IProveedorRepository"/>
public class ProveedorRepository(AppDbContext context)
    : Repository<Proveedor>(context), IProveedorRepository
{
    public async Task<(IEnumerable<Proveedor> Items, int Total)> BuscarAsync(
        string? buscar, int pagina, int tamanoPagina, CancellationToken ct = default)
    {
        var query = Set.AsNoTracking();

        query = query.BuscarPorPalabras(buscar,
            p => p.ProveedorId, p => p.Nombre, p => p.Contacto, p => p.Telefono);

        return await query.OrderBy(p => p.Nombre).ToPagedListAsync(pagina, tamanoPagina, ct);
    }

    public async Task<Dictionary<string, int>> ContarRepuestosPorProveedorAsync(
        IEnumerable<string> proveedorIds, CancellationToken ct = default)
        => await Context.Repuestos
            .Where(r => r.ProveedorId != null && proveedorIds.Contains(r.ProveedorId))
            .GroupBy(r => r.ProveedorId!)
            .Select(g => new { ProveedorId = g.Key, Cantidad = g.Count() })
            .ToDictionaryAsync(x => x.ProveedorId, x => x.Cantidad, ct);

    public async Task<bool> TieneReferenciasAsync(
        string proveedorId, CancellationToken ct = default)
        => await Context.Repuestos.AnyAsync(r => r.ProveedorId == proveedorId, ct)
        || await Context.Compras.AnyAsync(c => c.ProveedorId == proveedorId, ct);
}
