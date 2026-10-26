using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.Ordenes;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Interfaces;

/// <summary>USU021-USU025 — órdenes de trabajo y sus detalles.</summary>
public interface IOrdenService
{
    // --- Orden ---------------------------------------------------------------
    Task<Result<IEnumerable<OrdenResponseDto>>> GetAllAsync(
        string? clienteId, string? vehiculoId, string? mecanicoId,
        EstadoOrden? estado, CancellationToken ct = default);

    Task<Result<OrdenDetalleResponseDto>> GetByIdAsync(string id, CancellationToken ct = default);

    /// <summary>USU021 — abre una orden a nombre del administrador autenticado.</summary>
    Task<Result<OrdenDetalleResponseDto>> CreateAsync(
        OrdenRequestDto dto, string administradorId, CancellationToken ct = default);

    Task<Result<OrdenDetalleResponseDto>> UpdateAsync(
        string id, OrdenUpdateDto dto, string usuarioId, CancellationToken ct = default);

    /// <summary>
    /// USU024, USU025 — avanza el estado. Al pasar a <see cref="EstadoOrden.Cerrada"/>
    /// dispara el cierre: descuenta stock, calcula comisiones y sella fecha_cierre.
    /// </summary>
    /// <remarks>
    /// El mecánico asignado puede finalizar el trabajo; iniciarlo, cancelar y
    /// cerrar (que descuenta stock y calcula comisiones) son del Administrador.
    /// </remarks>
    Task<Result<OrdenDetalleResponseDto>> CambiarEstadoAsync(
        string id, CambiarEstadoOrdenDto dto, string usuarioId, bool esAdministrador,
        CancellationToken ct = default);

    /// <summary>
    /// Reabre una orden Finalizada o Cerrada para corregir un error: anula su
    /// proforma (si no tiene pagos) y, si estaba Cerrada, devuelve el stock y
    /// borra las comisiones pendientes. Solo Administrador; queda en auditoría.
    /// </summary>
    Task<Result<OrdenDetalleResponseDto>> CorregirAsync(
        string ordenId, CorregirOrdenDto dto, string usuarioId, CancellationToken ct = default);

    // --- Mecánicos (USU022) --------------------------------------------------

    /// <summary>
    /// Una orden la trabaja un solo mecánico. Un segundo solo entra como
    /// excepción con motivo, registrada en auditoría a nombre de <paramref name="usuarioId"/>.
    /// </summary>
    Task<Result<OrdenDetalleResponseDto>> AsignarMecanicoAsync(
        string ordenId, AsignarMecanicoDto dto, string usuarioId, CancellationToken ct = default);

    Task<Result<OrdenDetalleResponseDto>> QuitarMecanicoAsync(
        string ordenId, string mecanicoId, string usuarioId, CancellationToken ct = default);

    // --- Servicios (USU023) --------------------------------------------------
    /// <summary>
    /// Servicios y repuestos los registra el Administrador o el mecánico
    /// asignado a la orden; cada alta y baja queda en auditoría.
    /// </summary>
    Task<Result<OrdenDetalleResponseDto>> AgregarServicioAsync(
        string ordenId, OrdenServicioRequestDto dto, string usuarioId, bool esAdministrador,
        CancellationToken ct = default);

    /// <summary>
    /// Avance de un servicio. Un mecánico no inicia ni completa un servicio
    /// mientras tenga otro en proceso en la orden, y un servicio que requiere
    /// repuesto no se completa sin uno registrado (salvo excepción del Administrador).
    /// </summary>
    Task<Result<OrdenDetalleResponseDto>> CambiarEstadoServicioAsync(
        string ordenId, string ordenServicioId, CambiarEstadoOrdenServicioDto dto,
        string usuarioId, bool esAdministrador, CancellationToken ct = default);

    Task<Result<OrdenDetalleResponseDto>> EditarServicioAsync(
        string ordenId, string ordenServicioId, EditarOrdenServicioDto dto, string usuarioId,
        CancellationToken ct = default);

    Task<Result<OrdenDetalleResponseDto>> QuitarServicioAsync(
        string ordenId, string ordenServicioId, string usuarioId, bool esAdministrador,
        CancellationToken ct = default);

    // --- Repuestos -----------------------------------------------------------
    /// <summary>Valida disponibilidad de stock antes de registrar el consumo (regla 3).</summary>
    Task<Result<OrdenDetalleResponseDto>> AgregarRepuestoAsync(
        string ordenId, OrdenRepuestoRequestDto dto, string usuarioId, bool esAdministrador,
        CancellationToken ct = default);

    Task<Result<OrdenDetalleResponseDto>> EditarRepuestoAsync(
        string ordenId, string ordenRepuestoId, EditarOrdenRepuestoDto dto, string usuarioId,
        bool esAdministrador, CancellationToken ct = default);

    Task<Result<OrdenDetalleResponseDto>> QuitarRepuestoAsync(
        string ordenId, string ordenRepuestoId, string usuarioId, bool esAdministrador,
        CancellationToken ct = default);

    // ------------------------------------------------- Escribir menos: sugerencias

    /// <summary>Nombres de servicios "fuera de catálogo" ya usados en cualquier orden.</summary>
    Task<Result<IEnumerable<string>>> GetNombresServicioLibreAsync(CancellationToken ct = default);

    /// <summary>Descripciones de repuestos "fuera de inventario" ya usadas en cualquier orden.</summary>
    Task<Result<IEnumerable<string>>> GetDescripcionesRepuestoLibreAsync(CancellationToken ct = default);
}
