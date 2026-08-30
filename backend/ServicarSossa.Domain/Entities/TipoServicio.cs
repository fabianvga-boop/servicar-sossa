using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Domain.Entities;

/// <summary>Tabla <c>tipos_servicio</c> (catálogo). PK formato SER-000.</summary>
public class TipoServicio
{
    public string ServicioId { get; set; } = string.Empty;   // SER-001
    public string Nombre { get; set; } = string.Empty;
    public string? Descripcion { get; set; }
    public decimal PrecioBase { get; set; }
    public EstadoServicio Estado { get; set; } = EstadoServicio.Activo;

    // Navegación
    public ICollection<OrdenServicio> OrdenServicios { get; set; } = [];
}
