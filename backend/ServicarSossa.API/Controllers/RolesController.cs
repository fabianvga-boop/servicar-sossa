using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;

namespace ServicarSossa.API.Controllers;

/// <summary>
/// USU005 — catálogo de roles, para poblar el selector del formulario de usuarios.
/// Solo lectura: los roles del sistema son fijos (Administrador y Mecanico).
/// </summary>
[Authorize(Roles = "Administrador")]
public class RolesController(IRepository<Rol> roles) : ApiControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var lista = await roles.GetAllAsync(ct);
        return Ok(lista
            .OrderBy(r => r.RolId)
            .Select(r => new { r.RolId, r.NombreRol, r.Descripcion }));
    }
}
