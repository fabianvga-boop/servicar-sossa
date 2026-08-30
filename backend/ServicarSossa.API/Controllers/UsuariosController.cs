using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServicarSossa.Application.DTOs.Usuarios;
using ServicarSossa.Application.Interfaces;

namespace ServicarSossa.API.Controllers;

/// <summary>
/// USU001, USU003, USU004, USU005 — gestión de usuarios.
/// Todo el módulo es exclusivo del rol Administrador.
/// </summary>
[Authorize(Roles = "Administrador")]
public class UsuariosController(IUsuarioService service) : ApiControllerBase
{
    /// <summary>Lista usuarios, opcionalmente filtrados por nombre, usuario o email.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<UsuarioResponseDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll([FromQuery] string? buscar, CancellationToken ct)
        => Responder(await service.GetAllAsync(buscar, ct));

    /// <summary>Obtiene un usuario por su código (USU-000).</summary>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(UsuarioResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(string id, CancellationToken ct)
        => Responder(await service.GetByIdAsync(id, ct));

    /// <summary>USU001 — registra un nuevo usuario.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(UsuarioResponseDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(
        [FromBody] UsuarioRequestDto dto, CancellationToken ct)
    {
        var result = await service.CreateAsync(dto, UsuarioIdActual, ct);
        return ResponderCreado(result, nameof(GetById), new { id = result.Data?.UsuarioId });
    }

    /// <summary>USU003, USU005 — actualiza datos y rol del usuario.</summary>
    [HttpPut("{id}")]
    [ProducesResponseType(typeof(UsuarioResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(
        string id, [FromBody] UsuarioUpdateDto dto, CancellationToken ct)
        => Responder(await service.UpdateAsync(id, dto, UsuarioIdActual, ct));

    /// <summary>USU004 — activa o desactiva el usuario (baja lógica).</summary>
    [HttpPatch("{id}/estado")]
    [ProducesResponseType(typeof(UsuarioResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CambiarEstado(
        string id, [FromBody] CambiarEstadoUsuarioDto dto, CancellationToken ct)
        => Responder(await service.CambiarEstadoAsync(id, dto, UsuarioIdActual, ct));
}
