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

/// <summary>
/// Línea de detalle de la compra. Lleva un repuesto del inventario
/// (<see cref="RepuestoId"/>) o uno que se compra por primera vez
/// (<see cref="RepuestoNuevo"/>), que se crea junto con la compra.
/// </summary>
public class CompraDetalleRequestDto : IValidatableObject
{
    [RegularExpression(@"^REP-\d{3,}$", ErrorMessage = "El repuesto debe tener el formato REP-000.")]
    public string? RepuestoId { get; set; }

    /// <summary>
    /// Repuesto que todavía no está en el inventario. Se crea al registrar la
    /// compra, con el stock que entra en ella: así su kárdex arranca con la
    /// compra y no con un stock inicial sin respaldo.
    /// </summary>
    public RepuestoNuevoCompraDto? RepuestoNuevo { get; set; }

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

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        var existente = !string.IsNullOrWhiteSpace(RepuestoId);

        if (!existente && RepuestoNuevo is null)
            yield return new ValidationResult(
                "Cada línea de la compra debe indicar el repuesto.", [nameof(RepuestoId)]);

        if (existente && RepuestoNuevo is not null)
            yield return new ValidationResult(
                "Una línea lleva un repuesto del inventario o uno nuevo, no los dos.", [nameof(RepuestoId)]);

        // Un repuesto nuevo no tiene precio de venta anterior que conservar.
        if (RepuestoNuevo is not null && PrecioVenta is null)
            yield return new ValidationResult(
                $"Indique a cuánto se venderá el repuesto nuevo '{RepuestoNuevo.Nombre}'.",
                [nameof(PrecioVenta)]);
    }
}

/// <summary>
/// Lo mínimo para dar de alta un repuesto desde la compra. El resto toma un
/// valor por defecto (stock mínimo 1, uso general) y se ajusta después en
/// Repuestos: la foto, la descripción y los vehículos compatibles.
/// </summary>
public class RepuestoNuevoCompraDto
{
    [Required(ErrorMessage = "El nombre del repuesto nuevo es obligatorio.")]
    [MaxLength(150, ErrorMessage = "El nombre del repuesto no puede superar los 150 caracteres.")]
    public string Nombre { get; set; } = string.Empty;

    [RegularExpression(@"^CAT-\d{3,}$", ErrorMessage = "La categoría debe tener el formato CAT-000.")]
    public string? CategoriaId { get; set; }
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
