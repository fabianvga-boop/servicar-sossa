using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServicarSossa.Application.DTOs.Comunes;
using ServicarSossa.Application.DTOs.Facturas;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.API.Controllers;

/// <summary>
/// USU038 — facturación electrónica: el comprobante FISCAL ante el SIN, con su
/// CUF y su XML. Distinto de <see cref="ProformasController"/> (USU035), que
/// documenta el cobro del taller sin valor fiscal.
///
/// Con <c>Facturacion:Modo = INTERNAL</c> el módulo responde, pero la emisión
/// se rechaza con una explicación: el taller no tiene NIT habilitado y el cobro
/// se documenta con proformas.
/// </summary>
[Route("api/facturas")]
[Authorize(Roles = "Administrador")]
public class FacturasController(IFacturaService service) : ApiControllerBase
{
    /// <summary>
    /// Situación del módulo: si la emisión está habilitada y, si no, por qué.
    /// La interfaz lo consulta para saber si ofrecer el botón de facturar.
    /// </summary>
    [HttpGet("estado")]
    [ProducesResponseType(typeof(EstadoFacturacionDto), StatusCodes.Status200OK)]
    public IActionResult GetEstado() => Responder(service.GetEstadoFacturacion());

    /// <summary>Lista facturas filtrables por documento de origen, estado y periodo.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(ResultadoPaginadoDto<FacturaResponseDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? ordenId,
        [FromQuery] string? ventaId,
        [FromQuery] EstadoFactura? estado,
        [FromQuery] EstadoSiat? estadoSiat,
        [FromQuery] DateTime? desde,
        [FromQuery] DateTime? hasta,
        [FromQuery] int pagina = 1,
        [FromQuery] int tamanoPagina = 20,
        CancellationToken ct = default)
        => Responder(await service.GetAllAsync(
            ordenId, ventaId, estado, estadoSiat, desde, hasta, pagina, tamanoPagina, ct));

    /// <summary>Obtiene una factura por su código (FAC-000), con su situación fiscal.</summary>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(FacturaResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(string id, CancellationToken ct)
        => Responder(await service.GetByIdAsync(id, ct));

    /// <summary>
    /// Emite la factura fiscal de una orden de trabajo o de una venta de
    /// mostrador. Requiere la facturación electrónica habilitada.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(FacturaResponseDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Emitir(
        [FromBody] FacturaRequestDto dto, CancellationToken ct)
    {
        var result = await service.EmitirAsync(dto, UsuarioIdActual, ct);
        return ResponderCreado(result, nameof(GetById), new { id = result.Data?.FacturaId });
    }

    /// <summary>Anula la factura ante el SIN.</summary>
    [HttpPatch("{id}/anular")]
    [ProducesResponseType(typeof(FacturaResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Anular(
        string id, [FromQuery] string? motivo, CancellationToken ct)
        => Responder(await service.AnularAsync(id, motivo, UsuarioIdActual, ct));

    /// <summary>
    /// Descarga el XML del comprobante: el respaldo que el contribuyente debe
    /// archivar. Con <c>firmado=true</c> devuelve el que se envió al SIN.
    /// </summary>
    [HttpGet("{id}/xml")]
    [ProducesResponseType(typeof(FileResult), StatusCodes.Status200OK, "application/xml")]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetXml(
        string id, [FromQuery] bool firmado = false, CancellationToken ct = default)
    {
        var result = await service.GetXmlAsync(id, firmado, ct);

        if (!result.Success) return Responder(result);

        var sufijo = firmado ? "firmado" : "generado";
        return File(Encoding.UTF8.GetBytes(result.Data!), "application/xml", $"{id}-{sufijo}.xml");
    }
}
