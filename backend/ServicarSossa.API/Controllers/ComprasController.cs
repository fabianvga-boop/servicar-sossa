using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServicarSossa.Application.DTOs.Compras;
using ServicarSossa.Application.Interfaces;

namespace ServicarSossa.API.Controllers;

/// <summary>
/// USU029 — compras a proveedores. Solo alta y consulta: una compra registrada
/// ya movió el inventario, así que no se edita ni se borra. Para corregir un
/// error se usa el ajuste de stock del repuesto.
/// </summary>
[Authorize(Roles = "Administrador")]
public class ComprasController(ICompraService service) : ApiControllerBase
{
    /// <summary>Lista compras, filtrables por proveedor y rango de fechas.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<CompraResponseDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? proveedorId,
        [FromQuery] DateTime? desde,
        [FromQuery] DateTime? hasta,
        CancellationToken ct = default)
        => Responder(await service.GetAllAsync(proveedorId, desde, hasta, ct));

    /// <summary>Detalle completo de una compra (CMP-000) con todas sus líneas.</summary>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(CompraDetalleResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(string id, CancellationToken ct)
        => Responder(await service.GetByIdAsync(id, ct));

    /// <summary>
    /// USU029 — registra una compra con su detalle e incrementa el stock de cada
    /// repuesto. Queda a nombre del usuario autenticado.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(CompraDetalleResponseDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create(
        [FromBody] CompraRequestDto dto, CancellationToken ct)
    {
        var result = await service.CreateAsync(dto, UsuarioIdActual, ct);
        return ResponderCreado(result, nameof(GetById), new { id = result.Data?.CompraId });
    }
}
