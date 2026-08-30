using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServicarSossa.Application.DTOs.Comunes;
using ServicarSossa.Application.DTOs.Repuestos;
using ServicarSossa.Application.Interfaces;

namespace ServicarSossa.API.Controllers;

/// <summary>
/// USU026, USU027, USU030 — inventario de repuestos. El mecánico consulta
/// disponibilidad; el mantenimiento del inventario es del Administrador.
/// </summary>
[Authorize(Roles = "Administrador,Mecanico")]
public class RepuestosController(IRepuestoService service) : ApiControllerBase
{
    /// <summary>
    /// Lista repuestos. Con <c>soloStockBajo=true</c> devuelve la alerta de
    /// reposición (USU030): los que llegaron o bajaron del stock mínimo.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<RepuestoResponseDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? buscar,
        [FromQuery] string? proveedorId,
        [FromQuery] bool soloStockBajo = false,
        CancellationToken ct = default)
        => Responder(await service.GetAllAsync(buscar, proveedorId, soloStockBajo, ct));

    /// <summary>Obtiene un repuesto por su código (REP-000).</summary>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(RepuestoResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(string id, CancellationToken ct)
        => Responder(await service.GetByIdAsync(id, ct));

    /// <summary>USU026 — registra un repuesto con su stock inicial.</summary>
    [HttpPost]
    [Authorize(Roles = "Administrador")]
    [ProducesResponseType(typeof(RepuestoResponseDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(
        [FromBody] RepuestoRequestDto dto, CancellationToken ct)
    {
        var result = await service.CreateAsync(dto, UsuarioIdActual, ct);
        return ResponderCreado(result, nameof(GetById), new { id = result.Data?.RepuestoId });
    }

    /// <summary>
    /// USU027 — actualiza datos del repuesto. No modifica el stock actual:
    /// para eso está el ajuste de inventario.
    /// </summary>
    [HttpPut("{id}")]
    [Authorize(Roles = "Administrador")]
    [ProducesResponseType(typeof(RepuestoResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(
        string id, [FromBody] RepuestoUpdateDto dto, CancellationToken ct)
        => Responder(await service.UpdateAsync(id, dto, UsuarioIdActual, ct));

    /// <summary>Ajuste manual de inventario (conteo físico, merma, rotura).</summary>
    [HttpPatch("{id}/stock")]
    [Authorize(Roles = "Administrador")]
    [ProducesResponseType(typeof(RepuestoResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AjustarStock(
        string id, [FromBody] AjustarStockDto dto, CancellationToken ct)
        => Responder(await service.AjustarStockAsync(id, dto, UsuarioIdActual, ct));

    /// <summary>Elimina el repuesto, solo si no tiene compras, órdenes ni ventas.</summary>
    [HttpDelete("{id}")]
    [Authorize(Roles = "Administrador")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(string id, CancellationToken ct)
    {
        var result = await service.DeleteAsync(id, UsuarioIdActual, ct);
        return result.Success ? Ok(new { mensaje = result.Message }) : Responder(result);
    }

    // ------------------------------------------------- Foto del producto

    /// <summary>
    /// Sube o reemplaza la foto del producto (JPG, PNG o WEBP, hasta 8 MB).
    /// Sirve para reconocerlo de un vistazo al venderlo en mostrador.
    /// </summary>
    [HttpPost("{id}/foto")]
    [Authorize(Roles = "Administrador")]
    [ProducesResponseType(typeof(RepuestoResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SubirFoto(string id, IFormFile foto, CancellationToken ct)
    {
        using var buffer = new MemoryStream();
        await foto.CopyToAsync(buffer, ct);

        return Responder(await service.SubirFotoAsync(id, new SubirFotoDto
        {
            Contenido = buffer.ToArray(),
            NombreOriginal = foto.FileName
        }, ct));
    }

    /// <summary>Quita la foto del producto.</summary>
    [HttpDelete("{id}/foto")]
    [Authorize(Roles = "Administrador")]
    [ProducesResponseType(typeof(RepuestoResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> EliminarFoto(string id, CancellationToken ct)
        => Responder(await service.EliminarFotoAsync(id, ct));
}
