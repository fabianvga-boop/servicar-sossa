using System.ComponentModel.DataAnnotations;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.DTOs.Comisiones;

// ============================================================ CONFIGURACIÓN

/// <summary>
/// USU031 — fija el porcentaje de comisión de un mecánico. La tabla tiene
/// UNIQUE sobre mecanico_id, así que la operación es un upsert: si ya existe
/// configuración se actualiza, si no se crea.
/// </summary>
public class ComisionConfigRequestDto
{
    [Range(0, 100, ErrorMessage = "El porcentaje debe estar entre 0 y 100.")]
    public decimal Porcentaje { get; set; }
}

public class ComisionConfigResponseDto
{
    public string ConfigId { get; set; } = string.Empty;
    public string MecanicoId { get; set; } = string.Empty;
    public string NombreMecanico { get; set; } = string.Empty;
    public decimal Porcentaje { get; set; }
    public DateTime FechaActualizacion { get; set; }
}

// ================================================================ COMISIONES

/// <summary>USU034 — marca una o varias comisiones como pagadas (liquidación).</summary>
public class PagarComisionesLoteDto
{
    [Required(ErrorMessage = "Debe indicar al menos una comisión.")]
    [MinLength(1, ErrorMessage = "Debe indicar al menos una comisión.")]
    public List<string> ComisionIds { get; set; } = [];

    /// <summary>
    /// Monto de adelantos ya entregados al mecánico durante la semana, que se
    /// descuenta del total a pagar. Solo se admite cuando la planilla es de un
    /// único mecánico. No se persiste como registro aparte: queda en el desglose.
    /// </summary>
    [Range(0, 99999999.99, ErrorMessage = "El adelanto no puede ser negativo.")]
    public decimal AdelantoDescontado { get; set; }
}

/// <summary>Desglose de una liquidación pagada: bruto, adelanto y neto.</summary>
public class LiquidacionResultadoDto
{
    public int CantidadComisiones { get; set; }
    public decimal TotalBruto { get; set; }
    public decimal AdelantoDescontado { get; set; }
    public decimal NetoPagado { get; set; }
    public List<ComisionResponseDto> Comisiones { get; set; } = [];
}

public class ComisionResponseDto
{
    public string ComisionId { get; set; } = string.Empty;
    public string OrdenId { get; set; } = string.Empty;
    public string PlacaVehiculo { get; set; } = string.Empty;
    public string MecanicoId { get; set; } = string.Empty;
    public string NombreMecanico { get; set; } = string.Empty;
    public decimal Monto { get; set; }
    public DateTime FechaCalculo { get; set; }
    public EstadoPago EstadoPago { get; set; }
    public DateTime? FechaPago { get; set; }

    /// <summary>
    /// Servicios del mecánico en esa orden que componen el monto de la comisión.
    /// La comisión se calcula una por (orden, mecánico) sobre la suma de estos precios.
    /// </summary>
    public List<ComisionDetalleServicioDto> Detalle { get; set; } = [];
}

/// <summary>Un servicio puntual que aportó al monto de una comisión.</summary>
public class ComisionDetalleServicioDto
{
    public string OrdenServicioId { get; set; } = string.Empty;
    public string NombreServicio { get; set; } = string.Empty;
    public string? Descripcion { get; set; }
    public decimal Precio { get; set; }
}

/// <summary>USU033 — totales por mecánico para la liquidación del periodo.</summary>
public class ResumenComisionesDto
{
    public string MecanicoId { get; set; } = string.Empty;
    public string NombreMecanico { get; set; } = string.Empty;
    public decimal? PorcentajeConfigurado { get; set; }
    public int CantidadComisiones { get; set; }
    public decimal TotalPendiente { get; set; }
    public decimal TotalPagado { get; set; }
    public decimal TotalGeneral => TotalPendiente + TotalPagado;
}
