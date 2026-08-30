using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Interfaces;

/// <summary>
/// Repositorio de órdenes de trabajo. Distingue entre lecturas de solo consulta
/// (AsNoTracking, con todos los includes) y la carga rastreada que usa el cierre.
/// </summary>
public interface IOrdenRepository : IRepository<OrdenTrabajo>
{
    /// <summary>Lectura completa de una orden con mecánicos, servicios y repuestos.</summary>
    Task<OrdenTrabajo?> GetDetalleAsync(string ordenId, CancellationToken ct = default);

    /// <summary>
    /// Carga la orden y sus detalles con seguimiento de cambios, para que el
    /// cierre pueda mutar stock y crear comisiones en la misma transacción.
    /// </summary>
    Task<OrdenTrabajo?> GetParaCierreAsync(string ordenId, CancellationToken ct = default);

    Task<IEnumerable<OrdenTrabajo>> BuscarAsync(
        string? clienteId, string? vehiculoId, string? mecanicoId,
        EstadoOrden? estado, CancellationToken ct = default);

    // --- Detalles ------------------------------------------------------------
    Task<OrdenMecanico?> GetMecanicoAsignadoAsync(
        string ordenId, string mecanicoId, CancellationToken ct = default);

    Task<OrdenServicio?> GetServicioAsync(
        string ordenServicioId, CancellationToken ct = default);

    Task<OrdenRepuesto?> GetRepuestoAsync(
        string ordenRepuestoId, CancellationToken ct = default);

    void AgregarMecanico(OrdenMecanico asignacion);
    void QuitarMecanico(OrdenMecanico asignacion);
    Task AgregarServicioAsync(OrdenServicio servicio, CancellationToken ct = default);
    void QuitarServicio(OrdenServicio servicio);
    Task AgregarRepuestoAsync(OrdenRepuesto repuesto, CancellationToken ct = default);
    void QuitarRepuesto(OrdenRepuesto repuesto);
}
