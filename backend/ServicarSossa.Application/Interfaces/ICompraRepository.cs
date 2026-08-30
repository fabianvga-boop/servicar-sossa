using ServicarSossa.Domain.Entities;

namespace ServicarSossa.Application.Interfaces;

/// <summary>Repositorio de compras. Las lecturas traen proveedor, usuario y detalle.</summary>
public interface ICompraRepository : IRepository<Compra>
{
    Task<Compra?> GetDetalleAsync(string compraId, CancellationToken ct = default);

    Task<IEnumerable<Compra>> BuscarAsync(
        string? proveedorId, DateTime? desde, DateTime? hasta, CancellationToken ct = default);

    Task AgregarDetalleAsync(CompraDetalle detalle, CancellationToken ct = default);
}
