using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServicarSossa.Application.DTOs.Pagos;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.API.Controllers;

/// <summary>
/// USU037 — pagos de clientes. Admite pagos parciales: se pueden registrar
/// varios contra la misma factura hasta cubrir el total.
/// </summary>
[Authorize(Roles = "Administrador")]
public class PagosController(IPagoService service) : ApiControllerBase
{
    /// <summary>Lista pagos filtrables por factura, cliente, método y periodo.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<PagoResponseDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? facturaId,
        [FromQuery] string? clienteId,
        [FromQuery] MetodoPago? metodoPago,
        [FromQuery] DateTime? desde,
        [FromQuery] DateTime? hasta,
        CancellationToken ct = default)
        => Responder(await service.GetAllAsync(facturaId, clienteId, metodoPago, desde, hasta, ct));

    /// <summary>Obtiene un pago por su código (PAG-000).</summary>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(PagoResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(string id, CancellationToken ct)
        => Responder(await service.GetByIdAsync(id, ct));

    /// <summary>
    /// USU037 — registra un pago contra una factura emitida. El monto no puede
    /// superar el saldo pendiente.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(PagoResponseDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(
        [FromBody] PagoRequestDto dto, CancellationToken ct)
    {
        var result = await service.CreateAsync(dto, ct);
        return ResponderCreado(result, nameof(GetById), new { id = result.Data?.PagoId });
    }

    /// <summary>Revierte un pago mal registrado (por ejemplo, monto o método equivocado).</summary>
    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Revertir(string id, CancellationToken ct)
    {
        var result = await service.RevertirAsync(id, UsuarioIdActual, ct);
        return result.Success ? Ok(new { mensaje = result.Message }) : Responder(result);
    }
}
