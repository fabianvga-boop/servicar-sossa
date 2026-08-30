namespace ServicarSossa.Domain.Entities;

/// <summary>Tabla <c>compra_detalle</c>. PK formato DET-000.</summary>
public class CompraDetalle
{
    public string DetalleId { get; set; } = string.Empty;    // DET-001
    public string CompraId { get; set; } = string.Empty;
    public string RepuestoId { get; set; } = string.Empty;
    public int Cantidad { get; set; }
    public decimal PrecioUnitario { get; set; }

    /// <summary>Columna calculada en PostgreSQL (GENERATED ALWAYS AS ... STORED): solo lectura.</summary>
    public decimal Subtotal { get; private set; }

    // Navegación
    public Compra Compra { get; set; } = null!;
    public Repuesto Repuesto { get; set; } = null!;
}
