using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServicarSossa.Application.DTOs.Comisiones;
using ServicarSossa.Application.DTOs.Comunes;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.API.Controllers;

/// <summary>
/// USU031-USU034 — comisiones de mecánicos.
/// Las comisiones se generan solas al cerrar una orden de trabajo; aquí se
/// configuran los porcentajes, se consultan y se liquidan.
/// </summary>
[Authorize(Roles = "Administrador")]
public class ComisionesController(IComisionService service) : ApiControllerBase
{
    // ============================================================ CONFIGURACIÓN

    /// <summary>USU031 — porcentajes de comisión configurados por mecánico.</summary>
    [HttpGet("config")]
    [ProducesResponseType(typeof(IEnumerable<ComisionConfigResponseDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetConfiguraciones(CancellationToken ct)
        => Responder(await service.GetConfiguracionesAsync(ct));

    /// <summary>USU031 — porcentaje configurado para un mecánico puntual.</summary>
    [HttpGet("config/{mecanicoId}")]
    [ProducesResponseType(typeof(ComisionConfigResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetConfiguracion(string mecanicoId, CancellationToken ct)
        => Responder(await service.GetConfiguracionAsync(mecanicoId, ct));

    /// <summary>
    /// USU031 — fija el porcentaje de comisión del mecánico. Si ya tenía uno lo
    /// reemplaza. Solo afecta a las órdenes que se cierren de aquí en adelante.
    /// </summary>
    [HttpPut("config/{mecanicoId}")]
    [ProducesResponseType(typeof(ComisionConfigResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> EstablecerConfiguracion(
        string mecanicoId, [FromBody] ComisionConfigRequestDto dto, CancellationToken ct)
        => Responder(await service.EstablecerConfiguracionAsync(mecanicoId, dto, UsuarioIdActual, ct));

    // ================================================================= CONSULTA

    /// <summary>
    /// USU032 — comisiones filtrables por mecánico, orden, estado y periodo.
    /// Ojo: la historia está escrita para el Mecánico ("consultar mis comisiones"),
    /// pero el controlador completo exige rol Administrador; ver Sprint Review.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(ResultadoPaginadoDto<ComisionResponseDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? mecanicoId,
        [FromQuery] string? ordenId,
        [FromQuery] EstadoPago? estadoPago,
        [FromQuery] DateTime? desde,
        [FromQuery] DateTime? hasta,
        [FromQuery] int pagina = 1,
        [FromQuery] int tamanoPagina = 20,
        CancellationToken ct = default)
        => Responder(await service.GetAllAsync(
            mecanicoId, ordenId, estadoPago, desde, hasta, pagina, tamanoPagina, ct));

    /// <summary>
    /// USU034 — totales pendientes y pagados por mecánico en el periodo: es el
    /// reporte de comisiones. El cálculo automático (USU033) no vive aquí, sino
    /// en <c>OrdenService.CerrarOrdenAsync</c>, al cerrar la orden.
    /// </summary>
    [HttpGet("resumen")]
    [ProducesResponseType(typeof(IEnumerable<ResumenComisionesDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetResumen(
        [FromQuery] DateTime? desde, [FromQuery] DateTime? hasta, CancellationToken ct = default)
        => Responder(await service.GetResumenAsync(desde, hasta, ct));

    /// <summary>Obtiene una comisión por su código (COM-000).</summary>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(ComisionResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(string id, CancellationToken ct)
        => Responder(await service.GetByIdAsync(id, ct));

    // ===================================================================== PAGO

    /// <summary>
    /// Marca la comisión como pagada. La operación es irreversible.
    /// Sin historia numerada propia: la liquidación se añadió más allá del
    /// backlog de la Épica 7, que solo preveía reportarlas (USU034).
    /// </summary>
    [HttpPatch("{id}/pagar")]
    [ProducesResponseType(typeof(ComisionResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Pagar(string id, CancellationToken ct)
        => Responder(await service.PagarAsync(id, UsuarioIdActual, ct));

    /// <summary>
    /// Liquida varias comisiones de una vez (planilla del periodo).
    /// Sin historia numerada propia, igual que el pago individual.
    /// </summary>
    [HttpPost("pagar-lote")]
    [ProducesResponseType(typeof(LiquidacionResultadoDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> PagarLote(
        [FromBody] PagarComisionesLoteDto dto, CancellationToken ct)
        => Responder(await service.PagarLoteAsync(dto, UsuarioIdActual, ct));
}
