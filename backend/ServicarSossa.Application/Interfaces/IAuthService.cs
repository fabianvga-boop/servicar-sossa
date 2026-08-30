using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.Auth;

namespace ServicarSossa.Application.Interfaces;

/// <summary>USU002, USU003 — autenticación y gestión de credenciales.</summary>
public interface IAuthService
{
    Task<Result<LoginResponseDto>> LoginAsync(LoginRequestDto dto, CancellationToken ct = default);

    Task<Result<bool>> CambiarPasswordAsync(
        string usuarioId, CambiarPasswordDto dto, CancellationToken ct = default);
}
