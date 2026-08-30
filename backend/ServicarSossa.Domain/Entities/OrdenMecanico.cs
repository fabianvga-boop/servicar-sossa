namespace ServicarSossa.Domain.Entities;

/// <summary>Tabla puente <c>orden_mecanicos</c> (ordenes_trabajo ↔ usuarios). PK compuesta. US022.</summary>
public class OrdenMecanico
{
    public string OrdenId { get; set; } = string.Empty;
    public string MecanicoId { get; set; } = string.Empty;
    public DateTime FechaAsignacion { get; set; } = DateTime.UtcNow;

    // Navegación
    public OrdenTrabajo Orden { get; set; } = null!;
    public Usuario Mecanico { get; set; } = null!;
}
