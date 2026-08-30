using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServicarSossa.Application.DTOs.Diagnosticos;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.API.Controllers;

/// <summary>
/// USU012, USU014, USU015, USU016 — diagnósticos de vehículos.
/// El mecánico registra y edita los suyos; el administrador supervisa todos.
/// </summary>
[Authorize(Roles = "Administrador,Mecanico")]
public class DiagnosticosController(IDiagnosticoService service) : ApiControllerBase
{
    /// <summary>USU014 — historial de diagnósticos, filtrable por vehículo, mecánico o estado.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<DiagnosticoResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? vehiculoId,
        [FromQuery] string? mecanicoId,
        [FromQuery] EstadoDiag? estado,
        CancellationToken ct = default)
        => Responder(await service.GetAllAsync(vehiculoId, mecanicoId, estado, ct));

    /// <summary>Obtiene un diagnóstico por su código (DIA-000).</summary>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(DiagnosticoResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(string id, CancellationToken ct)
        => Responder(await service.GetByIdAsync(id, ct));

    /// <summary>
    /// USU012 — registra un diagnóstico. Queda a nombre del usuario autenticado:
    /// el mecánico no se recibe por el body.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(DiagnosticoResponseDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create(
        [FromBody] DiagnosticoRequestDto dto, CancellationToken ct)
    {
        var result = await service.CreateAsync(dto, UsuarioIdActual, ct);
        return ResponderCreado(result, nameof(GetById), new { id = result.Data?.DiagnosticoId });
    }

    /// <summary>USU015, USU016 — edita la falla y las observaciones técnicas.</summary>
    [HttpPut("{id}")]
    [ProducesResponseType(typeof(DiagnosticoResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(
        string id, [FromBody] DiagnosticoUpdateDto dto, CancellationToken ct)
        => Responder(await service.UpdateAsync(id, dto, UsuarioIdActual, EsAdministrador, ct));

    /// <summary>Marca el diagnóstico como Revisado o Anulado.</summary>
    [HttpPatch("{id}/estado")]
    [ProducesResponseType(typeof(DiagnosticoResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CambiarEstado(
        string id, [FromBody] CambiarEstadoDiagnosticoDto dto, CancellationToken ct)
        => Responder(await service.CambiarEstadoAsync(id, dto, UsuarioIdActual, EsAdministrador, ct));

    /// <summary>
    /// Registra la respuesta del cliente al presupuesto aproximado (Aprobado /
    /// Rechazado). Solo con Aprobado se podrá crear la orden de trabajo.
    /// </summary>
    [HttpPatch("{id}/respuesta")]
    [ProducesResponseType(typeof(DiagnosticoResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Responder(
        string id, [FromBody] ResponderDiagnosticoDto dto, CancellationToken ct)
        => Responder(await service.ResponderAsync(id, dto, UsuarioIdActual, EsAdministrador, ct));

    /// <summary>Descarga el presupuesto preliminar del diagnóstico en PDF.</summary>
    // Sin [Produces("application/pdf")]: restringir el tipo de salida haría que
    // el error (JSON) devuelva 406 en vez del 404 real.
    [HttpGet("{id}/pdf")]
    [ProducesResponseType(typeof(FileResult), StatusCodes.Status200OK, "application/pdf")]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPdf(string id, CancellationToken ct)
    {
        var result = await service.GetPdfAsync(id, ct);

        if (!result.Success) return Responder(result);

        var archivo = result.Data!;
        return File(archivo.Contenido, archivo.TipoContenido, archivo.NombreArchivo);
    }
}
