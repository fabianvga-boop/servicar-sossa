using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServicarSossa.Application.DTOs.TiposServicio;
using ServicarSossa.Application.Interfaces;

namespace ServicarSossa.API.Controllers;

/// <summary>
/// USU013 — catálogo de tipos de servicio. El mecánico solo consulta;
/// el mantenimiento del catálogo y los precios es del Administrador.
/// </summary>
[Route("api/tipos-servicio")]
[Authorize(Roles = "Administrador,Mecanico")]
public class TiposServicioController(ITipoServicioService service) : ApiControllerBase
{
    /// <summary>
    /// Lista los servicios del catálogo. Con <c>soloActivos = true</c> (por defecto)
    /// oculta los dados de baja, que es lo que necesitan los selectores del frontend.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<TipoServicioResponseDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? buscar,
        [FromQuery] bool soloActivos = true,
        CancellationToken ct = default)
        => Responder(await service.GetAllAsync(buscar, soloActivos, ct));

    /// <summary>Obtiene un servicio por su código (SER-000).</summary>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(TipoServicioResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(string id, CancellationToken ct)
        => Responder(await service.GetByIdAsync(id, ct));

    /// <summary>USU013 — agrega un servicio al catálogo.</summary>
    [HttpPost]
    [Authorize(Roles = "Administrador")]
    [ProducesResponseType(typeof(TipoServicioResponseDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(
        [FromBody] TipoServicioRequestDto dto, CancellationToken ct)
    {
        var result = await service.CreateAsync(dto, ct);
        return ResponderCreado(result, nameof(GetById), new { id = result.Data?.ServicioId });
    }

    /// <summary>USU013 — actualiza nombre, descripción o precio base.</summary>
    [HttpPut("{id}")]
    [Authorize(Roles = "Administrador")]
    [ProducesResponseType(typeof(TipoServicioResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(
        string id, [FromBody] TipoServicioUpdateDto dto, CancellationToken ct)
        => Responder(await service.UpdateAsync(id, dto, ct));

    /// <summary>Habilita o deshabilita el servicio (baja lógica: preserva el histórico).</summary>
    [HttpPatch("{id}/estado")]
    [Authorize(Roles = "Administrador")]
    [ProducesResponseType(typeof(TipoServicioResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CambiarEstado(
        string id, [FromBody] CambiarEstadoServicioDto dto, CancellationToken ct)
        => Responder(await service.CambiarEstadoAsync(id, dto, ct));
}
