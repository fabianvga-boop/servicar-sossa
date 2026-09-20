using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServicarSossa.Application.DTOs.Auditoria;
using ServicarSossa.Application.DTOs.Comunes;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.API.Controllers;

/// <summary>
/// Bitácora de auditoría: quién hizo qué acción, sobre qué registro y cuándo.
/// Solo lectura, y solo para el Administrador.
/// </summary>
[Authorize(Roles = "Administrador")]
public class AuditoriaController(IAuditoriaService service) : ApiControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(ResultadoPaginadoDto<AuditoriaResponseDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Buscar(
        [FromQuery] string? entidad,
        [FromQuery] string? entidadId,
        [FromQuery] string? usuarioId,
        [FromQuery] AccionAuditoria? accion,
        [FromQuery] DateTime? desde,
        [FromQuery] DateTime? hasta,
        [FromQuery] int pagina = 1,
        [FromQuery] int tamanoPagina = 20,
        CancellationToken ct = default)
        => Responder(await service.BuscarAsync(
            entidad, entidadId, usuarioId, accion, desde, hasta, pagina, tamanoPagina, ct));
}
