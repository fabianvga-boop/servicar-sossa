using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Interfaces;

/// <summary>Punto de venta: consultas de ventas con su detalle ya cargado.</summary>
public interface IVentaRepository : IRepository<Venta>
{
    Task<Venta?> GetByIdCompletaAsync(string id, CancellationToken ct = default);

    /// <summary>Sin paginar: la usa el resumen de caja, que necesita el total real.</summary>
    Task<IEnumerable<Venta>> BuscarAsync(
        string? clienteId, EstadoVenta? estado,
        DateTime? desde, DateTime? hasta, CancellationToken ct = default);

    /// <summary>Misma búsqueda que <see cref="BuscarAsync"/>, para la pantalla de listado.</summary>
    Task<(IEnumerable<Venta> Items, int Total)> BuscarPaginadoAsync(
        string? clienteId, EstadoVenta? estado,
        DateTime? desde, DateTime? hasta, int pagina, int tamanoPagina, CancellationToken ct = default);

    /// <summary>Agrega una línea al detalle de la venta.</summary>
    Task AddDetalleAsync(VentaDetalle detalle, CancellationToken ct = default);
}
