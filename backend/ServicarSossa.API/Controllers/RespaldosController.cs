using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServicarSossa.Application.Interfaces;

namespace ServicarSossa.API.Controllers;

/// <summary>
/// Respaldo de los datos del taller. Solo el Administrador puede pedirlo; cada
/// descarga queda en la auditoría.
/// </summary>
[Authorize(Roles = "Administrador")]
public class RespaldosController(IRespaldoService service) : ApiControllerBase
{
    /// <summary>Descarga un archivo .sql con los datos de todas las tablas.</summary>
    [HttpPost]
    [Produces("application/sql")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Generar(CancellationToken ct = default)
    {
        var result = await service.GenerarAsync(UsuarioIdActual, ct);
        if (!result.Success) return Responder(result);

        var archivo = result.Data!;
        return File(archivo.Contenido, "application/sql", archivo.NombreArchivo);
    }

    /// <summary>Cuándo y quién hizo el último respaldo.</summary>
    [HttpGet("ultimo")]
    [ProducesResponseType(typeof(UltimoRespaldoDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Ultimo(CancellationToken ct = default)
        => Ok(await service.UltimoAsync(ct));
}
