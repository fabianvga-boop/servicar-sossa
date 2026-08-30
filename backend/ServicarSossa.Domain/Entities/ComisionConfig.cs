namespace ServicarSossa.Domain.Entities;

/// <summary>Tabla <c>comisiones_config</c>: porcentaje de comisión por mecánico. PK formato CCF-000.</summary>
public class ComisionConfig
{
    public string ConfigId { get; set; } = string.Empty;     // CCF-001
    public string MecanicoId { get; set; } = string.Empty;   // UNIQUE
    public decimal Porcentaje { get; set; }                  // 0..100
    public DateTime FechaActualizacion { get; set; } = DateTime.UtcNow;

    // Navegación
    public Usuario Mecanico { get; set; } = null!;
}
