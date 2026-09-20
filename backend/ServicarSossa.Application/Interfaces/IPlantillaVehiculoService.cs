using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.Comunes;
using ServicarSossa.Application.DTOs.Vehiculos;

namespace ServicarSossa.Application.Interfaces;

/// <summary>Biblioteca de diagramas vectoriales por Marca+Modelo (Administrador).</summary>
public interface IPlantillaVehiculoService
{
    Task<Result<IEnumerable<PlantillaVehiculoResponseDto>>> GetAllAsync(CancellationToken ct = default);

    Task<Result<PlantillaVehiculoResponseDto>> SubirAsync(
        SubirPlantillaVehiculoDto dto, CancellationToken ct = default);

    Task<Result<bool>> EliminarAsync(string id, CancellationToken ct = default);
}
