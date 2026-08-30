using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServicarSossa.Application.DTOs.Auth;
using ServicarSossa.Application.Interfaces;

namespace ServicarSossa.API.Controllers;

/// <summary>USU002, USU003 — inicio de sesión y cambio de contraseña.</summary>
public class AuthController(IAuthService service) : ApiControllerBase
{
    /// <summary>USU002 — autentica al usuario y devuelve un JWT.</summary>
    [HttpPost("login")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(LoginResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Login(
        [FromBody] LoginRequestDto dto, CancellationToken ct)
        => Responder(await service.LoginAsync(dto, ct));

    /// <summary>USU003 — el usuario autenticado cambia su propia contraseña.</summary>
    [HttpPost("cambiar-password")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> CambiarPassword(
        [FromBody] CambiarPasswordDto dto, CancellationToken ct)
    {
        var result = await service.CambiarPasswordAsync(UsuarioIdActual, dto, ct);
        return result.Success ? Ok(new { mensaje = result.Message }) : Responder(result);
    }

    /// <summary>Devuelve los datos del usuario autenticado a partir del token.</summary>
    [HttpGet("perfil")]
    [Authorize]
    public IActionResult Perfil() => Ok(new
    {
        usuarioId = UsuarioIdActual,
        username = User.Identity?.Name,
        rol = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value
    });
}
