using System.ComponentModel.DataAnnotations;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.DTOs.Diagnosticos;

/// <summary>
/// USU012 — registro de diagnóstico. El mecánico se toma del token, no del body,
/// para que nadie pueda registrar un diagnóstico a nombre de otro.
/// </summary>
public class DiagnosticoRequestDto
{
    [Required(ErrorMessage = "El vehículo es obligatorio.")]
    [RegularExpression(@"^VEH-\d{3,}$", ErrorMessage = "El vehículo debe tener el formato VEH-000.")]
    public string VehiculoId { get; set; } = string.Empty;

    [Required(ErrorMessage = "La descripción de la falla es obligatoria.")]
    public string DescripcionFalla { get; set; } = string.Empty;

    /// <summary>USU016 — observaciones técnicas del mecánico.</summary>
    public string? ObservacionesTecnicas { get; set; }

    /// <summary>Monto aproximado de la reparación para presentarle al cliente (opcional al registrar).</summary>
    [Range(0, 99999999.99, ErrorMessage = "El monto estimado no puede ser negativo.")]
    public decimal? MontoEstimado { get; set; }
}

/// <summary>USU015, USU016 — edición del diagnóstico. Marca fecha_modificacion.</summary>
public class DiagnosticoUpdateDto
{
    [Required(ErrorMessage = "La descripción de la falla es obligatoria.")]
    public string DescripcionFalla { get; set; } = string.Empty;

    /// <summary>USU016 — observaciones técnicas del mecánico.</summary>
    public string? ObservacionesTecnicas { get; set; }

    /// <summary>Monto aproximado de la reparación. Solo editable mientras el cliente no responda.</summary>
    [Range(0, 99999999.99, ErrorMessage = "El monto estimado no puede ser negativo.")]
    public decimal? MontoEstimado { get; set; }
}

/// <summary>Cambia el estado del diagnóstico (Registrado → Revisado / Anulado).</summary>
public class CambiarEstadoDiagnosticoDto
{
    [Required(ErrorMessage = "El estado es obligatorio.")]
    public EstadoDiag Estado { get; set; }
}

/// <summary>
/// Registra la respuesta del cliente al presupuesto aproximado. Solo se puede
/// responder una vez y exige que el diagnóstico ya tenga monto estimado.
/// </summary>
public class ResponderDiagnosticoDto
{
    [Required(ErrorMessage = "La respuesta del cliente es obligatoria.")]
    public RespuestaCliente Respuesta { get; set; }

    [MaxLength(255, ErrorMessage = "El comentario no puede superar los 255 caracteres.")]
    public string? ComentarioCliente { get; set; }
}

/// <summary>Salida pública de un diagnóstico, con los datos del vehículo y su mecánico.</summary>
public class DiagnosticoResponseDto
{
    public string DiagnosticoId { get; set; } = string.Empty;
    public string VehiculoId { get; set; } = string.Empty;
    public string PlacaVehiculo { get; set; } = string.Empty;
    public string DescripcionVehiculo { get; set; } = string.Empty;
    public string ClienteId { get; set; } = string.Empty;
    public string NombreCliente { get; set; } = string.Empty;
    public string MecanicoId { get; set; } = string.Empty;
    public string NombreMecanico { get; set; } = string.Empty;
    public DateTime Fecha { get; set; }
    public string DescripcionFalla { get; set; } = string.Empty;
    public string? ObservacionesTecnicas { get; set; }
    public EstadoDiag Estado { get; set; }
    public DateTime? FechaModificacion { get; set; }

    /// <summary>Presupuesto aproximado presentado al cliente.</summary>
    public decimal? MontoEstimado { get; set; }
    public RespuestaCliente RespuestaCliente { get; set; }
    public DateTime? FechaRespuestaCliente { get; set; }
    public string? ComentarioCliente { get; set; }

    /// <summary>Orden generada a partir de este diagnóstico, si ya se generó una.</summary>
    public string? OrdenId { get; set; }
}

// ------------------------------------------------------- Diagnóstico asistido

/// <summary>
/// Sugerencias de servicios, repuestos y precio para una falla reportada,
/// calculadas a partir de diagnósticos históricos con una descripción similar
/// que sí llegaron a convertirse en orden de trabajo. Sin IA externa: la
/// similitud se calcula por coincidencia de palabras clave (ver
/// <c>DiagnosticoService.CalcularSimilitud</c>), así que el resultado es
/// siempre explicable ("se basó en estos N casos parecidos").
/// </summary>
public class SugerenciaDiagnosticoDto
{
    /// <summary>Cuántos diagnósticos históricos similares se usaron para calcular esto.</summary>
    public int BasadoEnCasos { get; set; }

    public List<SugerenciaServicioDto> Servicios { get; set; } = [];
    public List<SugerenciaRepuestoDto> Repuestos { get; set; } = [];

    public decimal? PrecioMinimo { get; set; }
    public decimal? PrecioMaximo { get; set; }
    public decimal? PrecioPromedio { get; set; }

    /// <summary>Los casos históricos que más se parecen, más similar primero.</summary>
    public List<CasoSimilarDto> CasosSimilares { get; set; } = [];
}

public class SugerenciaServicioDto
{
    /// <summary>Null cuando el servicio no proviene del catálogo (se registró suelto).</summary>
    public string? ServicioId { get; set; }
    public string Nombre { get; set; } = string.Empty;

    /// <summary>En cuántos de los casos similares apareció este servicio.</summary>
    public int Frecuencia { get; set; }

    /// <summary>Frecuencia / BasadoEnCasos, en porcentaje (0-100).</summary>
    public double Porcentaje { get; set; }
    public decimal PrecioPromedio { get; set; }
}

public class SugerenciaRepuestoDto
{
    /// <summary>Null cuando el repuesto no proviene del inventario.</summary>
    public string? RepuestoId { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public int Frecuencia { get; set; }
    public double Porcentaje { get; set; }
    public decimal PrecioUnitarioPromedio { get; set; }
}

public class CasoSimilarDto
{
    public string DiagnosticoId { get; set; } = string.Empty;
    public string DescripcionFalla { get; set; } = string.Empty;

    /// <summary>0 a 1: qué tan parecida es la falla reportada a esta.</summary>
    public double Similitud { get; set; }
}
