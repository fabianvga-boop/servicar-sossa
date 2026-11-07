using ServicarSossa.Domain.Entities;

namespace ServicarSossa.Application.Interfaces;

/// <summary>
/// Consultas de reportes. Devuelven proyecciones planas ya agregadas en la base,
/// para no traer entidades completas solo para sumarlas en memoria.
/// </summary>
public interface IReporteRepository
{
    /// <summary>USU017 — proformas de órdenes y ventas de mostrador del periodo.</summary>
    Task<IEnumerable<FilaVentaDto>> VentasAsync(
        DateTime desde, DateTime hasta, CancellationToken ct = default);

    /// <summary>
    /// Detalle de ventas: una fila por servicio o repuesto vendido en el periodo,
    /// de proformas vigentes y ventas de mostrador no anuladas.
    /// </summary>
    Task<IEnumerable<FilaDetalleVentaDto>> DetalleVentasAsync(
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

    Task<(IEnumerable<ReporteGenerado> Items, int Total)> GetBitacoraAsync(
        string? tipoReporte, int pagina, int tamanoPagina, CancellationToken ct = default);

    Task<int> GuardarAsync(CancellationToken ct = default);
}

// ------------------------------------------------------------------ Proyecciones

/// <summary>Una proforma de orden, o una venta de mostrador (sin placa).</summary>
public record FilaVentaDto(
    string Documento, DateTime FechaEmision, string Cliente, string? Placa,
    decimal Total, decimal Pagado, string Estado);

/// <summary>Una línea vendida. Tipo: "Servicio" o "Repuesto".</summary>
public record FilaDetalleVentaDto(
    DateTime Fecha, string Documento, string Cliente, string Tipo,
    string Descripcion, int Cantidad, decimal PrecioUnitario);

public record FilaComisionDto(
    string MecanicoId, string Mecanico, int CantidadOrdenes,
    decimal TotalPendiente, decimal TotalPagado);

public record FilaInventarioDto(
    string RepuestoId, string Nombre, string? Proveedor,
    int StockActual, int StockMinimo, decimal PrecioCompra, decimal PrecioVenta);

public record FilaOrdenDto(
    string OrdenId, DateTime FechaCreacion, DateTime? FechaCierre, string Cliente,
    string Placa, string Estado, decimal TotalServicios, decimal TotalRepuestos);
