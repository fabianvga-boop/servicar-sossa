using ServicarSossa.Domain.Entities;

namespace ServicarSossa.Application.Interfaces;

/// <summary>Repositorio de repuestos. Las lecturas incluyen el proveedor.</summary>
public interface IRepuestoRepository : IRepository<Repuesto>
{
    Task<Repuesto?> GetByIdConProveedorAsync(string repuestoId, CancellationToken ct = default);

    /// <param name="soloStockBajo">USU030 — deja solo los que llegaron al mínimo.</param>
    Task<IEnumerable<Repuesto>> BuscarAsync(
        string? buscar, string? proveedorId, bool soloStockBajo, CancellationToken ct = default);

    /// <summary>true si el repuesto aparece en alguna compra u orden de trabajo.</summary>
    Task<bool> TieneMovimientosAsync(string repuestoId, CancellationToken ct = default);
}
