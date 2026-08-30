using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Domain.Entities;

/// <summary>Tabla <c>pagos</c>. PK formato PAG-000. US037.</summary>
public class Pago
{
    public string PagoId { get; set; } = string.Empty;       // PAG-001
    public string FacturaId { get; set; } = string.Empty;
    public decimal Monto { get; set; }                       // CHECK > 0
    public DateTime FechaPago { get; set; } = DateTime.UtcNow;
    public MetodoPago MetodoPago { get; set; }
    public string? Referencia { get; set; }

    // Navegación
    public Factura Factura { get; set; } = null!;
}
