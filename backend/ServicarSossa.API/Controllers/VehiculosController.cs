using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServicarSossa.Application.DTOs.Comunes;
using ServicarSossa.Application.DTOs.Vehiculos;
using ServicarSossa.Application.Interfaces;

namespace ServicarSossa.API.Controllers;

/// <summary>USU009, USU010, USU011 — gestión de vehículos.</summary>
[Authorize(Roles = "Administrador,Mecanico")]
public class VehiculosController(IVehiculoService service) : ApiControllerBase
{
    /// <summary>
    /// Lista vehículos. USU011: pasar <paramref name="clienteId"/> para ver solo
    /// los vehículos de un cliente puntual.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<VehiculoResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? buscar, [FromQuery] string? clienteId, CancellationToken ct)
        => Responder(await service.GetAllAsync(buscar, clienteId, ct));

    /// <summary>Obtiene un vehículo por su código (VEH-000).</summary>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(VehiculoResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(string id, CancellationToken ct)
        => Responder(await service.GetByIdAsync(id, ct));

    /// <summary>USU009 — registra un nuevo vehículo para un cliente existente.</summary>
    [HttpPost]
    [Authorize(Roles = "Administrador")]
    [ProducesResponseType(typeof(VehiculoResponseDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(
        [FromBody] VehiculoRequestDto dto, CancellationToken ct)
    {
        var result = await service.CreateAsync(dto, UsuarioIdActual, ct);
        return ResponderCreado(result, nameof(GetById), new { id = result.Data?.VehiculoId });
    }

    /// <summary>USU010 — actualiza los datos del vehículo.</summary>
    [HttpPut("{id}")]
    [Authorize(Roles = "Administrador")]
    [ProducesResponseType(typeof(VehiculoResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(
        string id, [FromBody] VehiculoUpdateDto dto, CancellationToken ct)
        => Responder(await service.UpdateAsync(id, dto, UsuarioIdActual, ct));

    /// <summary>Trazabilidad: diagnósticos y órdenes del vehículo, más recientes primero.</summary>
    [HttpGet("{id}/historial")]
    [ProducesResponseType(typeof(HistorialVehiculoResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetHistorial(string id, CancellationToken ct)
        => Responder(await service.GetHistorialAsync(id, ct));

    // --------------------------------------------------------- Fotos (galería)

    /// <summary>Lista la galería de fotos del vehículo, más recientes primero.</summary>
    [HttpGet("{id}/fotos")]
    [ProducesResponseType(typeof(IEnumerable<VehiculoFotoResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetFotos(string id, CancellationToken ct)
        => Responder(await service.GetFotosAsync(id, ct));

    /// <summary>Sube una foto (JPG, PNG o WEBP, hasta 8 MB) a la galería del vehículo.</summary>
    [HttpPost("{id}/fotos")]
    [Authorize(Roles = "Administrador")]
    [ProducesResponseType(typeof(VehiculoFotoResponseDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SubirFoto(string id, IFormFile foto, CancellationToken ct)
    {
        using var buffer = new MemoryStream();
        await foto.CopyToAsync(buffer, ct);

        var result = await service.SubirFotoAsync(id, new SubirFotoDto
        {
            Contenido = buffer.ToArray(),
            NombreOriginal = foto.FileName
        }, ct);

        return ResponderCreado(result, nameof(GetFotos), new { id });
    }

    /// <summary>Elimina una foto de la galería del vehículo.</summary>
    [HttpDelete("{id}/fotos/{fotoId}")]
    [Authorize(Roles = "Administrador")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> EliminarFoto(string id, string fotoId, CancellationToken ct)
    {
        var result = await service.EliminarFotoAsync(id, fotoId, ct);
        return result.Success ? Ok(new { mensaje = result.Message }) : Responder(result);
    }
}
