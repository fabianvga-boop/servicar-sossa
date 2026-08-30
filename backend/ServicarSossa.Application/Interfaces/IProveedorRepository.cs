using ServicarSossa.Domain.Entities;

namespace ServicarSossa.Application.Interfaces;

/// <summary>Repositorio de proveedores.</summary>
public interface IProveedorRepository : IRepository<Proveedor>
{
    Task<IEnumerable<Proveedor>> BuscarAsync(string? buscar, CancellationToken ct = default);

    Task<Dictionary<string, int>> ContarRepuestosPorProveedorAsync(
        IEnumerable<string> proveedorIds, CancellationToken ct = default);

    /// <summary>true si el proveedor está referenciado por repuestos o compras.</summary>
    Task<bool> TieneReferenciasAsync(string proveedorId, CancellationToken ct = default);
}
