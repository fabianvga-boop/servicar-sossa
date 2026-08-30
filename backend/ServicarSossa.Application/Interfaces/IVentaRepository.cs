using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Interfaces;

/// <summary>Punto de venta: consultas de ventas con su detalle ya cargado.</summary>
public interface IVentaRepository : IRepository<Venta>
{
    Task<Venta?> GetByIdCompletaAsync(string id, CancellationToken ct = default);

    Task<IEnumerable<Venta>> BuscarAsync(
        string? clienteId, EstadoVenta? estado,
        DateTime? desde, DateTime? hasta, CancellationToken ct = default);

    /// <summary>Agrega una línea al detalle de la venta.</summary>
    Task AddDetalleAsync(VentaDetalle detalle, CancellationToken ct = default);
}
