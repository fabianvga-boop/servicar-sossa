using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServicarSossa.Application.DTOs.Clientes;
using ServicarSossa.Application.Interfaces;

namespace ServicarSossa.API.Controllers;

/// <summary>USU006, USU007, USU008 — gestión de clientes.</summary>
[Authorize(Roles = "Administrador")]
public class ClientesController(IClienteService service) : ApiControllerBase
{
    /// <summary>Lista clientes, opcionalmente filtrados por nombre, razón social o CI/NIT.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<ClienteResponseDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll([FromQuery] string? buscar, CancellationToken ct)
        => Responder(await service.GetAllAsync(buscar, ct));

    /// <summary>Obtiene un cliente por su código (CLI-000).</summary>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(ClienteResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(string id, CancellationToken ct)
        => Responder(await service.GetByIdAsync(id, ct));

    /// <summary>USU006 — registra un nuevo cliente.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(ClienteResponseDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(
        [FromBody] ClienteRequestDto dto, CancellationToken ct)
    {
        var result = await service.CreateAsync(dto, UsuarioIdActual, ct);
        return ResponderCreado(result, nameof(GetById), new { id = result.Data?.ClienteId });
    }

    /// <summary>USU007 — actualiza los datos del cliente.</summary>
    [HttpPut("{id}")]
    [ProducesResponseType(typeof(ClienteResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(
        string id, [FromBody] ClienteUpdateDto dto, CancellationToken ct)
        => Responder(await service.UpdateAsync(id, dto, UsuarioIdActual, ct));

    /// <summary>USU008 — activa o desactiva el cliente (baja lógica).</summary>
    [HttpPatch("{id}/estado")]
    [ProducesResponseType(typeof(ClienteResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CambiarEstado(
        string id, [FromBody] CambiarEstadoClienteDto dto, CancellationToken ct)
        => Responder(await service.CambiarEstadoAsync(id, dto, UsuarioIdActual, ct));
}
