using Microsoft.EntityFrameworkCore;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;
using ServicarSossa.Infrastructure.Data;

namespace ServicarSossa.Infrastructure.Repositories;

public class AuditoriaRepository(AppDbContext context)
    : Repository<Auditoria>(context), IAuditoriaRepository
{
    public async Task<IEnumerable<Auditoria>> BuscarAsync(
        string? entidad, string? entidadId, string? usuarioId, AccionAuditoria? accion,
        DateTime? desde, DateTime? hasta, CancellationToken ct = default)
    {
        var query = Set.Include(a => a.Usuario).AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(entidad))
            query = query.Where(a => a.Entidad == entidad);

        if (!string.IsNullOrWhiteSpace(entidadId))
            query = query.Where(a => a.EntidadId == entidadId);

        if (!string.IsNullOrWhiteSpace(usuarioId))
            query = query.Where(a => a.UsuarioId == usuarioId);

        if (accion.HasValue)
            query = query.Where(a => a.Accion == accion.Value);

        if (desde.HasValue)
            query = query.Where(a => a.Fecha >= desde.Value);

        if (hasta.HasValue)
        {
            // El filtro "hasta" incluye todo el día indicado.
            var limite = hasta.Value.Date.AddDays(1);
            query = query.Where(a => a.Fecha < limite);
        }

        return await query.OrderByDescending(a => a.Fecha).Take(500).ToListAsync(ct);
    }
}
