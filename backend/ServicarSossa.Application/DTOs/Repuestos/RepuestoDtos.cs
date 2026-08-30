using System.ComponentModel.DataAnnotations;

namespace ServicarSossa.Application.DTOs.Repuestos;

/// <summary>USU026 — alta de repuesto, con su stock inicial.</summary>
public class RepuestoRequestDto
{
    [Required(ErrorMessage = "El nombre del repuesto es obligatorio.")]
    [MaxLength(150)]
    public string Nombre { get; set; } = string.Empty;

    [MaxLength(255)]
    public string? Descripcion { get; set; }

    [Range(0, int.MaxValue, ErrorMessage = "El stock inicial no puede ser negativo.")]
    public int StockActual { get; set; }

    [Range(0, int.MaxValue, ErrorMessage = "El stock mínimo no puede ser negativo.")]
    public int StockMinimo { get; set; }

    /// <summary>Costo al que se compra (referencia manual; la compra lo actualiza sola).</summary>
    [Range(0, 99999999.99, ErrorMessage = "El precio de compra no puede ser negativo.")]
    public decimal PrecioCompra { get; set; }

    [Range(0, 99999999.99, ErrorMessage = "El precio de venta no puede ser negativo.")]
    public decimal PrecioVenta { get; set; }

    [RegularExpression(@"^PRO-\d{3,}$", ErrorMessage = "El proveedor debe tener el formato PRO-000.")]
    public string? ProveedorId { get; set; }
}

/// <summary>
/// USU027 — edición. No incluye <c>StockActual</c> a propósito: el stock se mueve
/// por compras (sube) y cierre de órdenes (baja), o por un ajuste explícito.
/// </summary>
public class RepuestoUpdateDto
{
    [Required(ErrorMessage = "El nombre del repuesto es obligatorio.")]
    [MaxLength(150)]
    public string Nombre { get; set; } = string.Empty;

    [MaxLength(255)]
    public string? Descripcion { get; set; }

    [Range(0, int.MaxValue, ErrorMessage = "El stock mínimo no puede ser negativo.")]
    public int StockMinimo { get; set; }

    [Range(0, 99999999.99, ErrorMessage = "El precio de compra no puede ser negativo.")]
    public decimal PrecioCompra { get; set; }

    [Range(0, 99999999.99, ErrorMessage = "El precio de venta no puede ser negativo.")]
    public decimal PrecioVenta { get; set; }

    [RegularExpression(@"^PRO-\d{3,}$", ErrorMessage = "El proveedor debe tener el formato PRO-000.")]
    public string? ProveedorId { get; set; }
}

/// <summary>
/// Ajuste manual de inventario (conteo físico, merma, rotura). Es la única vía
/// para fijar el stock a mano, y queda separada de la edición normal.
/// </summary>
public class AjustarStockDto
{
    [Range(0, int.MaxValue, ErrorMessage = "El stock no puede ser negativo.")]
    public int StockActual { get; set; }
}

/// <summary>Salida pública de un repuesto.</summary>
public class RepuestoResponseDto
{
    public string RepuestoId { get; set; } = string.Empty;
    public string Nombre { get; set; } = string.Empty;
    public string? Descripcion { get; set; }
    public int StockActual { get; set; }
    public int StockMinimo { get; set; }
    public decimal PrecioCompra { get; set; }
    public decimal PrecioVenta { get; set; }
    public string? ProveedorId { get; set; }
    public string? NombreProveedor { get; set; }

    /// <summary>Ruta pública de la foto del producto, o null si no tiene.</summary>
    public string? FotoUrl { get; set; }

    /// <summary>USU030 — true cuando el stock llegó al mínimo y toca reponer.</summary>
    public bool StockBajo => StockActual <= StockMinimo;

    /// <summary>Ganancia por unidad, para que se vea de un vistazo si el margen es razonable.</summary>
    public decimal Margen => PrecioVenta - PrecioCompra;

    /// <summary>Valor de reposición del inventario: lo que costaría volver a comprar el stock actual.</summary>
    public decimal ValorInventario => StockActual * PrecioCompra;
}
