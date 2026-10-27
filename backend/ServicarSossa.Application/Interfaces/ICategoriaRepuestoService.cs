using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.CategoriasRepuesto;

namespace ServicarSossa.Application.Interfaces;

/// <summary>Categorías de repuesto: las mantiene el Administrador.</summary>
public interface ICategoriaRepuestoService
{
    Task<Result<IEnumerable<CategoriaRepuestoResponseDto>>> GetAllAsync(CancellationToken ct = default);

    Task<Result<CategoriaRepuestoResponseDto>> CreateAsync(
        CategoriaRepuestoRequestDto dto, string usuarioId, CancellationToken ct = default);

    Task<Result<CategoriaRepuestoResponseDto>> UpdateAsync(
        string id, CategoriaRepuestoRequestDto dto, string usuarioId, CancellationToken ct = default);

    /// <summary>
    /// Borra la categoría aunque esté en uso: sus repuestos quedan sin categoría
    /// y los servicios dejan de controlarla. El frontend avisa cuántos son antes.
    /// </summary>
    Task<Result<bool>> DeleteAsync(string id, string usuarioId, CancellationToken ct = default);
}
