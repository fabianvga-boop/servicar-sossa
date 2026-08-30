using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using ServicarSossa.Application.Common;

namespace ServicarSossa.API.Controllers;

/// <summary>
/// Base de todos los controllers: traduce <see cref="Result{T}"/> al código HTTP
/// correcto en un solo lugar, para no repetir la lógica en cada endpoint.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public abstract class ApiControllerBase : ControllerBase
{
    /// <summary>ID del usuario autenticado, tomado del claim del JWT.</summary>
    protected string UsuarioIdActual =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new InvalidOperationException("El token no contiene el identificador del usuario.");

    /// <summary>
    /// true si el usuario autenticado es Administrador. Los servicios lo usan para
    /// decidir si puede operar sobre registros ajenos (p. ej. diagnósticos de otro mecánico).
    /// </summary>
    protected bool EsAdministrador => User.IsInRole("Administrador");

    /// <summary>200 OK con los datos, o el error correspondiente.</summary>
    protected IActionResult Responder<T>(Result<T> result)
        => result.Success ? Ok(result.Data) : Error(result);

    /// <summary>201 Created apuntando a <paramref name="accion"/>, o el error correspondiente.</summary>
    protected IActionResult ResponderCreado<T>(Result<T> result, string accion, object rutaValores)
        => result.Success
            ? CreatedAtAction(accion, rutaValores, result.Data)
            : Error(result);

    private IActionResult Error<T>(Result<T> result) => result.Error switch
    {
        ErrorTipo.NoEncontrado => NotFound(new { mensaje = result.Message }),
        ErrorTipo.Conflicto => Conflict(new { mensaje = result.Message }),
        ErrorTipo.NoAutorizado => Unauthorized(new { mensaje = result.Message }),
        _ => BadRequest(new { mensaje = result.Message })
    };
}
