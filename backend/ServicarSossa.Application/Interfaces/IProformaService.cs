using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.Comprobantes;
using ServicarSossa.Application.DTOs.Comunes;
using ServicarSossa.Application.DTOs.Proformas;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Interfaces;

/// <summary>
/// USU038 — emisión y anulación de proformas: el documento de cobro del taller,
/// sin valor fiscal. Es el flujo operativo de todos los días.
/// </summary>
public interface IProformaService
{
    Task<Result<ResultadoPaginadoDto<ProformaResponseDto>>> GetAllAsync(
        string? ordenId, string? clienteId, EstadoProforma? estado,
        DateTime? desde, DateTime? hasta, int pagina, int tamanoPagina, CancellationToken ct = default);

    Task<Result<ProformaResponseDto>> GetByIdAsync(string id, CancellationToken ct = default);

    /// <summary>Emite la proforma de una orden ya finalizada o cerrada.</summary>
    Task<Result<ProformaResponseDto>> CreateAsync(
        ProformaRequestDto dto, string usuarioId, CancellationToken ct = default);

    /// <summary>Anula la proforma. Solo procede si no tiene pagos registrados.</summary>
    Task<Result<ProformaResponseDto>> AnularAsync(string id, string usuarioId, CancellationToken ct = default);

    /// <summary>Comprobante imprimible de la proforma, con el detalle de la orden.</summary>
    Task<Result<ArchivoComprobanteDto>> GetPdfAsync(string id, CancellationToken ct = default);
}
