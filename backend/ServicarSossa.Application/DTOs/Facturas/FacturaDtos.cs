using System.ComponentModel.DataAnnotations;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.DTOs.Facturas;

/// <summary>
/// USU038 — emisión de factura. El total se calcula del sistema a partir del
/// detalle de la orden (servicios + repuestos); nunca se recibe del cliente.
/// </summary>
public class FacturaRequestDto
{
    [Required(ErrorMessage = "La orden es obligatoria.")]
    [RegularExpression(@"^ORD-\d{3,}$", ErrorMessage = "La orden debe tener el formato ORD-000.")]
    public string OrdenId { get; set; } = string.Empty;

    [MaxLength(150)]
    public string? NitRazonSocial { get; set; }
}

/// <summary>Salida pública de una factura, con su estado de cobranza.</summary>
public class FacturaResponseDto
{
    public string FacturaId { get; set; } = string.Empty;
    public string OrdenId { get; set; } = string.Empty;
    public string PlacaVehiculo { get; set; } = string.Empty;
    public string ClienteId { get; set; } = string.Empty;
    public string NombreCliente { get; set; } = string.Empty;
    public DateTime FechaEmision { get; set; }
    public string? NitRazonSocial { get; set; }
    public decimal Total { get; set; }
    public EstadoFactura Estado { get; set; }

    public decimal TotalPagado { get; set; }
    public decimal SaldoPendiente => Total - TotalPagado;
    public bool EstaSaldada => SaldoPendiente <= 0;
}
