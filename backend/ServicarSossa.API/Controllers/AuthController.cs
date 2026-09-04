using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServicarSossa.Application.DTOs.Auth;
using ServicarSossa.Application.DTOs.Comunes;
using ServicarSossa.Application.DTOs.Usuarios;
using ServicarSossa.Application.Interfaces;

namespace ServicarSossa.API.Controllers;

/// <summary>USU002, USU003 — inicio de sesión, contraseña y perfil propio.</summary>
public class AuthController(
    IAuthService service,
    IUsuarioService usuarios) : ApiControllerBase
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

    /// <summary>Devuelve los datos del usuario autenticado, incluida su foto.</summary>
    [HttpGet("perfil")]
    [Authorize]
    [ProducesResponseType(typeof(UsuarioResponseDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Perfil(CancellationToken ct)
        => Responder(await usuarios.GetByIdAsync(UsuarioIdActual, ct));

    // ------------------------------------------------- Foto de perfil

    /// <summary>
    /// Sube o reemplaza la foto del usuario autenticado (JPG, PNG o WEBP,
    /// hasta 8 MB). Sin id en la ruta: cada quien solo cambia la suya.
    /// </summary>
    [HttpPost("perfil/foto")]
    [Authorize]
    [ProducesResponseType(typeof(UsuarioResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> SubirFoto(IFormFile foto, CancellationToken ct)
    {
        using var buffer = new MemoryStream();
        await foto.CopyToAsync(buffer, ct);

        return Responder(await usuarios.SubirFotoAsync(UsuarioIdActual, new SubirFotoDto
        {
            Contenido = buffer.ToArray(),
            NombreOriginal = foto.FileName
        }, ct));
    }

    /// <summary>Quita la foto del usuario autenticado; vuelven las iniciales.</summary>
    [HttpDelete("perfil/foto")]
    [Authorize]
    [ProducesResponseType(typeof(UsuarioResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> EliminarFoto(CancellationToken ct)
        => Responder(await usuarios.EliminarFotoAsync(UsuarioIdActual, ct));
}
