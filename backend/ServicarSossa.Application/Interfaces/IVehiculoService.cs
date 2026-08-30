using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.Comunes;
using ServicarSossa.Application.DTOs.Vehiculos;

namespace ServicarSossa.Application.Interfaces;

/// <summary>USU009, USU010, USU011 — CRUD de vehículos y consulta por cliente.</summary>
public interface IVehiculoService
{
    /// <param name="clienteId">USU011: si se indica, filtra solo los vehículos de ese cliente.</param>
    Task<Result<IEnumerable<VehiculoResponseDto>>> GetAllAsync(
        string? buscar, string? clienteId, CancellationToken ct = default);

    Task<Result<VehiculoResponseDto>> GetByIdAsync(string id, CancellationToken ct = default);

    Task<Result<VehiculoResponseDto>> CreateAsync(
        VehiculoRequestDto dto, string usuarioId, CancellationToken ct = default);

    Task<Result<VehiculoResponseDto>> UpdateAsync(
        string id, VehiculoUpdateDto dto, string usuarioId, CancellationToken ct = default);

    /// <summary>Diagnósticos y órdenes del vehículo, para ver su trazabilidad completa.</summary>
    Task<Result<HistorialVehiculoResponseDto>> GetHistorialAsync(
        string id, CancellationToken ct = default);

    // --- Fotos (galería opcional) ---------------------------------------------

    Task<Result<IEnumerable<VehiculoFotoResponseDto>>> GetFotosAsync(
        string vehiculoId, CancellationToken ct = default);

    Task<Result<VehiculoFotoResponseDto>> SubirFotoAsync(
        string vehiculoId, SubirFotoDto dto, CancellationToken ct = default);

    Task<Result<bool>> EliminarFotoAsync(
        string vehiculoId, string fotoId, CancellationToken ct = default);
}
