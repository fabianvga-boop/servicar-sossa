using Microsoft.EntityFrameworkCore;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;
using ServicarSossa.Infrastructure.Data;

namespace ServicarSossa.Infrastructure.Repositories;

/// <inheritdoc cref="ITipoServicioRepository"/>
public class TipoServicioRepository(AppDbContext context)
    : Repository<TipoServicio>(context), ITipoServicioRepository
{
    public async Task<IEnumerable<TipoServicio>> BuscarAsync(
        string? buscar, bool soloActivos, CancellationToken ct = default)
    {
        var query = Set.AsNoTracking();

        if (soloActivos)
            query = query.Where(s => s.Estado == EstadoServicio.Activo);

        if (!string.IsNullOrWhiteSpace(buscar))
        {
            var termino = $"%{buscar.Trim()}%";
            query = query.Where(s =>
                EF.Functions.ILike(s.Nombre, termino) ||
                EF.Functions.ILike(s.Descripcion ?? "", termino));
        }

        return await query.OrderBy(s => s.Nombre).ToListAsync(ct);
    }
}
