using Microsoft.EntityFrameworkCore;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Infrastructure.Data;

namespace ServicarSossa.Infrastructure.Repositories;

/// <inheritdoc cref="ICategoriaRepuestoRepository"/>
public class CategoriaRepuestoRepository(AppDbContext context)
    : Repository<CategoriaRepuesto>(context), ICategoriaRepuestoRepository
{
    public async Task<List<CategoriaRepuesto>> ListarAsync(CancellationToken ct = default)
        => await Set.AsNoTracking().OrderBy(c => c.Nombre).ToListAsync(ct);

    public async Task<Dictionary<string, (int Repuestos, int Servicios)>> ContarUsosAsync(
        CancellationToken ct = default)
    {
        var repuestos = await Context.Repuestos
            .Where(r => r.CategoriaId != null)
            .GroupBy(r => r.CategoriaId!)
            .Select(g => new { g.Key, Cantidad = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Cantidad, ct);

        var servicios = await Context.ServicioCategorias
            .GroupBy(s => s.CategoriaId)
            .Select(g => new { g.Key, Cantidad = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Cantidad, ct);

        return repuestos.Keys.Union(servicios.Keys).ToDictionary(
            id => id,
            id => (repuestos.GetValueOrDefault(id), servicios.GetValueOrDefault(id)));
    }
}
