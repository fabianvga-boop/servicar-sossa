using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.Comunes;
using ServicarSossa.Application.DTOs.Repuestos;

namespace ServicarSossa.Application.Interfaces;

/// <summary>USU026, USU027, USU030 — inventario de repuestos.</summary>
public interface IRepuestoService
{
    /// <param name="soloStockBajo">USU030 — alerta de reposición.</param>
    Task<Result<IEnumerable<RepuestoResponseDto>>> GetAllAsync(
        string? buscar, string? proveedorId, bool soloStockBajo, CancellationToken ct = default);

    Task<Result<RepuestoResponseDto>> GetByIdAsync(string id, CancellationToken ct = default);

    Task<Result<RepuestoResponseDto>> CreateAsync(
        RepuestoRequestDto dto, string usuarioId, CancellationToken ct = default);

    Task<Result<RepuestoResponseDto>> UpdateAsync(
        string id, RepuestoUpdateDto dto, string usuarioId, CancellationToken ct = default);

    /// <summary>Ajuste manual de inventario (conteo físico, merma).</summary>
    Task<Result<RepuestoResponseDto>> AjustarStockAsync(
        string id, AjustarStockDto dto, string usuarioId, CancellationToken ct = default);

    /// <summary>Solo procede si el repuesto no tiene movimientos registrados.</summary>
    Task<Result<bool>> DeleteAsync(string id, string usuarioId, CancellationToken ct = default);

    /// <summary>Sube (o reemplaza) la foto del producto.</summary>
    Task<Result<RepuestoResponseDto>> SubirFotoAsync(
        string id, SubirFotoDto dto, CancellationToken ct = default);

    Task<Result<RepuestoResponseDto>> EliminarFotoAsync(string id, CancellationToken ct = default);
}
