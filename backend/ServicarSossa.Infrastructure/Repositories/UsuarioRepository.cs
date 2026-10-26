using Microsoft.EntityFrameworkCore;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Infrastructure.Data;
using ServicarSossa.Infrastructure.Extensions;

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

    public async Task<(IEnumerable<Usuario> Items, int Total)> GetAllConRolAsync(
        string? buscar, int pagina, int tamanoPagina, CancellationToken ct = default)
    {
        var query = Set.Include(u => u.Rol).AsNoTracking();

        query = query.BuscarPorPalabras(buscar,
            u => u.UsuarioId, u => u.Nombre, u => u.Apellido, u => u.Username, u => u.Email);

        return await query.OrderBy(u => u.UsuarioId).ToPagedListAsync(pagina, tamanoPagina, ct);
    }
}
