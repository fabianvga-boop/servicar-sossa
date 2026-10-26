using Microsoft.EntityFrameworkCore;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;
using ServicarSossa.Infrastructure.Data;
using ServicarSossa.Infrastructure.Extensions;

namespace ServicarSossa.Infrastructure.Repositories;

/// <inheritdoc cref="ITipoServicioRepository"/>
public class TipoServicioRepository(AppDbContext context)
    : Repository<TipoServicio>(context), ITipoServicioRepository
{
    public async Task<(IEnumerable<TipoServicio> Items, int Total)> BuscarAsync(
        string? buscar, bool soloActivos, int pagina, int tamanoPagina, CancellationToken ct = default)
    {
        var query = Set.AsNoTracking();

        if (soloActivos)
            query = query.Where(s => s.Estado == EstadoServicio.Activo);

        query = query.BuscarPorPalabras(buscar,
            s => s.ServicioId, s => s.Nombre, s => s.Descripcion);

        return await query.OrderBy(s => s.Nombre).ToPagedListAsync(pagina, tamanoPagina, ct);
    }
}
