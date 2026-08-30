using Microsoft.EntityFrameworkCore;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Infrastructure.Data;

namespace ServicarSossa.Infrastructure.Repositories;

/// <inheritdoc cref="IUsuarioRepository"/>
public class UsuarioRepository(AppDbContext context)
    : Repository<Usuario>(context), IUsuarioRepository
{
    public async Task<Usuario?> GetByUsernameConRolAsync(
        string username, CancellationToken ct = default)
        => await Set.Include(u => u.Rol)
                    .AsNoTracking()
                    .FirstOrDefaultAsync(u => u.Username == username, ct);

    public async Task<Usuario?> GetByIdConRolAsync(
        string usuarioId, CancellationToken ct = default)
        => await Set.Include(u => u.Rol)
                    .AsNoTracking()
                    .FirstOrDefaultAsync(u => u.UsuarioId == usuarioId, ct);

    public async Task<IEnumerable<Usuario>> GetAllConRolAsync(
        string? buscar, CancellationToken ct = default)
    {
        var query = Set.Include(u => u.Rol).AsNoTracking();

        if (!string.IsNullOrWhiteSpace(buscar))
        {
            var termino = $"%{buscar.Trim()}%";
            query = query.Where(u =>
                EF.Functions.ILike(u.Nombre, termino) ||
                EF.Functions.ILike(u.Apellido, termino) ||
                EF.Functions.ILike(u.Username, termino) ||
                EF.Functions.ILike(u.Email, termino));
        }

        return await query.OrderBy(u => u.UsuarioId).ToListAsync(ct);
    }
}
