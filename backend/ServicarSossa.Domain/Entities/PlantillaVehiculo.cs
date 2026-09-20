namespace ServicarSossa.Domain.Entities;

/// <summary>
/// Tabla <c>plantillas_vehiculo</c>: diagrama vectorial (SVG) específico para
/// una combinación Marca+Modelo real del taller — la "biblioteca de diseños
/// por vehículo". Cuando no hay plantilla para un vehículo, el frontend cae
/// al diagrama genérico por tipo de carrocería. PK formato PLV-000.
/// </summary>
public class PlantillaVehiculo
{
    public string PlantillaId { get; set; } = string.Empty;   // PLV-001
    public string Marca { get; set; } = string.Empty;
    public string Modelo { get; set; } = string.Empty;
    public string NombreArchivo { get; set; } = string.Empty; // el .svg guardado en disco
    public DateTime FechaSubida { get; set; } = DateTime.UtcNow;
}
