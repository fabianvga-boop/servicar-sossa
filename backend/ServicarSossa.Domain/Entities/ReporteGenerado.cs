using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Domain.Entities;

/// <summary>
/// Tabla <c>reportes_generados</c>: bitácora de reportes emitidos (US017-US020).
/// PK formato RPT-000. No reemplaza las consultas dinámicas de reportes.
/// </summary>
public class ReporteGenerado
{
    public string ReporteId { get; set; } = string.Empty;    // RPT-001
    public string TipoReporte { get; set; } = string.Empty;  // ventas, comisiones, inventario, ordenes...
    public DateOnly FechaInicio { get; set; }
    public DateOnly FechaFin { get; set; }
    public string UsuarioId { get; set; } = string.Empty;
    public DateTime FechaGeneracion { get; set; } = DateTime.UtcNow;
    public FormatoReporte Formato { get; set; } = FormatoReporte.Pdf;

    // Navegación
    public Usuario Usuario { get; set; } = null!;
}
