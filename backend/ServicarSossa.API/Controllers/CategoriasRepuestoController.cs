using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServicarSossa.Application.DTOs.CategoriasRepuesto;
using ServicarSossa.Application.Interfaces;

namespace ServicarSossa.API.Controllers;

/// <summary>
/// Categorías de repuesto. El mecánico las consulta (para ver qué lleva cada
/// servicio en la orden); crearlas, renombrarlas y borrarlas es del Administrador.
/// </summary>
[Route("api/categorias-repuesto")]
[Authorize(Roles = "Administrador,Mecanico")]
public class CategoriasRepuestoController(ICategoriaRepuestoService service) : ApiControllerBase
{
    /// <summary>Todas las categorías, con cuántos repuestos y servicios las usan.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<CategoriaRepuestoResponseDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(CancellationToken ct)
        => Responder(await service.GetAllAsync(ct));

    [HttpPost]
    [Authorize(Roles = "Administrador")]
    [ProducesResponseType(typeof(CategoriaRepuestoResponseDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create([FromBody] CategoriaRepuestoRequestDto dto, CancellationToken ct)
    {
        var result = await service.CreateAsync(dto, UsuarioIdActual, ct);
        return ResponderCreado(result, nameof(GetAll), new { });
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Administrador")]
    [ProducesResponseType(typeof(CategoriaRepuestoResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Update(
        string id, [FromBody] CategoriaRepuestoRequestDto dto, CancellationToken ct)
        => Responder(await service.UpdateAsync(id, dto, UsuarioIdActual, ct));

    /// <summary>Sus repuestos quedan sin categoría y los servicios dejan de controlarla.</summary>
    [HttpDelete("{id}")]
    [Authorize(Roles = "Administrador")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(string id, CancellationToken ct)
    {
        var result = await service.DeleteAsync(id, UsuarioIdActual, ct);
        return result.Success ? Ok(new { mensaje = result.Message }) : Responder(result);
    }
}
