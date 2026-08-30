using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.Proveedores;

namespace ServicarSossa.Application.Interfaces;

/// <summary>USU028 — gestión de proveedores.</summary>
public interface IProveedorService
{
    Task<Result<IEnumerable<ProveedorResponseDto>>> GetAllAsync(
        string? buscar, CancellationToken ct = default);

    Task<Result<ProveedorResponseDto>> GetByIdAsync(string id, CancellationToken ct = default);

    Task<Result<ProveedorResponseDto>> CreateAsync(
        ProveedorRequestDto dto, string usuarioId, CancellationToken ct = default);

    Task<Result<ProveedorResponseDto>> UpdateAsync(
        string id, ProveedorRequestDto dto, string usuarioId, CancellationToken ct = default);

    /// <summary>
    /// Solo procede si el proveedor no tiene repuestos ni compras asociadas;
    /// la tabla no maneja baja lógica.
    /// </summary>
    Task<Result<bool>> DeleteAsync(string id, string usuarioId, CancellationToken ct = default);
}
