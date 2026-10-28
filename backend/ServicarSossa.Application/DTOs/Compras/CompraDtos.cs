using System.ComponentModel.DataAnnotations;

namespace ServicarSossa.Application.DTOs.Compras;

/// <summary>
/// USU029 — registro de compra. Llega con su detalle completo: la compra y sus
/// líneas se crean en una sola operación, junto con el incremento de stock.
/// Con <see cref="Ocasional"/> no lleva proveedor (a quien no se tienen o no
/// conviene guardar los datos); el resto es igual a una compra común.
/// </summary>
public class CompraRequestDto : IValidatableObject
{
    public bool Ocasional { get; set; }

    /// <summary>Obligatorio salvo en una compra ocasional, que no lo lleva.</summary>
    [RegularExpression(@"^PRO-\d{3,}$", ErrorMessage = "El proveedor debe tener el formato PRO-000.")]
    public string? ProveedorId { get; set; }

    /// <summary>Opcional, sobre todo en la ocasional: a quién o dónde se compró.</summary>
    [MaxLength(150, ErrorMessage = "La referencia no puede superar los 150 caracteres.")]
    public string? Referencia { get; set; }

    [Required(ErrorMessage = "La compra debe tener al menos un repuesto.")]
    [MinLength(1, ErrorMessage = "La compra debe tener al menos un repuesto.")]
    public List<CompraDetalleRequestDto> Detalles { get; set; } = [];

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (!Ocasional && string.IsNullOrWhiteSpace(ProveedorId))
            yield return new ValidationResult(
                "El proveedor es obligatorio. Si no tiene sus datos, registre una compra ocasional.",
                [nameof(ProveedorId)]);

        if (Ocasional && !string.IsNullOrWhiteSpace(ProveedorId))
            yield return new ValidationResult(
                "Una compra ocasional no lleva proveedor.", [nameof(ProveedorId)]);
    }
}

/// <summary>Línea de detalle de la compra.</summary>
public class CompraDetalleRequestDto
{
    [Required(ErrorMessage = "El repuesto es obligatorio.")]
    [RegularExpression(@"^REP-\d{3,}$", ErrorMessage = "El repuesto debe tener el formato REP-000.")]
    public string RepuestoId { get; set; } = string.Empty;

    [Range(1, int.MaxValue, ErrorMessage = "La cantidad debe ser mayor a cero.")]
    public int Cantidad { get; set; }

    [Range(0, 99999999.99, ErrorMessage = "El precio unitario no puede ser negativo.")]
    public decimal PrecioUnitario { get; set; }

    /// <summary>
    /// Opcional: nuevo precio de venta del repuesto. Al comprar suele saberse
    /// también a cuánto se va a vender; si viene y es distinto, el repuesto
    /// queda con este precio (y el cambio, en auditoría).
    /// </summary>
    [Range(0, 99999999.99, ErrorMessage = "El precio de venta no puede ser negativo.")]
    public decimal? PrecioVenta { get; set; }
}

/// <summary>Fila de la lista de compras.</summary>
public class CompraResponseDto
{
    public string CompraId { get; set; } = string.Empty;

    /// <summary>Null en una compra ocasional.</summary>
    public string? ProveedorId { get; set; }

    /// <summary>Nombre del proveedor, o "Compra ocasional".</summary>
    public string NombreProveedor { get; set; } = string.Empty;

    public bool Ocasional { get; set; }
    public string? Referencia { get; set; }
    public string UsuarioId { get; set; } = string.Empty;
    public string NombreUsuario { get; set; } = string.Empty;
    public DateTime Fecha { get; set; }
    public decimal Total { get; set; }
    public int CantidadLineas { get; set; }
}

/// <summary>Compra con su detalle completo.</summary>
public class CompraDetalleResponseDto : CompraResponseDto
{
    public List<CompraLineaResponseDto> Detalles { get; set; } = [];
}

public class CompraLineaResponseDto
{
    public string DetalleId { get; set; } = string.Empty;
    public string RepuestoId { get; set; } = string.Empty;
    public string NombreRepuesto { get; set; } = string.Empty;
    public int Cantidad { get; set; }
    public decimal PrecioUnitario { get; set; }
    public decimal Subtotal { get; set; }
}
