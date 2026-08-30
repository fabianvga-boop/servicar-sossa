namespace ServicarSossa.Domain.Entities;

/// <summary>
/// Tabla <c>repuestos</c>. PK formato REP-000.
/// <see cref="StockActual"/> tiene CHECK &gt;= 0 en la BD: el servicio debe validar
/// disponibilidad antes de consumir stock en una orden.
/// </summary>
public class Repuesto
{
    public string RepuestoId { get; set; } = string.Empty;   // REP-001
    public string Nombre { get; set; } = string.Empty;
    public string? Descripcion { get; set; }
    public int StockActual { get; set; }
    public int StockMinimo { get; set; }

    /// <summary>Costo al que se compra (manual, o actualizado por la última compra).</summary>
    public decimal PrecioCompra { get; set; }

    /// <summary>Precio al que se vende. Es el que se usa en órdenes y en el punto de venta.</summary>
    public decimal PrecioVenta { get; set; }

    public string? ProveedorId { get; set; }

    /// <summary>
    /// Nombre físico de la foto del producto en disco (opcional). Una sola por
    /// repuesto: sirve para reconocerlo de un vistazo al venderlo en mostrador.
    /// </summary>
    public string? NombreArchivoFoto { get; set; }

    // Navegación
    public Proveedor? Proveedor { get; set; }
    public ICollection<CompraDetalle> CompraDetalles { get; set; } = [];
    public ICollection<OrdenRepuesto> OrdenRepuestos { get; set; } = [];
    public ICollection<VentaDetalle> VentaDetalles { get; set; } = [];
}
