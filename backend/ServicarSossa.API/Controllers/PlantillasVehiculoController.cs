using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServicarSossa.Application.DTOs.Comunes;
using ServicarSossa.Application.DTOs.Vehiculos;
using ServicarSossa.Application.Interfaces;

namespace ServicarSossa.API.Controllers;

/// <summary>
/// Biblioteca de diagramas vectoriales por Marca+Modelo: el vehículo de la
/// lista que coincida usa este SVG en vez del diagrama genérico por tipo de
/// carrocería. Solo el Administrador la mantiene.
/// </summary>
[Route("api/plantillas-vehiculo")]
[Authorize(Roles = "Administrador")]
public class PlantillasVehiculoController(IPlantillaVehiculoService service) : ApiControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<PlantillaVehiculoResponseDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(CancellationToken ct)
        => Responder(await service.GetAllAsync(ct));

    /// <summary>Sube un SVG para Marca+Modelo; reemplaza el existente si ya había uno.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(PlantillaVehiculoResponseDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Subir(
        [FromForm] string marca, [FromForm] string modelo, IFormFile archivo, CancellationToken ct)
    {
        using var buffer = new MemoryStream();
        await archivo.CopyToAsync(buffer, ct);

        var result = await service.SubirAsync(new SubirPlantillaVehiculoDto
        {
            Marca = marca,
            Modelo = modelo,
            Archivo = new SubirFotoDto { Contenido = buffer.ToArray(), NombreOriginal = archivo.FileName }
        }, ct);

        return ResponderCreado(result, nameof(GetAll), new { });
    }

    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Eliminar(string id, CancellationToken ct)
    {
        var result = await service.EliminarAsync(id, ct);
        return result.Success ? Ok(new { mensaje = result.Message }) : Responder(result);
    }
}
