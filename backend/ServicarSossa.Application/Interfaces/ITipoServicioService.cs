using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.TiposServicio;

namespace ServicarSossa.Application.Interfaces;

/// <summary>USU013 — catálogo de tipos de servicio que ofrece el taller.</summary>
public interface ITipoServicioService
{
    /// <param name="soloActivos">true para poblar selectores: oculta los dados de baja.</param>
    Task<Result<IEnumerable<TipoServicioResponseDto>>> GetAllAsync(
        string? buscar, bool soloActivos, CancellationToken ct = default);

    Task<Result<TipoServicioResponseDto>> GetByIdAsync(string id, CancellationToken ct = default);

    Task<Result<TipoServicioResponseDto>> CreateAsync(
        TipoServicioRequestDto dto, CancellationToken ct = default);

    Task<Result<TipoServicioResponseDto>> UpdateAsync(
        string id, TipoServicioUpdateDto dto, CancellationToken ct = default);

    Task<Result<TipoServicioResponseDto>> CambiarEstadoAsync(
        string id, CambiarEstadoServicioDto dto, CancellationToken ct = default);
}
