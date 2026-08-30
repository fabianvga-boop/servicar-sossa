using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Domain.Entities;

/// <summary>
/// Tabla <c>facturas</c>. PK formato FAC-000. US038. El sistema no emite
/// comprobantes fiscales por SIAT: es el único documento de cobro del taller
/// (se muestra como "Proforma" en la interfaz).
/// </summary>
public class Factura
{
    public string FacturaId { get; set; } = string.Empty;    // FAC-001
    public string OrdenId { get; set; } = string.Empty;
    public DateTime FechaEmision { get; set; } = DateTime.UtcNow;
    public string? NitRazonSocial { get; set; }
    public decimal Total { get; set; }
    public EstadoFactura Estado { get; set; } = EstadoFactura.Emitida;

    // Navegación
    public OrdenTrabajo Orden { get; set; } = null!;
    public ICollection<Pago> Pagos { get; set; } = [];
}
