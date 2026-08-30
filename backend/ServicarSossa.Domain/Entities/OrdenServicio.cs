using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Domain.Entities;

/// <summary>
/// Tabla <c>orden_servicios</c>: detalle de servicios ejecutados en una orden (US013, US023).
/// PK formato OSR-000. La suma de <see cref="Precio"/> por mecánico es la base del
/// cálculo de comisiones al cerrar la orden.
/// Un servicio puede venir del catálogo (<see cref="ServicioId"/>) o registrarse
/// suelto con <see cref="NombreLibre"/> cuando el trabajo no está catalogado.
/// </summary>
public class OrdenServicio
{
    public string OrdenServicioId { get; set; } = string.Empty;  // OSR-001
    public string OrdenId { get; set; } = string.Empty;

    /// <summary>Null cuando el servicio no proviene del catálogo.</summary>
    public string? ServicioId { get; set; }

    /// <summary>Nombre libre del servicio cuando no está en el catálogo.</summary>
    public string? NombreLibre { get; set; }

    public string? DiagnosticoId { get; set; }
    public string MecanicoId { get; set; } = string.Empty;
    public string? Descripcion { get; set; }
    public decimal Precio { get; set; }
    public EstadoServicioOrden Estado { get; set; } = EstadoServicioOrden.Pendiente;

    // Navegación
    public OrdenTrabajo Orden { get; set; } = null!;

    /// <summary>Null cuando el servicio no proviene del catálogo.</summary>
    public TipoServicio? Servicio { get; set; }
    public Diagnostico? Diagnostico { get; set; }
    public Usuario Mecanico { get; set; } = null!;
}
