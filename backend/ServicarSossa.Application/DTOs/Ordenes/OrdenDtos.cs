using System.ComponentModel.DataAnnotations;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.DTOs.Ordenes;

/// <summary>
/// USU021 — apertura de orden. Nace siempre de un diagnóstico: vehículo y
/// cliente se deducen de él (evita inconsistencias y órdenes sin motivo
/// registrado) y el administrador sale del token.
/// </summary>
public class OrdenRequestDto
{
    [Required(ErrorMessage = "El diagnóstico de origen es obligatorio.")]
    [RegularExpression(@"^DIA-\d{3,}$", ErrorMessage = "El diagnóstico debe tener el formato DIA-000.")]
    public string DiagnosticoId { get; set; } = string.Empty;

    public DateOnly? FechaEstimada { get; set; }

    public string? Observaciones { get; set; }
}

/// <summary>USU021 — edición de los datos generales de la orden.</summary>
public class OrdenUpdateDto
{
    public DateOnly? FechaEstimada { get; set; }

    public string? Observaciones { get; set; }
}

/// <summary>USU024, USU025 — avance del estado de la orden.</summary>
public class CambiarEstadoOrdenDto
{
    [Required(ErrorMessage = "El estado es obligatorio.")]
    public EstadoOrden Estado { get; set; }
}

/// <summary>Fila de la lista de órdenes.</summary>
public class OrdenResponseDto
{
    public string OrdenId { get; set; } = string.Empty;
    public string VehiculoId { get; set; } = string.Empty;
    public string PlacaVehiculo { get; set; } = string.Empty;
    public string DescripcionVehiculo { get; set; } = string.Empty;
    public string ClienteId { get; set; } = string.Empty;
    public string NombreCliente { get; set; } = string.Empty;
    public string AdministradorId { get; set; } = string.Empty;
    public string NombreAdministrador { get; set; } = string.Empty;

    /// <summary>Diagnóstico de origen. Null solo en órdenes previas a esta regla.</summary>
    public string? DiagnosticoId { get; set; }
    public string? DescripcionFalla { get; set; }
    public string? ObservacionesTecnicasDiagnostico { get; set; }

    public DateTime FechaCreacion { get; set; }
    public DateOnly? FechaEstimada { get; set; }
    public DateTime? FechaCierre { get; set; }
    public EstadoOrden Estado { get; set; }
    public string? Observaciones { get; set; }
    public decimal TotalServicios { get; set; }
    public decimal TotalRepuestos { get; set; }
    public decimal Total => TotalServicios + TotalRepuestos;
    public int CantidadMecanicos { get; set; }

    /// <summary>
    /// Quiénes están asignados. Va también en la fila de la lista —y no solo
    /// en el detalle— porque la consulta ya trae los mecánicos con su nombre
    /// (ver OrdenRepository.ConIncludes): mandar solo el conteo desperdiciaba
    /// un dato que ya había viajado desde la base.
    /// </summary>
    public List<OrdenMecanicoResponseDto> Mecanicos { get; set; } = [];
}

/// <summary>Vista completa de la orden con sus tres detalles.</summary>
public class OrdenDetalleResponseDto : OrdenResponseDto
{
    public List<OrdenServicioResponseDto> Servicios { get; set; } = [];
    public List<OrdenRepuestoResponseDto> Repuestos { get; set; } = [];
}
