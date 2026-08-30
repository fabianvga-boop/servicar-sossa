using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.Comprobantes;
using ServicarSossa.Application.DTOs.Facturas;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Interfaces;

/// <summary>USU038 — emisión y anulación de facturas.</summary>
public interface IFacturaService
{
    Task<Result<IEnumerable<FacturaResponseDto>>> GetAllAsync(
        string? ordenId, string? clienteId, EstadoFactura? estado,
        DateTime? desde, DateTime? hasta, CancellationToken ct = default);

    Task<Result<FacturaResponseDto>> GetByIdAsync(string id, CancellationToken ct = default);

    /// <summary>USU038 — emite la factura de una orden ya finalizada o cerrada.</summary>
    Task<Result<FacturaResponseDto>> CreateAsync(
        FacturaRequestDto dto, CancellationToken ct = default);

    /// <summary>Anula la factura. Solo procede si no tiene pagos registrados.</summary>
    Task<Result<FacturaResponseDto>> AnularAsync(string id, string usuarioId, CancellationToken ct = default);

    /// <summary>Comprobante imprimible de la factura, con el detalle de la orden.</summary>
    Task<Result<ArchivoComprobanteDto>> GetPdfAsync(string id, CancellationToken ct = default);
}
