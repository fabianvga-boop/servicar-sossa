using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServicarSossa.Application.DTOs.Ordenes;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.API.Controllers;

/// <summary>
/// USU021-USU025 — órdenes de trabajo. El mecánico consulta sus órdenes y marca
/// el avance de sus servicios; la apertura, asignación y cierre son del Administrador.
/// </summary>
[Route("api/ordenes")]
[Authorize(Roles = "Administrador,Mecanico")]
public class OrdenesController(IOrdenService service) : ApiControllerBase
{
    // ====================================================================== ORDEN

    /// <summary>Lista órdenes filtrables por cliente, vehículo, mecánico o estado.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<OrdenResponseDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? clienteId,
        [FromQuery] string? vehiculoId,
        [FromQuery] string? mecanicoId,
        [FromQuery] EstadoOrden? estado,
        CancellationToken ct = default)
        => Responder(await service.GetAllAsync(clienteId, vehiculoId, mecanicoId, estado, ct));

    /// <summary>Detalle completo de la orden: mecánicos, servicios y repuestos.</summary>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(OrdenDetalleResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(string id, CancellationToken ct)
        => Responder(await service.GetByIdAsync(id, ct));

    /// <summary>USU021 — abre una orden de trabajo para un vehículo.</summary>
    [HttpPost]
    [Authorize(Roles = "Administrador")]
    [ProducesResponseType(typeof(OrdenDetalleResponseDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(
        [FromBody] OrdenRequestDto dto, CancellationToken ct)
    {
        var result = await service.CreateAsync(dto, UsuarioIdActual, ct);
        return ResponderCreado(result, nameof(GetById), new { id = result.Data?.OrdenId });
    }

    /// <summary>USU021 — actualiza fecha estimada y observaciones.</summary>
    [HttpPut("{id}")]
    [Authorize(Roles = "Administrador")]
    [ProducesResponseType(typeof(OrdenDetalleResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(
        string id, [FromBody] OrdenUpdateDto dto, CancellationToken ct)
        => Responder(await service.UpdateAsync(id, dto, ct));

    /// <summary>
    /// USU024, USU025 — avanza el estado de la orden. Pasar a <c>Cerrada</c>
    /// descuenta el stock de los repuestos y calcula las comisiones de los mecánicos.
    /// </summary>
    [HttpPatch("{id}/estado")]
    [Authorize(Roles = "Administrador")]
    [ProducesResponseType(typeof(OrdenDetalleResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CambiarEstado(
        string id, [FromBody] CambiarEstadoOrdenDto dto, CancellationToken ct)
        => Responder(await service.CambiarEstadoAsync(id, dto, UsuarioIdActual, ct));

    // ================================================================== MECÁNICOS

    /// <summary>USU022 — asigna un mecánico a la orden.</summary>
    [HttpPost("{id}/mecanicos")]
    [Authorize(Roles = "Administrador")]
    [ProducesResponseType(typeof(OrdenDetalleResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> AsignarMecanico(
        string id, [FromBody] AsignarMecanicoDto dto, CancellationToken ct)
        => Responder(await service.AsignarMecanicoAsync(id, dto, ct));

    /// <summary>USU022 — desasigna un mecánico (solo si no tiene servicios en la orden).</summary>
    [HttpDelete("{id}/mecanicos/{mecanicoId}")]
    [Authorize(Roles = "Administrador")]
    [ProducesResponseType(typeof(OrdenDetalleResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> QuitarMecanico(
        string id, string mecanicoId, CancellationToken ct)
        => Responder(await service.QuitarMecanicoAsync(id, mecanicoId, ct));

    // ================================================================== SERVICIOS

    /// <summary>USU023 — registra un servicio ejecutado dentro de la orden.</summary>
    [HttpPost("{id}/servicios")]
    [Authorize(Roles = "Administrador")]
    [ProducesResponseType(typeof(OrdenDetalleResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> AgregarServicio(
        string id, [FromBody] OrdenServicioRequestDto dto, CancellationToken ct)
        => Responder(await service.AgregarServicioAsync(id, dto, ct));

    /// <summary>Marca el avance de un servicio (Pendiente → EnProceso → Completado).</summary>
    [HttpPatch("{id}/servicios/{ordenServicioId}/estado")]
    [ProducesResponseType(typeof(OrdenDetalleResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CambiarEstadoServicio(
        string id, string ordenServicioId,
        [FromBody] CambiarEstadoOrdenServicioDto dto, CancellationToken ct)
        => Responder(await service.CambiarEstadoServicioAsync(id, ordenServicioId, dto, ct));

    /// <summary>USU023 — quita un servicio de la orden.</summary>
    [HttpDelete("{id}/servicios/{ordenServicioId}")]
    [Authorize(Roles = "Administrador")]
    [ProducesResponseType(typeof(OrdenDetalleResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> QuitarServicio(
        string id, string ordenServicioId, CancellationToken ct)
        => Responder(await service.QuitarServicioAsync(id, ordenServicioId, ct));

    // ================================================================== REPUESTOS

    /// <summary>
    /// Registra el consumo de un repuesto. Verifica que haya stock suficiente,
    /// pero el descuento efectivo ocurre al cerrar la orden.
    /// </summary>
    [HttpPost("{id}/repuestos")]
    [Authorize(Roles = "Administrador")]
    [ProducesResponseType(typeof(OrdenDetalleResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> AgregarRepuesto(
        string id, [FromBody] OrdenRepuestoRequestDto dto, CancellationToken ct)
        => Responder(await service.AgregarRepuestoAsync(id, dto, ct));

    /// <summary>Quita un repuesto de la orden.</summary>
    [HttpDelete("{id}/repuestos/{ordenRepuestoId}")]
    [Authorize(Roles = "Administrador")]
    [ProducesResponseType(typeof(OrdenDetalleResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> QuitarRepuesto(
        string id, string ordenRepuestoId, CancellationToken ct)
        => Responder(await service.QuitarRepuestoAsync(id, ordenRepuestoId, ct));
}
