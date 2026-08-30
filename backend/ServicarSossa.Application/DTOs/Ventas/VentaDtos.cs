using System.ComponentModel.DataAnnotations;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.DTOs.Ventas;

/// <summary>
/// Punto de venta — venta de repuestos en mostrador. El total lo calcula el
/// backend desde las líneas (nunca se recibe del cliente) y el vendedor sale
/// del token, no del body.
/// </summary>
public class VentaRequestDto
{
    /// <summary>Opcional: el cliente de mostrador no siempre está registrado.</summary>
    [RegularExpression(@"^CLI-\d{3,}$", ErrorMessage = "El cliente debe tener el formato CLI-000.")]
    public string? ClienteId { get; set; }

    [Required(ErrorMessage = "El método de pago es obligatorio.")]
    public MetodoPago MetodoPago { get; set; } = MetodoPago.Efectivo;

    [MaxLength(255)]
    public string? Observaciones { get; set; }

    [Required(ErrorMessage = "La venta debe tener al menos un repuesto.")]
    [MinLength(1, ErrorMessage = "La venta debe tener al menos un repuesto.")]
    public List<VentaLineaRequestDto> Detalles { get; set; } = [];
}

public class VentaLineaRequestDto
{
    [Required(ErrorMessage = "El repuesto es obligatorio.")]
    [RegularExpression(@"^REP-\d{3,}$", ErrorMessage = "El repuesto debe tener el formato REP-000.")]
    public string RepuestoId { get; set; } = string.Empty;

    [Range(1, int.MaxValue, ErrorMessage = "La cantidad debe ser mayor a cero.")]
    public int Cantidad { get; set; }

    /// <summary>Si es null se usa el precio vigente del repuesto.</summary>
    [Range(0, 99999999.99, ErrorMessage = "El precio unitario no puede ser negativo.")]
    public decimal? PrecioUnitario { get; set; }
}

/// <summary>Salida pública de una venta, con su detalle.</summary>
public class VentaResponseDto
{
    public string VentaId { get; set; } = string.Empty;
    public string? ClienteId { get; set; }

    /// <summary>"Cliente de mostrador" cuando la venta no se ligó a un cliente.</summary>
    public string NombreCliente { get; set; } = string.Empty;

    public string UsuarioId { get; set; } = string.Empty;
    public string NombreUsuario { get; set; } = string.Empty;
    public DateTime FechaVenta { get; set; }
    public MetodoPago MetodoPago { get; set; }
    public decimal Total { get; set; }
    public EstadoVenta Estado { get; set; }
    public string? Observaciones { get; set; }
    public List<VentaLineaResponseDto> Detalles { get; set; } = [];

    public int CantidadArticulos => Detalles.Sum(d => d.Cantidad);
}

public class VentaLineaResponseDto
{
    public string VentaDetalleId { get; set; } = string.Empty;
    public string RepuestoId { get; set; } = string.Empty;
    public string NombreRepuesto { get; set; } = string.Empty;
    public string? FotoUrl { get; set; }
    public int Cantidad { get; set; }
    public decimal PrecioUnitario { get; set; }
    public decimal Subtotal { get; set; }
}

/// <summary>Totales del día para la caja del mostrador.</summary>
public class ResumenVentasDto
{
    public int CantidadVentas { get; set; }
    public decimal TotalVendido { get; set; }
    public int ArticulosVendidos { get; set; }
}
