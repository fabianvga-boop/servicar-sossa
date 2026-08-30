using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServicarSossa.Application.DTOs.Reportes;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.API.Controllers;

/// <summary>
/// USU017-USU020 — reportes de ventas, comisiones, inventario y órdenes.
/// Cada reporte se puede ver en pantalla (JSON) o descargar en PDF, Excel o CSV.
/// </summary>
[Authorize(Roles = "Administrador")]
public class ReportesController(IReporteService service) : ApiControllerBase
{
    /// <summary>
    /// Genera el reporte en forma tabular para mostrarlo en pantalla.
    /// Para el reporte de Inventario el periodo no aplica: siempre refleja el
    /// estado actual del stock, porque el esquema no guarda histórico de movimientos.
    /// </summary>
    [HttpGet("{tipo}")]
    [ProducesResponseType(typeof(ReporteDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Generar(
        TipoReporte tipo,
        [FromQuery] DateOnly desde,
        [FromQuery] DateOnly hasta,
        CancellationToken ct = default)
        => Responder(await service.GenerarAsync(tipo, desde, hasta, UsuarioIdActual, ct));

    /// <summary>
    /// Descarga el reporte como archivo y lo registra en la bitácora
    /// <c>reportes_generados</c>.
    /// </summary>
    [HttpGet("{tipo}/exportar")]
    [Produces("application/pdf",
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              "text/csv")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Exportar(
        TipoReporte tipo,
        [FromQuery] DateOnly desde,
        [FromQuery] DateOnly hasta,
        [FromQuery] FormatoReporte formato = FormatoReporte.Pdf,
        CancellationToken ct = default)
    {
        var result = await service.ExportarAsync(tipo, desde, hasta, formato, UsuarioIdActual, ct);

        if (!result.Success) return Responder(result);

        var archivo = result.Data!;
        return File(archivo.Contenido, archivo.TipoContenido, archivo.NombreArchivo);
    }

    /// <summary>Historial de reportes emitidos (últimos 200).</summary>
    [HttpGet("bitacora")]
    [ProducesResponseType(typeof(IEnumerable<ReporteGeneradoResponseDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetBitacora(
        [FromQuery] string? tipoReporte, CancellationToken ct = default)
        => Responder(await service.GetBitacoraAsync(tipoReporte, ct));
}
