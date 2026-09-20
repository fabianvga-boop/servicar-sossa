using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.Comunes;
using ServicarSossa.Application.DTOs.Vehiculos;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;

namespace ServicarSossa.Application.Services;

/// <summary>Biblioteca de diagramas vectoriales por Marca+Modelo.</summary>
public class PlantillaVehiculoService(
    IRepository<PlantillaVehiculo> plantillas,
    IAlmacenArchivos archivos,
    IGeneradorId generadorId) : IPlantillaVehiculoService
{
    private const string Subcarpeta = "plantillas-vehiculo";

    public async Task<Result<IEnumerable<PlantillaVehiculoResponseDto>>> GetAllAsync(
        CancellationToken ct = default)
    {
        var lista = await plantillas.GetAllAsync(ct);
        return Result<IEnumerable<PlantillaVehiculoResponseDto>>.Ok(
            lista.OrderBy(p => p.Marca).ThenBy(p => p.Modelo).Select(Mapear));
    }

    public async Task<Result<PlantillaVehiculoResponseDto>> SubirAsync(
        SubirPlantillaVehiculoDto dto, CancellationToken ct = default)
    {
        var invalida = ValidadorPlantillasVehiculo.Validar(dto.Archivo);
        if (invalida is not null) return Result<PlantillaVehiculoResponseDto>.Fail(invalida);

        var marca = dto.Marca.Trim();
        var modelo = dto.Modelo.Trim();

        var existente = await plantillas.FirstOrDefaultAsync(
            p => p.Marca.ToLower() == marca.ToLower() && p.Modelo.ToLower() == modelo.ToLower(), ct);

        // Reemplaza el SVG anterior si ya había uno para esta marca+modelo, en
        // vez de acumular duplicados que compitan al resolver el diagrama.
        if (existente is not null)
        {
            archivos.Eliminar(Subcarpeta, existente.NombreArchivo);
            plantillas.Remove(existente);
        }

        var plantillaId = await generadorId.SiguienteAsync<PlantillaVehiculo>("PLV", ct);
        var nombreArchivo = await archivos.GuardarAsync(
            Subcarpeta, plantillaId, dto.Archivo.Contenido, ".svg", ct);

        var plantilla = new PlantillaVehiculo
        {
            PlantillaId = plantillaId,
            Marca = marca,
            Modelo = modelo,
            NombreArchivo = nombreArchivo,
            FechaSubida = DateTime.UtcNow
        };

        await plantillas.AddAsync(plantilla, ct);
        await plantillas.SaveChangesAsync(ct);

        return Result<PlantillaVehiculoResponseDto>.Ok(
            Mapear(plantilla), "Plantilla del vehículo guardada correctamente.");
    }

    public async Task<Result<bool>> EliminarAsync(string id, CancellationToken ct = default)
    {
        var plantilla = await plantillas.FirstOrDefaultAsync(p => p.PlantillaId == id, ct);
        if (plantilla is null) return Result<bool>.NoEncontrado($"No existe la plantilla {id}.");

        plantillas.Remove(plantilla);
        await plantillas.SaveChangesAsync(ct);
        archivos.Eliminar(Subcarpeta, plantilla.NombreArchivo);

        return Result<bool>.Ok(true, "Plantilla eliminada. Los vehículos de esa marca y modelo vuelven al diagrama genérico.");
    }

    private PlantillaVehiculoResponseDto Mapear(PlantillaVehiculo p) => new()
    {
        PlantillaId = p.PlantillaId,
        Marca = p.Marca,
        Modelo = p.Modelo,
        Url = archivos.RutaPublica(Subcarpeta, p.NombreArchivo),
        FechaSubida = p.FechaSubida
    };
}
