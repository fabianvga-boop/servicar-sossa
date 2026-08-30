using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServicarSossa.Application.DTOs.Ventas;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.API.Controllers;

/// <summary>
/// Punto de venta — venta de repuestos en mostrador, sin orden de trabajo ni
/// vehículo. Solo el Administrador opera la caja.
/// </summary>
[Authorize(Roles = "Administrador")]
public class VentasController(IVentaService service) : ApiControllerBase
{
    /// <summary>Lista ventas filtrables por cliente, estado y periodo.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<VentaResponseDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? clienteId,
        [FromQuery] EstadoVenta? estado,
        [FromQuery] DateTime? desde,
        [FromQuery] DateTime? hasta,
        CancellationToken ct = default)
        => Responder(await service.GetAllAsync(clienteId, estado, desde, hasta, ct));

    /// <summary>Totales del periodo, para el cierre de caja del mostrador.</summary>
    [HttpGet("resumen")]
    [ProducesResponseType(typeof(ResumenVentasDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetResumen(
        [FromQuery] DateTime? desde, [FromQuery] DateTime? hasta, CancellationToken ct = default)
        => Responder(await service.GetResumenAsync(desde, hasta, ct));

    /// <summary>Obtiene una venta por su código (VTA-000), con su detalle.</summary>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(VentaResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(string id, CancellationToken ct)
        => Responder(await service.GetByIdAsync(id, ct));

    /// <summary>
    /// Registra la venta y descuenta el stock en el acto. El vendedor sale del
    /// token; el cliente es opcional (venta de mostrador).
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(VentaResponseDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(
        [FromBody] VentaRequestDto dto, CancellationToken ct)
    {
        var result = await service.CreateAsync(dto, UsuarioIdActual, ct);
        return ResponderCreado(result, nameof(GetById), new { id = result.Data?.VentaId });
    }

    /// <summary>Anula la venta y devuelve el stock al inventario.</summary>
    [HttpPatch("{id}/anular")]
    [ProducesResponseType(typeof(VentaResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Anular(string id, CancellationToken ct)
        => Responder(await service.AnularAsync(id, UsuarioIdActual, ct));
}
