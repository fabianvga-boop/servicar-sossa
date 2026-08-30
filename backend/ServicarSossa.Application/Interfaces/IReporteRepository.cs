using ServicarSossa.Domain.Entities;

namespace ServicarSossa.Application.Interfaces;

/// <summary>
/// Consultas de reportes. Devuelven proyecciones planas ya agregadas en la base,
/// para no traer entidades completas solo para sumarlas en memoria.
/// </summary>
public interface IReporteRepository
{
    /// <summary>USU017 — facturación cobrada y emitida en el periodo.</summary>
    Task<IEnumerable<FilaVentaDto>> VentasAsync(
        DateTime desde, DateTime hasta, CancellationToken ct = default);

    /// <summary>USU018 — comisiones generadas por mecánico en el periodo.</summary>
    Task<IEnumerable<FilaComisionDto>> ComisionesAsync(
        DateTime desde, DateTime hasta, CancellationToken ct = default);

    /// <summary>USU019 — estado actual del inventario (no depende del periodo).</summary>
    Task<IEnumerable<FilaInventarioDto>> InventarioAsync(CancellationToken ct = default);

    /// <summary>USU020 — órdenes de trabajo abiertas en el periodo.</summary>
    Task<IEnumerable<FilaOrdenDto>> OrdenesAsync(
        DateTime desde, DateTime hasta, CancellationToken ct = default);

    Task AgregarBitacoraAsync(ReporteGenerado reporte, CancellationToken ct = default);

    Task<IEnumerable<ReporteGenerado>> GetBitacoraAsync(
        string? tipoReporte, CancellationToken ct = default);

    Task<int> GuardarAsync(CancellationToken ct = default);
}

// ------------------------------------------------------------------ Proyecciones

public record FilaVentaDto(
    string FacturaId, DateTime FechaEmision, string Cliente, string Placa,
    decimal Total, decimal Pagado, string Estado);

public record FilaComisionDto(
    string MecanicoId, string Mecanico, int CantidadOrdenes,
    decimal TotalPendiente, decimal TotalPagado);

public record FilaInventarioDto(
    string RepuestoId, string Nombre, string? Proveedor,
    int StockActual, int StockMinimo, decimal PrecioCompra, decimal PrecioVenta);

public record FilaOrdenDto(
    string OrdenId, DateTime FechaCreacion, DateTime? FechaCierre, string Cliente,
    string Placa, string Estado, decimal TotalServicios, decimal TotalRepuestos);
