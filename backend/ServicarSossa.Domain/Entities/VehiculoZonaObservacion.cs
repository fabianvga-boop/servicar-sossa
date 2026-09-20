using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Domain.Entities;

/// <summary>
/// Tabla <c>vehiculo_zonas</c>: estado marcado sobre una zona del diagrama
/// vectorial del vehículo (capó, puertas, parachoques, ...). Cada registro es
/// un evento nuevo, no una fila que se sobreescribe: así queda historial de
/// qué se marcó en cada orden. PK formato ZNA-000.
/// </summary>
public class VehiculoZonaObservacion
{
    public string ZonaObsId { get; set; } = string.Empty;   // ZNA-001
    public string VehiculoId { get; set; } = string.Empty;
    public string? OrdenId { get; set; }
    public string Zona { get; set; } = string.Empty;        // capo, parabrisas, puerta_del_izq, ...
    public EstadoZonaVehiculo Estado { get; set; }
    public string? Detalle { get; set; }
    public DateTime FechaRegistro { get; set; } = DateTime.UtcNow;

    // Navegación
    public Vehiculo Vehiculo { get; set; } = null!;
    public OrdenTrabajo? Orden { get; set; }
}
