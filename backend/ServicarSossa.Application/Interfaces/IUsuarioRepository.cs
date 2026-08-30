using ServicarSossa.Domain.Entities;

namespace ServicarSossa.Application.Interfaces;

/// <summary>
/// Repositorio de usuarios con las consultas que el genérico no cubre:
/// todas incluyen el <see cref="Rol"/> porque el JWT y las respuestas lo necesitan.
/// </summary>
public interface IUsuarioRepository : IRepository<Usuario>
{
    Task<Usuario?> GetByUsernameConRolAsync(string username, CancellationToken ct = default);
    Task<Usuario?> GetByIdConRolAsync(string usuarioId, CancellationToken ct = default);
    Task<IEnumerable<Usuario>> GetAllConRolAsync(string? buscar, CancellationToken ct = default);
}
