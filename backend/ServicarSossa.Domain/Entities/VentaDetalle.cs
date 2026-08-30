namespace ServicarSossa.Domain.Entities;

/// <summary>
/// Tabla <c>venta_detalle</c>: línea de una venta de mostrador. PK formato VDT-000.
/// El precio se congela al vender, igual que en <see cref="OrdenRepuesto"/>.
/// </summary>
public class VentaDetalle
{
    public string VentaDetalleId { get; set; } = string.Empty;  // VDT-001
    public string VentaId { get; set; } = string.Empty;
    public string RepuestoId { get; set; } = string.Empty;
    public int Cantidad { get; set; }
    public decimal PrecioUnitario { get; set; }

    /// <summary>Columna calculada en PostgreSQL (GENERATED ALWAYS AS ... STORED): solo lectura.</summary>
    public decimal Subtotal { get; private set; }

    // Navegación
    public Venta Venta { get; set; } = null!;
    public Repuesto Repuesto { get; set; } = null!;
}
