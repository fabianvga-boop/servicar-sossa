using System.ComponentModel.DataAnnotations;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.DTOs.Facturas;

/// <summary>
/// Emisión de un comprobante FISCAL. Se factura una orden de trabajo o una
/// venta de mostrador, nunca las dos a la vez.
/// </summary>
public class FacturaRequestDto : IValidatableObject
{
    [RegularExpression(@"^ORD-\d{3,}$", ErrorMessage = "La orden debe tener el formato ORD-000.")]
    public string? OrdenId { get; set; }

    [RegularExpression(@"^VTA-\d{3,}$", ErrorMessage = "La venta debe tener el formato VTA-000.")]
    public string? VentaId { get; set; }

    [MaxLength(150)]
    public string? NitRazonSocial { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext contexto)
    {
        var tieneOrden = !string.IsNullOrWhiteSpace(OrdenId);
        var tieneVenta = !string.IsNullOrWhiteSpace(VentaId);

        if (tieneOrden == tieneVenta)
            yield return new ValidationResult(
                "Indique exactamente un origen: una orden de trabajo o una venta de mostrador.",
                [nameof(OrdenId), nameof(VentaId)]);
    }
}

/// <summary>Salida pública de una factura, con su situación ante el SIN.</summary>
public class FacturaResponseDto
{
    public string FacturaId { get; set; } = string.Empty;

    public string? OrdenId { get; set; }
    public string? VentaId { get; set; }

    public string PlacaVehiculo { get; set; } = string.Empty;
    public string NombreCliente { get; set; } = string.Empty;

    public DateTime FechaEmision { get; set; }
    public string? NitRazonSocial { get; set; }
    public decimal Total { get; set; }
    public EstadoFactura Estado { get; set; }

    // --- Situación fiscal ------------------------------------------------------

    public long? NumeroFactura { get; set; }
    public string? Cuf { get; set; }
    public string? CodigoRecepcion { get; set; }
    public EstadoSiat EstadoSiat { get; set; }
    public DateTime? FechaEmisionSiat { get; set; }
    public string? MensajeServicio { get; set; }

    /// <summary>true si el XML llegó a generarse (aunque todavía no se haya enviado).</summary>
    public bool TieneXml { get; set; }
}
