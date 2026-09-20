using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServicarSossa.Application.DTOs.Comunes;
using ServicarSossa.Application.DTOs.Proformas;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.API.Controllers;

/// <summary>
/// USU035 — proformas: el documento de cobro del taller, sin valor fiscal.
/// Es el flujo operativo de todos los días. La emisión de la factura fiscal
/// (USU038) vive en <see cref="FacturasController"/>.
///
/// Una proforma no se edita: si tiene un error se anula (siempre que no tenga
/// pagos) y se emite una nueva.
/// </summary>
[Route("api/proformas")]
[Authorize(Roles = "Administrador")]
public class ProformasController(IProformaService service) : ApiControllerBase
{
    /// <summary>Lista proformas filtrables por orden, cliente, estado y periodo.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(ResultadoPaginadoDto<ProformaResponseDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? ordenId,
        [FromQuery] string? clienteId,
        [FromQuery] EstadoProforma? estado,
        [FromQuery] DateTime? desde,
        [FromQuery] DateTime? hasta,
        [FromQuery] int pagina = 1,
        [FromQuery] int tamanoPagina = 20,
        CancellationToken ct = default)
        => Responder(await service.GetAllAsync(
            ordenId, clienteId, estado, desde, hasta, pagina, tamanoPagina, ct));

    /// <summary>Obtiene una proforma por su código (PRF-000), con su saldo pendiente.</summary>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(ProformaResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(string id, CancellationToken ct)
        => Responder(await service.GetByIdAsync(id, ct));

    /// <summary>Emite la proforma de una orden Finalizada o Cerrada.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(ProformaResponseDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(
        [FromBody] ProformaRequestDto dto, CancellationToken ct)
    {
        var result = await service.CreateAsync(dto, UsuarioIdActual, ct);
        return ResponderCreado(result, nameof(GetById), new { id = result.Data?.ProformaId });
    }

    /// <summary>Anula la proforma. Solo procede si no tiene pagos registrados.</summary>
    [HttpPatch("{id}/anular")]
    [ProducesResponseType(typeof(ProformaResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Anular(string id, CancellationToken ct)
        => Responder(await service.AnularAsync(id, UsuarioIdActual, ct));

    /// <summary>
    /// Descarga la proforma como comprobante PDF, con el detalle de servicios y
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
