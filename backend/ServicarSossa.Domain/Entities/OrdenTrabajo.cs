using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Domain.Entities;

/// <summary>Tabla <c>ordenes_trabajo</c>. PK formato ORD-000.</summary>
public class OrdenTrabajo
{
    public string OrdenId { get; set; } = string.Empty;      // ORD-001
    public string VehiculoId { get; set; } = string.Empty;
    public string ClienteId { get; set; } = string.Empty;
    public string AdministradorId { get; set; } = string.Empty;

    /// <summary>
    /// Diagnóstico que originó esta orden. Toda orden nace de un diagnóstico
    /// (regla de negocio: evita abrir trabajo sin un motivo registrado y sin
    /// revisar antes si el vehículo ya tiene algo pendiente). Nullable solo
    /// porque las órdenes creadas antes de esta regla no lo tienen.
    /// </summary>
    public string? DiagnosticoId { get; set; }

    public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;
    public DateOnly? FechaEstimada { get; set; }
    public DateTime? FechaCierre { get; set; }
    public EstadoOrden Estado { get; set; } = EstadoOrden.Abierta;
    public string? Observaciones { get; set; }

    // Navegación
    public Vehiculo Vehiculo { get; set; } = null!;
    public Diagnostico? Diagnostico { get; set; }
    public Cliente Cliente { get; set; } = null!;
    public Usuario Administrador { get; set; } = null!;
    public ICollection<OrdenMecanico> Mecanicos { get; set; } = [];
    public ICollection<OrdenServicio> Servicios { get; set; } = [];
    public ICollection<OrdenRepuesto> Repuestos { get; set; } = [];
    public ICollection<Comision> Comisiones { get; set; } = [];
    public ICollection<Factura> Facturas { get; set; } = [];
}
