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
    /// USU030 — lista repuestos. Con <c>soloStockBajo=true</c> devuelve la alerta
    /// de reposición: los que llegaron o bajaron del stock mínimo.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(ResultadoPaginadoDto<RepuestoResponseDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? buscar,
        [FromQuery] string? proveedorId,
        [FromQuery] bool soloStockBajo = false,
        [FromQuery] int pagina = 1,
        [FromQuery] int tamanoPagina = 20,
        CancellationToken ct = default)
        => Responder(await service.GetAllAsync(buscar, proveedorId, soloStockBajo, pagina, tamanoPagina, ct));

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
    /// Actualiza los datos maestros del repuesto (nombre, precios, proveedor,
    /// stock mínimo). No modifica el stock actual: eso es USU027, en el ajuste
    /// de inventario. Sin historia numerada propia en la Épica 6.
    /// </summary>
    [HttpPut("{id}")]
    [Authorize(Roles = "Administrador")]
    [ProducesResponseType(typeof(RepuestoResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(
        string id, [FromBody] RepuestoUpdateDto dto, CancellationToken ct)
        => Responder(await service.UpdateAsync(id, dto, UsuarioIdActual, ct));

    /// <summary>
    /// USU027 — actualiza el stock. Ajuste manual de inventario con motivo
    /// (conteo físico, merma, rotura); el ingreso por compra es USU029.
    /// </summary>
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

    /// <summary>
    /// Procedencia del stock: cuántas unidades ingresaron por compras (con
    /// proveedor) y el historial de esas compras. Distingue el stock respaldado
    /// por compras del inicial/ajustes cargado sin proveedor.
    /// </summary>
    [HttpGet("{id}/procedencia")]
    [ProducesResponseType(typeof(ProcedenciaRepuestoDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Procedencia(string id, CancellationToken ct)
        => Responder(await service.GetProcedenciaAsync(id, ct));

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
