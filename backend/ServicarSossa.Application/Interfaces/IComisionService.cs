using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.Comisiones;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Interfaces;

/// <summary>
/// USU031-USU034 — comisiones de mecánicos.
/// Las comisiones no se crean por este servicio: las genera el cierre de orden
/// (regla 1). Aquí se configuran los porcentajes, se consultan y se pagan.
/// </summary>
public interface IComisionService
{
    // --- Configuración (USU031) ---------------------------------------------
    Task<Result<IEnumerable<ComisionConfigResponseDto>>> GetConfiguracionesAsync(
        CancellationToken ct = default);

    Task<Result<ComisionConfigResponseDto>> GetConfiguracionAsync(
        string mecanicoId, CancellationToken ct = default);

    /// <summary>Crea o actualiza el porcentaje del mecánico (upsert).</summary>
    Task<Result<ComisionConfigResponseDto>> EstablecerConfiguracionAsync(
        string mecanicoId, ComisionConfigRequestDto dto, CancellationToken ct = default);

    // --- Consulta (USU032, USU033) ------------------------------------------
    Task<Result<IEnumerable<ComisionResponseDto>>> GetAllAsync(
        string? mecanicoId, string? ordenId, EstadoPago? estadoPago,
        DateTime? desde, DateTime? hasta, CancellationToken ct = default);

    Task<Result<ComisionResponseDto>> GetByIdAsync(string id, CancellationToken ct = default);

    /// <summary>USU033 — totales por mecánico para liquidar el periodo.</summary>
    Task<Result<IEnumerable<ResumenComisionesDto>>> GetResumenAsync(
        DateTime? desde, DateTime? hasta, CancellationToken ct = default);

    // --- Pago (USU034) -------------------------------------------------------
    Task<Result<ComisionResponseDto>> PagarAsync(string id, CancellationToken ct = default);

    /// <summary>
    /// Liquidación de varias comisiones a la vez (planilla del periodo), con el
    /// desglose de adelantos descontados y el neto pagado.
    /// </summary>
    Task<Result<LiquidacionResultadoDto>> PagarLoteAsync(
        PagarComisionesLoteDto dto, CancellationToken ct = default);
}
