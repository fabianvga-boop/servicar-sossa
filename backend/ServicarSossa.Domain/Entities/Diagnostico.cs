using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Domain.Entities;

/// <summary>Tabla <c>diagnosticos</c>. PK formato DIA-000.</summary>
public class Diagnostico
{
    public string DiagnosticoId { get; set; } = string.Empty;    // DIA-001
    public string VehiculoId { get; set; } = string.Empty;
    public string MecanicoId { get; set; } = string.Empty;
    public DateTime Fecha { get; set; } = DateTime.UtcNow;
    public string DescripcionFalla { get; set; } = string.Empty;
    public string? ObservacionesTecnicas { get; set; }           // US016
    public EstadoDiag Estado { get; set; } = EstadoDiag.Registrado;
    public DateTime? FechaModificacion { get; set; }             // US015

    /// <summary>Monto aproximado de la reparación que se presenta al cliente.</summary>
    public decimal? MontoEstimado { get; set; }

    /// <summary>Decisión del cliente sobre el presupuesto: gatea la creación de la orden.</summary>
    public RespuestaCliente RespuestaCliente { get; set; } = RespuestaCliente.Pendiente;
    public DateTime? FechaRespuestaCliente { get; set; }
    public string? ComentarioCliente { get; set; }

    // Navegación
    public Vehiculo Vehiculo { get; set; } = null!;
    public Usuario Mecanico { get; set; } = null!;
    public ICollection<OrdenServicio> OrdenServicios { get; set; } = [];

    /// <summary>Orden generada a partir de este diagnóstico, si ya se generó una.</summary>
    public OrdenTrabajo? Orden { get; set; }
}
