using System.ComponentModel.DataAnnotations;

namespace ServicarSossa.Application.DTOs.Compras;

/// <summary>
/// USU029 — registro de compra. Llega con su detalle completo: la compra y sus
/// líneas se crean en una sola operación, junto con el incremento de stock.
/// </summary>
public class CompraRequestDto
{
    [Required(ErrorMessage = "El proveedor es obligatorio.")]
    [RegularExpression(@"^PRO-\d{3,}$", ErrorMessage = "El proveedor debe tener el formato PRO-000.")]
    public string ProveedorId { get; set; } = string.Empty;

    [Required(ErrorMessage = "La compra debe tener al menos un repuesto.")]
    [MinLength(1, ErrorMessage = "La compra debe tener al menos un repuesto.")]
    public List<CompraDetalleRequestDto> Detalles { get; set; } = [];
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
}

/// <summary>Fila de la lista de compras.</summary>
public class CompraResponseDto
{
    public string CompraId { get; set; } = string.Empty;
    public string ProveedorId { get; set; } = string.Empty;
    public string NombreProveedor { get; set; } = string.Empty;
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
