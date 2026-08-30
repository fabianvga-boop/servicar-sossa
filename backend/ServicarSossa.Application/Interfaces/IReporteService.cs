using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.Reportes;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Interfaces;

/// <summary>USU017-USU020 — generación y exportación de reportes.</summary>
public interface IReporteService
{
    /// <summary>Genera el reporte en forma tabular (para mostrar en pantalla).</summary>
    Task<Result<ReporteDto>> GenerarAsync(
        TipoReporte tipo, DateOnly desde, DateOnly hasta,
        string usuarioId, CancellationToken ct = default);

    /// <summary>
    /// Genera el reporte y lo devuelve como archivo descargable, registrando
    /// la emisión en la bitácora <c>reportes_generados</c>.
    /// </summary>
    Task<Result<ArchivoReporteDto>> ExportarAsync(
        TipoReporte tipo, DateOnly desde, DateOnly hasta,
        FormatoReporte formato, string usuarioId, CancellationToken ct = default);

    /// <summary>Historial de reportes emitidos.</summary>
    Task<Result<IEnumerable<ReporteGeneradoResponseDto>>> GetBitacoraAsync(
        string? tipoReporte, CancellationToken ct = default);
}

/// <summary>
/// Convierte un <see cref="ReporteDto"/> al formato de archivo pedido.
/// La implementación vive en Infrastructure porque depende de QuestPDF y ClosedXML.
/// </summary>
public interface IExportadorReportes
{
    ArchivoReporteDto Exportar(ReporteDto reporte, FormatoReporte formato);
}
