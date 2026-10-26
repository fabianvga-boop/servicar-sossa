using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServicarSossa.Application.DTOs.Ordenes;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.API.Controllers;

/// <summary>
/// USU021-USU025 — órdenes de trabajo. El Administrador asigna el mecánico e
/// inicia el trabajo; el mecánico asignado registra servicios y repuestos, marca
/// su avance y finaliza. Cancelar, cerrar y corregir son del Administrador.
/// Toda acción sobre la orden queda en auditoría.
/// </summary>
[Route("api/ordenes")]
[Authorize(Roles = "Administrador,Mecanico")]
public class OrdenesController(IOrdenService service) : ApiControllerBase
{
    // ====================================================================== ORDEN

    /// <summary>
    /// USU024 — lista órdenes filtrables por cliente, vehículo, mecánico o estado.
    /// El Mecánico recibe solo las órdenes a las que está asignado.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<OrdenResponseDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? clienteId,
        [FromQuery] string? vehiculoId,
        [FromQuery] string? mecanicoId,
        [FromQuery] EstadoOrden? estado,
        CancellationToken ct = default)
        => Responder(await service.GetAllAsync(
            clienteId, vehiculoId, EsAdministrador ? mecanicoId : UsuarioIdActual, estado, ct));

    /// <summary>Escribir menos: nombres de servicios "fuera de catálogo" ya usados antes.</summary>
    [HttpGet("sugerencias/servicios-libres")]
    [ProducesResponseType(typeof(IEnumerable<string>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetNombresServicioLibre(CancellationToken ct)
        => Responder(await service.GetNombresServicioLibreAsync(ct));

    /// <summary>Escribir menos: descripciones de repuestos "fuera de inventario" ya usadas antes.</summary>
    [HttpGet("sugerencias/repuestos-libres")]
    [ProducesResponseType(typeof(IEnumerable<string>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetDescripcionesRepuestoLibre(CancellationToken ct)
        => Responder(await service.GetDescripcionesRepuestoLibreAsync(ct));

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
        => Responder(await service.UpdateAsync(id, dto, UsuarioIdActual, ct));

    /// <summary>
    /// USU023, USU025 — avanza el estado de la orden. Pasar a <c>Cerrada</c>
    /// descuenta el stock de los repuestos y calcula las comisiones de los mecánicos.
    /// </summary>
    [HttpPatch("{id}/estado")]
    [ProducesResponseType(typeof(OrdenDetalleResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CambiarEstado(
        string id, [FromBody] CambiarEstadoOrdenDto dto, CancellationToken ct)
        => Responder(await service.CambiarEstadoAsync(id, dto, UsuarioIdActual, EsAdministrador, ct));

    /// <summary>
    /// Reabre una orden Finalizada o Cerrada para corregir un error. Devuelve
    /// 409 si su proforma tiene pagos, si hay factura emitida o si alguna
    /// comisión ya se pagó.
    /// </summary>
    [HttpPost("{id}/corregir")]
    [Authorize(Roles = "Administrador")]
    [ProducesResponseType(typeof(OrdenDetalleResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Corregir(
        string id, [FromBody] CorregirOrdenDto dto, CancellationToken ct)
        => Responder(await service.CorregirAsync(id, dto, UsuarioIdActual, ct));

    // ================================================================== MECÁNICOS

    /// <summary>
    /// USU022 — asigna el mecánico de la orden. Si ya tiene uno, un segundo solo
    /// entra como excepción con <c>motivoExcepcion</c> (409 si falta).
    /// </summary>
    [HttpPost("{id}/mecanicos")]
    [Authorize(Roles = "Administrador")]
    [ProducesResponseType(typeof(OrdenDetalleResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> AsignarMecanico(
        string id, [FromBody] AsignarMecanicoDto dto, CancellationToken ct)
        => Responder(await service.AsignarMecanicoAsync(id, dto, UsuarioIdActual, ct));

    /// <summary>USU022 — desasigna un mecánico (solo si no tiene servicios en la orden).</summary>
    [HttpDelete("{id}/mecanicos/{mecanicoId}")]
    [Authorize(Roles = "Administrador")]
    [ProducesResponseType(typeof(OrdenDetalleResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> QuitarMecanico(
        string id, string mecanicoId, CancellationToken ct)
        => Responder(await service.QuitarMecanicoAsync(id, mecanicoId, UsuarioIdActual, ct));

    // ================================================================== SERVICIOS

    /// <summary>
    /// USU013 — registra un servicio ejecutado dentro de la orden. Es la mitad
    /// de USU013 que no se construyó en el Sprint 3: allí se entregó el catálogo
    /// (tipos_servicio) y aquí el registro del servicio realmente ejecutado.
    /// </summary>
    [HttpPost("{id}/servicios")]
    [ProducesResponseType(typeof(OrdenDetalleResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> AgregarServicio(
        string id, [FromBody] OrdenServicioRequestDto dto, CancellationToken ct)
        => Responder(await service.AgregarServicioAsync(id, dto, UsuarioIdActual, EsAdministrador, ct));

    /// <summary>
    /// USU023 — marca el avance de un servicio (Pendiente → EnProceso → Completado).
    /// </summary>
    [HttpPatch("{id}/servicios/{ordenServicioId}/estado")]
    [ProducesResponseType(typeof(OrdenDetalleResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CambiarEstadoServicio(
        string id, string ordenServicioId,
        [FromBody] CambiarEstadoOrdenServicioDto dto, CancellationToken ct)
        => Responder(await service.CambiarEstadoServicioAsync(
            id, ordenServicioId, dto, UsuarioIdActual, EsAdministrador, ct));

    /// <summary>Corrige el precio o el detalle de un servicio cargado (solo Administrador).</summary>
    [HttpPatch("{id}/servicios/{ordenServicioId}")]
    [Authorize(Roles = "Administrador")]
    [ProducesResponseType(typeof(OrdenDetalleResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> EditarServicio(
        string id, string ordenServicioId, [FromBody] EditarOrdenServicioDto dto, CancellationToken ct)
        => Responder(await service.EditarServicioAsync(id, ordenServicioId, dto, UsuarioIdActual, ct));

    /// <summary>USU023 — quita un servicio de la orden.</summary>
    [HttpDelete("{id}/servicios/{ordenServicioId}")]
    [ProducesResponseType(typeof(OrdenDetalleResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> QuitarServicio(
        string id, string ordenServicioId, CancellationToken ct)
        => Responder(await service.QuitarServicioAsync(
            id, ordenServicioId, UsuarioIdActual, EsAdministrador, ct));

    // ================================================================== REPUESTOS

    /// <summary>
    /// Registra el consumo de un repuesto. Verifica que haya stock suficiente,
    /// pero el descuento efectivo ocurre al cerrar la orden.
    /// </summary>
    [HttpPost("{id}/repuestos")]
    [ProducesResponseType(typeof(OrdenDetalleResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> AgregarRepuesto(
        string id, [FromBody] OrdenRepuestoRequestDto dto, CancellationToken ct)
        => Responder(await service.AgregarRepuestoAsync(id, dto, UsuarioIdActual, EsAdministrador, ct));

    /// <summary>
    /// Corrige la cantidad de un repuesto cargado; el precio solo lo cambia el Administrador.
    /// </summary>
    [HttpPatch("{id}/repuestos/{ordenRepuestoId}")]
    [ProducesResponseType(typeof(OrdenDetalleResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> EditarRepuesto(
        string id, string ordenRepuestoId, [FromBody] EditarOrdenRepuestoDto dto, CancellationToken ct)
        => Responder(await service.EditarRepuestoAsync(
            id, ordenRepuestoId, dto, UsuarioIdActual, EsAdministrador, ct));

    /// <summary>Quita un repuesto de la orden.</summary>
    [HttpDelete("{id}/repuestos/{ordenRepuestoId}")]
    [ProducesResponseType(typeof(OrdenDetalleResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> QuitarRepuesto(
        string id, string ordenRepuestoId, CancellationToken ct)
        => Responder(await service.QuitarRepuestoAsync(
            id, ordenRepuestoId, UsuarioIdActual, EsAdministrador, ct));
}
