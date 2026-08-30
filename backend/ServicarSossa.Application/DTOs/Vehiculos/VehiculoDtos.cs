using System.ComponentModel.DataAnnotations;

namespace ServicarSossa.Application.DTOs.Vehiculos;

/// <summary>USU009 — alta de vehículo. El ID lo genera la capa de aplicación.</summary>
public class VehiculoRequestDto
{
    [Required(ErrorMessage = "El cliente propietario es obligatorio.")]
    [RegularExpression(@"^CLI-\d{3,}$", ErrorMessage = "El cliente debe tener el formato CLI-000.")]
    public string ClienteId { get; set; } = string.Empty;

    [Required(ErrorMessage = "La placa es obligatoria.")]
    [MaxLength(15)]
    public string Placa { get; set; } = string.Empty;

    [Required(ErrorMessage = "La marca es obligatoria.")]
    [MaxLength(50)]
    public string Marca { get; set; } = string.Empty;

    [Required(ErrorMessage = "El modelo es obligatorio.")]
    [MaxLength(50)]
    public string Modelo { get; set; } = string.Empty;

    [Range(1900, 2100, ErrorMessage = "El año debe estar entre 1900 y 2100.")]
    public short? Anio { get; set; }

    [MaxLength(30)]
    public string? Color { get; set; }

    [MaxLength(50)]
    public string? NumMotor { get; set; }

    [MaxLength(50)]
    public string? NumChasis { get; set; }

    [Range(0, int.MaxValue, ErrorMessage = "El kilometraje no puede ser negativo.")]
    public int? Kilometraje { get; set; } = 0;
}

/// <summary>USU010 — edición de vehículo. El cliente propietario no se reasigna aquí.</summary>
public class VehiculoUpdateDto
{
    [Required(ErrorMessage = "La placa es obligatoria.")]
    [MaxLength(15)]
    public string Placa { get; set; } = string.Empty;

    [Required(ErrorMessage = "La marca es obligatoria.")]
    [MaxLength(50)]
    public string Marca { get; set; } = string.Empty;

    [Required(ErrorMessage = "El modelo es obligatorio.")]
    [MaxLength(50)]
    public string Modelo { get; set; } = string.Empty;

    [Range(1900, 2100, ErrorMessage = "El año debe estar entre 1900 y 2100.")]
    public short? Anio { get; set; }

    [MaxLength(30)]
    public string? Color { get; set; }

    [MaxLength(50)]
    public string? NumMotor { get; set; }

    [MaxLength(50)]
    public string? NumChasis { get; set; }

    [Range(0, int.MaxValue, ErrorMessage = "El kilometraje no puede ser negativo.")]
    public int? Kilometraje { get; set; }
}

/// <summary>Salida pública de un vehículo.</summary>
public class VehiculoResponseDto
{
    public string VehiculoId { get; set; } = string.Empty;
    public string ClienteId { get; set; } = string.Empty;
    public string NombreCliente { get; set; } = string.Empty;
    public string Placa { get; set; } = string.Empty;
    public string Marca { get; set; } = string.Empty;
    public string Modelo { get; set; } = string.Empty;
    public short? Anio { get; set; }
    public string? Color { get; set; }
    public string? NumMotor { get; set; }
    public string? NumChasis { get; set; }
    public int? Kilometraje { get; set; }
    public DateTime FechaRegistro { get; set; }
}

// --------------------------------------------------------------------- Fotos

/// <summary>Una foto de la galería del vehículo.</summary>
public class VehiculoFotoResponseDto
{
    public string FotoId { get; set; } = string.Empty;
    public string VehiculoId { get; set; } = string.Empty;

    /// <summary>Ruta pública para mostrarla u obtenerla, relativa al origen del backend.</summary>
    public string Url { get; set; } = string.Empty;

    public DateTime FechaSubida { get; set; }
}

// ----------------------------------------------------------------- Historial

/// <summary>
/// Trazabilidad de un vehículo: diagnósticos y órdenes intercalados por fecha,
/// con un resumen para verlo de un vistazo sin cruzar módulos a mano.
/// </summary>
public class HistorialVehiculoResponseDto
{
    public ResumenHistorialDto Resumen { get; set; } = new();
    public List<EventoHistorialDto> Eventos { get; set; } = [];
    /// <summary>Tipos de servicio más repetidos en este vehículo, de mayor a menor frecuencia.</summary>
    public List<ServicioFrecuenteDto> ServiciosFrecuentes { get; set; } = [];
}

public class ResumenHistorialDto
{
    public int TotalVisitas { get; set; }
    public decimal GastoAcumulado { get; set; }
    public DateTime? UltimaVisita { get; set; }
}

public class EventoHistorialDto
{
    public string Tipo { get; set; } = string.Empty;   // "Diagnostico" | "Orden"
    public string Id { get; set; } = string.Empty;
    public DateTime Fecha { get; set; }
    public string Estado { get; set; } = string.Empty;
    /// <summary>Falla del diagnóstico, o resumen del total de la orden.</summary>
    public string Detalle { get; set; } = string.Empty;
}

public class ServicioFrecuenteDto
{
    public string Nombre { get; set; } = string.Empty;
    public int Cantidad { get; set; }
}
