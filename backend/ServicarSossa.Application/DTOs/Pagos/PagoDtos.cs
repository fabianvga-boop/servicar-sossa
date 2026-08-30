using System.ComponentModel.DataAnnotations;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.DTOs.Pagos;

/// <summary>
/// USU037 — registro de un pago contra una factura. Admite pagos parciales:
/// la suma de todos no puede superar el total de la factura.
/// </summary>
public class PagoRequestDto
{
    [Required(ErrorMessage = "La factura es obligatoria.")]
    [RegularExpression(@"^FAC-\d{3,}$", ErrorMessage = "La factura debe tener el formato FAC-000.")]
    public string FacturaId { get; set; } = string.Empty;

    [Range(0.01, 99999999.99, ErrorMessage = "El monto debe ser mayor a cero.")]
    public decimal Monto { get; set; }

    [Required(ErrorMessage = "El método de pago es obligatorio.")]
    public MetodoPago MetodoPago { get; set; }

    /// <summary>Nº de transferencia, comprobante o referencia del QR.</summary>
    [MaxLength(100)]
    public string? Referencia { get; set; }
}

/// <summary>Salida pública de un pago.</summary>
public class PagoResponseDto
{
    public string PagoId { get; set; } = string.Empty;
    public string FacturaId { get; set; } = string.Empty;
    public string OrdenId { get; set; } = string.Empty;
    public string NombreCliente { get; set; } = string.Empty;
    public decimal Monto { get; set; }
    public DateTime FechaPago { get; set; }
    public MetodoPago MetodoPago { get; set; }
    public string? Referencia { get; set; }

    /// <summary>Estado de la factura después de este pago.</summary>
    public decimal TotalFactura { get; set; }
    public decimal TotalPagadoFactura { get; set; }
    public decimal SaldoPendienteFactura => TotalFactura - TotalPagadoFactura;
}
