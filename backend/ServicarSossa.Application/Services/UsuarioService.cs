using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.Usuarios;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Services;

/// <summary>USU001, USU003, USU004, USU005 — gestión de usuarios.</summary>
public class UsuarioService(
    IUsuarioRepository usuarios,
    IRepository<Rol> roles,
    IGeneradorId generadorId,
    IAuditor auditor) : IUsuarioService
{
    public async Task<Result<IEnumerable<UsuarioResponseDto>>> GetAllAsync(
        string? buscar, CancellationToken ct = default)
    {
        var lista = await usuarios.GetAllConRolAsync(buscar, ct);
        return Result<IEnumerable<UsuarioResponseDto>>.Ok(lista.Select(Mapear));
    }

    public async Task<Result<UsuarioResponseDto>> GetByIdAsync(
        string id, CancellationToken ct = default)
    {
        var usuario = await usuarios.GetByIdConRolAsync(id, ct);

        return usuario is null
            ? Result<UsuarioResponseDto>.NoEncontrado($"No existe el usuario {id}.")
            : Result<UsuarioResponseDto>.Ok(Mapear(usuario));
    }

    public async Task<Result<UsuarioResponseDto>> CreateAsync(
        UsuarioRequestDto dto, string actorId, CancellationToken ct = default)
    {
        var email = dto.Email.Trim().ToLowerInvariant();
        var username = dto.Username.Trim();

        if (await usuarios.ExistsAsync(u => u.Username == username, ct))
            return Result<UsuarioResponseDto>.Conflicto(
                $"El nombre de usuario '{username}' ya está registrado.");

        if (await usuarios.ExistsAsync(u => u.Email == email, ct))
            return Result<UsuarioResponseDto>.Conflicto(
                $"El email '{email}' ya está registrado.");

        if (!await roles.ExistsAsync(r => r.RolId == dto.RolId, ct))
            return Result<UsuarioResponseDto>.Fail($"El rol {dto.RolId} no existe.");

        var usuario = new Usuario
        {
            UsuarioId = await generadorId.SiguienteAsync<Usuario>("USU", ct),
            Nombre = dto.Nombre.Trim(),
            Apellido = dto.Apellido.Trim(),
            Email = email,
            Username = username,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
            RolId = dto.RolId,
            Telefono = string.IsNullOrWhiteSpace(dto.Telefono) ? null : dto.Telefono.Trim(),
            Estado = EstadoUsuario.Activo,
            FechaRegistro = DateTime.UtcNow
        };

        await usuarios.AddAsync(usuario, ct);

        await auditor.RegistrarAsync(
            actorId, AccionAuditoria.Crear, "Usuario", usuario.UsuarioId,
            $"Creó el usuario '{usuario.Nombre} {usuario.Apellido}' ({usuario.Username}).", ct);

        await usuarios.SaveChangesAsync(ct);

        // Relee con el rol incluido para devolver NombreRol en la respuesta.
        var creado = await usuarios.GetByIdConRolAsync(usuario.UsuarioId, ct);
        return Result<UsuarioResponseDto>.Ok(Mapear(creado!), "Usuario creado correctamente.");
    }

    public async Task<Result<UsuarioResponseDto>> UpdateAsync(
        string id, UsuarioUpdateDto dto, string actorId, CancellationToken ct = default)
    {
        var usuario = await usuarios.FirstOrDefaultAsync(u => u.UsuarioId == id, ct);

        if (usuario is null)
            return Result<UsuarioResponseDto>.NoEncontrado($"No existe el usuario {id}.");

        var email = dto.Email.Trim().ToLowerInvariant();

        if (await usuarios.ExistsAsync(u => u.Email == email && u.UsuarioId != id, ct))
            return Result<UsuarioResponseDto>.Conflicto(
                $"El email '{email}' ya está registrado por otro usuario.");

        if (!await roles.ExistsAsync(r => r.RolId == dto.RolId, ct))
            return Result<UsuarioResponseDto>.Fail($"El rol {dto.RolId} no existe.");

        usuario.Nombre = dto.Nombre.Trim();
        usuario.Apellido = dto.Apellido.Trim();
        usuario.Email = email;
        usuario.RolId = dto.RolId;                                  // USU005
        usuario.Telefono = string.IsNullOrWhiteSpace(dto.Telefono) ? null : dto.Telefono.Trim();

        await auditor.RegistrarAsync(
            actorId, AccionAuditoria.Editar, "Usuario", id,
            $"Editó el usuario '{usuario.Nombre} {usuario.Apellido}'.", ct);

        await usuarios.SaveChangesAsync(ct);

        var actualizado = await usuarios.GetByIdConRolAsync(id, ct);
        return Result<UsuarioResponseDto>.Ok(Mapear(actualizado!), "Usuario actualizado correctamente.");
    }

    public async Task<Result<UsuarioResponseDto>> CambiarEstadoAsync(
        string id, CambiarEstadoUsuarioDto dto, string actorId, CancellationToken ct = default)
    {
        var usuario = await usuarios.FirstOrDefaultAsync(u => u.UsuarioId == id, ct);

        if (usuario is null)
            return Result<UsuarioResponseDto>.NoEncontrado($"No existe el usuario {id}.");

        if (usuario.Estado == dto.Estado)
            return Result<UsuarioResponseDto>.Fail($"El usuario ya está {dto.Estado}.");

        usuario.Estado = dto.Estado;

        await auditor.RegistrarAsync(
            actorId, AccionAuditoria.CambiarEstado, "Usuario", id,
            $"Marcó al usuario '{usuario.Nombre} {usuario.Apellido}' como {dto.Estado}.", ct);

        await usuarios.SaveChangesAsync(ct);

        var actualizado = await usuarios.GetByIdConRolAsync(id, ct);
        return Result<UsuarioResponseDto>.Ok(
            Mapear(actualizado!), $"Usuario marcado como {dto.Estado}.");
    }

    private static UsuarioResponseDto Mapear(Usuario u) => new()
    {
        UsuarioId = u.UsuarioId,
        Nombre = u.Nombre,
        Apellido = u.Apellido,
        Email = u.Email,
        Username = u.Username,
        RolId = u.RolId,
        NombreRol = u.Rol?.NombreRol ?? string.Empty,
        Telefono = u.Telefono,
        Estado = u.Estado,
        FechaRegistro = u.FechaRegistro
    };
}
