using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.Auth;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Services;

/// <summary>USU002, USU003 — autenticación con BCrypt + JWT.</summary>
public class AuthService(
    IUsuarioRepository usuarios,
    IAlmacenArchivos archivos,
    IJwtTokenGenerator jwt) : IAuthService
{
    /// <summary>Misma subcarpeta que usa <see cref="UsuarioService"/>.</summary>
    private const string SubcarpetaFotos = "usuarios";

    public async Task<Result<LoginResponseDto>> LoginAsync(
        LoginRequestDto dto, CancellationToken ct = default)
    {
        var usuario = await usuarios.GetByUsernameConRolAsync(dto.Username, ct);

        // Mensaje genérico a propósito: no revelamos si el usuario existe o no.
        const string credencialesInvalidas = "Usuario o contraseña incorrectos.";

        if (usuario is null)
            return Result<LoginResponseDto>.NoAutorizado(credencialesInvalidas);

        if (!BCrypt.Net.BCrypt.Verify(dto.Password, usuario.PasswordHash))
            return Result<LoginResponseDto>.NoAutorizado(credencialesInvalidas);

        // USU004: un usuario dado de baja no puede iniciar sesión.
        if (usuario.Estado == EstadoUsuario.Inactivo)
            return Result<LoginResponseDto>.NoAutorizado(
                "El usuario está inactivo. Contacte al administrador.");

        var (token, expiraEn) = jwt.Generar(usuario);

        return Result<LoginResponseDto>.Ok(new LoginResponseDto
        {
            Token = token,
            ExpiraEn = expiraEn,
            UsuarioId = usuario.UsuarioId,
            Username = usuario.Username,
            NombreCompleto = $"{usuario.Nombre} {usuario.Apellido}".Trim(),
            Rol = usuario.Rol.NombreRol,
            FotoUrl = usuario.NombreArchivoFoto is null
                ? null
                : archivos.RutaPublica(SubcarpetaFotos, usuario.NombreArchivoFoto)
        });
    }

    public async Task<Result<bool>> CambiarPasswordAsync(
        string usuarioId, CambiarPasswordDto dto, CancellationToken ct = default)
    {
        var usuario = await usuarios.FirstOrDefaultAsync(u => u.UsuarioId == usuarioId, ct);

        if (usuario is null)
            return Result<bool>.NoEncontrado($"No existe el usuario {usuarioId}.");

        if (!BCrypt.Net.BCrypt.Verify(dto.PasswordActual, usuario.PasswordHash))
            return Result<bool>.NoAutorizado("La contraseña actual es incorrecta.");

        if (BCrypt.Net.BCrypt.Verify(dto.PasswordNueva, usuario.PasswordHash))
            return Result<bool>.Fail("La nueva contraseña debe ser distinta de la actual.");

        usuario.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.PasswordNueva);
        await usuarios.SaveChangesAsync(ct);

        return Result<bool>.Ok(true, "Contraseña actualizada correctamente.");
    }
}
