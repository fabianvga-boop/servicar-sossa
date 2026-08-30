using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.Compras;

namespace ServicarSossa.Application.Interfaces;

/// <summary>
/// USU029 — registro de compras a proveedores.
/// Una compra registrada es inmutable: es un movimiento de inventario ya aplicado.
/// Para corregir un error se hace un ajuste de stock sobre el repuesto.
/// </summary>
public interface ICompraService
{
    Task<Result<IEnumerable<CompraResponseDto>>> GetAllAsync(
        string? proveedorId, DateTime? desde, DateTime? hasta, CancellationToken ct = default);

    Task<Result<CompraDetalleResponseDto>> GetByIdAsync(string id, CancellationToken ct = default);

    /// <summary>USU029 — registra la compra e incrementa el stock (regla de negocio 2).</summary>
    Task<Result<CompraDetalleResponseDto>> CreateAsync(
        CompraRequestDto dto, string usuarioId, CancellationToken ct = default);
}
