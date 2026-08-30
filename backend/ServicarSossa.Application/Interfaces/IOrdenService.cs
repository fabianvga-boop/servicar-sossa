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
        string id, OrdenUpdateDto dto, CancellationToken ct = default);

    /// <summary>
    /// USU024, USU025 — avanza el estado. Al pasar a <see cref="EstadoOrden.Cerrada"/>
    /// dispara el cierre: descuenta stock, calcula comisiones y sella fecha_cierre.
    /// </summary>
    Task<Result<OrdenDetalleResponseDto>> CambiarEstadoAsync(
        string id, CambiarEstadoOrdenDto dto, string usuarioId, CancellationToken ct = default);

    // --- Mecánicos (USU022) --------------------------------------------------
    Task<Result<OrdenDetalleResponseDto>> AsignarMecanicoAsync(
        string ordenId, AsignarMecanicoDto dto, CancellationToken ct = default);

    Task<Result<OrdenDetalleResponseDto>> QuitarMecanicoAsync(
        string ordenId, string mecanicoId, CancellationToken ct = default);

    // --- Servicios (USU023) --------------------------------------------------
    Task<Result<OrdenDetalleResponseDto>> AgregarServicioAsync(
        string ordenId, OrdenServicioRequestDto dto, CancellationToken ct = default);

    Task<Result<OrdenDetalleResponseDto>> CambiarEstadoServicioAsync(
        string ordenId, string ordenServicioId,
        CambiarEstadoOrdenServicioDto dto, CancellationToken ct = default);

    Task<Result<OrdenDetalleResponseDto>> QuitarServicioAsync(
        string ordenId, string ordenServicioId, CancellationToken ct = default);

    // --- Repuestos -----------------------------------------------------------
    /// <summary>Valida disponibilidad de stock antes de registrar el consumo (regla 3).</summary>
    Task<Result<OrdenDetalleResponseDto>> AgregarRepuestoAsync(
        string ordenId, OrdenRepuestoRequestDto dto, CancellationToken ct = default);

    Task<Result<OrdenDetalleResponseDto>> QuitarRepuestoAsync(
        string ordenId, string ordenRepuestoId, CancellationToken ct = default);
}
