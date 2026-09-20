using System.ComponentModel.DataAnnotations;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.DTOs.Proformas;

/// <summary>
/// USU038 — emisión de la proforma de cobro. El total lo calcula el sistema a
/// partir del detalle de la orden (servicios + repuestos); nunca se recibe del
/// cliente.
/// </summary>
public class ProformaRequestDto
{
    [Required(ErrorMessage = "La orden es obligatoria.")]
    [RegularExpression(@"^ORD-\d{3,}$", ErrorMessage = "La orden debe tener el formato ORD-000.")]
    public string OrdenId { get; set; } = string.Empty;

    [MaxLength(150)]
    public string? NitRazonSocial { get; set; }
}

/// <summary>Salida pública de una proforma, con su estado de cobranza.</summary>
public class ProformaResponseDto
{
    public string ProformaId { get; set; } = string.Empty;
    public string OrdenId { get; set; } = string.Empty;
    public string PlacaVehiculo { get; set; } = string.Empty;
    public string ClienteId { get; set; } = string.Empty;
    public string NombreCliente { get; set; } = string.Empty;
    public DateTime FechaEmision { get; set; }
    public string? NitRazonSocial { get; set; }
    public decimal Total { get; set; }
    public EstadoProforma Estado { get; set; }

    public decimal TotalPagado { get; set; }
    public decimal SaldoPendiente => Total - TotalPagado;
    public bool EstaSaldada => SaldoPendiente <= 0;
}
