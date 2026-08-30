using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.Ventas;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Interfaces;

/// <summary>
/// Punto de venta: venta de repuestos en mostrador, sin orden de trabajo.
/// A diferencia del taller, el stock se descuenta en el acto (no al cerrar nada).
/// </summary>
public interface IVentaService
{
    Task<Result<IEnumerable<VentaResponseDto>>> GetAllAsync(
        string? clienteId, EstadoVenta? estado,
        DateTime? desde, DateTime? hasta, CancellationToken ct = default);

    Task<Result<VentaResponseDto>> GetByIdAsync(string id, CancellationToken ct = default);

    /// <summary>Registra la venta y descuenta el stock de forma atómica.</summary>
    Task<Result<VentaResponseDto>> CreateAsync(
        VentaRequestDto dto, string usuarioId, CancellationToken ct = default);

    /// <summary>Anula la venta y devuelve el stock al inventario.</summary>
    Task<Result<VentaResponseDto>> AnularAsync(string id, string usuarioId, CancellationToken ct = default);

    /// <summary>Totales del periodo, para el cierre de caja del mostrador.</summary>
    Task<Result<ResumenVentasDto>> GetResumenAsync(
        DateTime? desde, DateTime? hasta, CancellationToken ct = default);
}
