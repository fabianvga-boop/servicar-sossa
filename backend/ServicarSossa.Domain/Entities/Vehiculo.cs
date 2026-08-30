namespace ServicarSossa.Domain.Entities;

/// <summary>Tabla <c>vehiculos</c>. PK formato VEH-000.</summary>
public class Vehiculo
{
    public string VehiculoId { get; set; } = string.Empty;   // VEH-001
    public string ClienteId { get; set; } = string.Empty;
    public string Placa { get; set; } = string.Empty;        // UNIQUE
    public string Marca { get; set; } = string.Empty;
    public string Modelo { get; set; } = string.Empty;
    public short? Anio { get; set; }
    public string? Color { get; set; }
    public string? NumMotor { get; set; }
    public string? NumChasis { get; set; }
    public int? Kilometraje { get; set; } = 0;
    public DateTime FechaRegistro { get; set; } = DateTime.UtcNow;

    // Navegación
    public Cliente Cliente { get; set; } = null!;
    public ICollection<Diagnostico> Diagnosticos { get; set; } = [];
    public ICollection<OrdenTrabajo> OrdenesTrabajo { get; set; } = [];
    public ICollection<VehiculoFoto> Fotos { get; set; } = [];
}
