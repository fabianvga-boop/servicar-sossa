using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServicarSossa.Application.DTOs.Facturas;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.API.Controllers;

/// <summary>
/// USU038 — facturación (documento "Proforma" del taller: el sistema no emite
/// comprobantes fiscales por SIAT). Una factura no se edita: si tiene un error
/// se anula (siempre que no tenga pagos) y se emite una nueva.
/// </summary>
[Authorize(Roles = "Administrador")]
public class FacturasController(IFacturaService service) : ApiControllerBase
{
    /// <summary>Lista facturas filtrables por orden, cliente, estado y periodo.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<FacturaResponseDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? ordenId,
        [FromQuery] string? clienteId,
        [FromQuery] EstadoFactura? estado,
        [FromQuery] DateTime? desde,
        [FromQuery] DateTime? hasta,
        CancellationToken ct = default)
        => Responder(await service.GetAllAsync(ordenId, clienteId, estado, desde, hasta, ct));

    /// <summary>Obtiene una factura por su código (FAC-000), con su saldo pendiente.</summary>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(FacturaResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(string id, CancellationToken ct)
        => Responder(await service.GetByIdAsync(id, ct));

    /// <summary>USU038 — emite la factura de una orden Finalizada o Cerrada.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(FacturaResponseDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(
        [FromBody] FacturaRequestDto dto, CancellationToken ct)
    {
        var result = await service.CreateAsync(dto, ct);
        return ResponderCreado(result, nameof(GetById), new { id = result.Data?.FacturaId });
    }

    /// <summary>Anula la factura. Solo procede si no tiene pagos registrados.</summary>
    [HttpPatch("{id}/anular")]
    [ProducesResponseType(typeof(FacturaResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Anular(string id, CancellationToken ct)
        => Responder(await service.AnularAsync(id, UsuarioIdActual, ct));

    /// <summary>
    /// Descarga la factura como comprobante PDF, con el detalle de servicios y
    /// repuestos de la orden. Se genera en el momento; no se almacena.
    /// </summary>
    // Sin [Produces("application/pdf")]: restringir el tipo de salida hace que
    // la respuesta de error (JSON) no pueda negociarse y el cliente reciba un
    // 406 en vez del 404 real.
    [HttpGet("{id}/pdf")]
    [ProducesResponseType(typeof(FileResult), StatusCodes.Status200OK, "application/pdf")]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPdf(string id, CancellationToken ct)
    {
        var result = await service.GetPdfAsync(id, ct);

        if (!result.Success) return Responder(result);

        var archivo = result.Data!;
        return File(archivo.Contenido, archivo.TipoContenido, archivo.NombreArchivo);
    }
}
