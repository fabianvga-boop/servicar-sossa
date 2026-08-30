using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServicarSossa.Application.DTOs.Proveedores;
using ServicarSossa.Application.Interfaces;

namespace ServicarSossa.API.Controllers;

/// <summary>USU028 — gestión de proveedores de repuestos.</summary>
[Authorize(Roles = "Administrador")]
public class ProveedoresController(IProveedorService service) : ApiControllerBase
{
    /// <summary>Lista proveedores, opcionalmente filtrados por nombre o contacto.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<ProveedorResponseDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll([FromQuery] string? buscar, CancellationToken ct)
        => Responder(await service.GetAllAsync(buscar, ct));

    /// <summary>Obtiene un proveedor por su código (PRO-000).</summary>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(ProveedorResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(string id, CancellationToken ct)
        => Responder(await service.GetByIdAsync(id, ct));

    /// <summary>USU028 — registra un nuevo proveedor.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(ProveedorResponseDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(
        [FromBody] ProveedorRequestDto dto, CancellationToken ct)
    {
        var result = await service.CreateAsync(dto, UsuarioIdActual, ct);
        return ResponderCreado(result, nameof(GetById), new { id = result.Data?.ProveedorId });
    }

    /// <summary>USU028 — actualiza los datos del proveedor.</summary>
    [HttpPut("{id}")]
    [ProducesResponseType(typeof(ProveedorResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(
        string id, [FromBody] ProveedorRequestDto dto, CancellationToken ct)
        => Responder(await service.UpdateAsync(id, dto, UsuarioIdActual, ct));

    /// <summary>Elimina el proveedor, solo si no tiene repuestos ni compras asociadas.</summary>
    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(string id, CancellationToken ct)
    {
        var result = await service.DeleteAsync(id, UsuarioIdActual, ct);
        return result.Success ? Ok(new { mensaje = result.Message }) : Responder(result);
    }
}
