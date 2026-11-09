namespace ServicarSossa.Domain.Entities;

/// <summary>
/// Tabla <c>vehiculo_fotos</c>: galería de fotos de un vehículo (opcional, para
/// documentar su estado al ingresar). PK formato FOT-000.
/// </summary>
public class VehiculoFoto
{
    public string FotoId { get; set; } = string.Empty;       // FOT-001
    public string VehiculoId { get; set; } = string.Empty;
    public string NombreArchivo { get; set; } = string.Empty; // nombre físico en disco
    public DateTime FechaSubida { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Trabajo de la orden al que pertenece la foto (evidencia de lo que se hizo).
    /// Null cuando es una foto general del vehículo (estado al ingresar).
    /// </summary>
    public string? OrdenServicioId { get; set; }

    // Navegación
    public Vehiculo Vehiculo { get; set; } = null!;
    public OrdenServicio? OrdenServicio { get; set; }
}
