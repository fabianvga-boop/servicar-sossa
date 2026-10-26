using ServicarSossa.Domain.Entities;

namespace ServicarSossa.Application.Interfaces;

/// <summary>Repositorio de repuestos. Las lecturas incluyen el proveedor y la compatibilidad.</summary>
public interface IRepuestoRepository : IRepository<Repuesto>
{
    /// <summary>Repuesto con su proveedor y su compatibilidad, sin seguimiento.</summary>
    Task<Repuesto?> GetByIdConProveedorAsync(string repuestoId, CancellationToken ct = default);

    /// <summary>
    /// Repuesto con su compatibilidad, con seguimiento: para editarla, porque
    /// las filas que se quitan de la colección se borran al guardar.
    /// </summary>
    Task<Repuesto?> GetParaEditarAsync(string repuestoId, CancellationToken ct = default);

    /// <param name="soloStockBajo">USU030 — deja solo los que llegaron al mínimo.</param>
    /// <param name="vehiculo">
    /// Si se indica, deja solo los repuestos que sirven a ese vehículo: los
    /// universales y los específicos compatibles con su marca, modelo y año.
    /// </param>
    Task<(IEnumerable<Repuesto> Items, int Total)> BuscarAsync(
        string? buscar, string? proveedorId, bool soloStockBajo,
        int pagina, int tamanoPagina, CancellationToken ct = default,
        Vehiculo? vehiculo = null);

    /// <summary>true si el repuesto aparece en alguna compra u orden de trabajo.</summary>
    Task<bool> TieneMovimientosAsync(string repuestoId, CancellationToken ct = default);

    /// <summary>Códigos RCP-000 ya usados, para numerar varias filas nuevas de una vez.</summary>
    Task<int> UltimoNumeroCompatibilidadAsync(CancellationToken ct = default);
}
