using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Domain.Entities;

/// <summary>
/// Tabla <c>auditoria</c>. Bitácora genérica de acciones: quién hizo qué, sobre
/// qué registro y cuándo. No reemplaza el historial de valores (no guarda el
/// antes/después de cada campo), solo dice qué pasó.
/// </summary>
public class Auditoria
{
    public string AuditoriaId { get; set; } = string.Empty;   // AUD-001
    public string UsuarioId { get; set; } = string.Empty;
    public AccionAuditoria Accion { get; set; }

    /// <summary>Nombre de la entidad afectada, p. ej. "Repuesto", "Vehiculo".</summary>
    public string Entidad { get; set; } = string.Empty;

    /// <summary>PK del registro afectado, p. ej. "REP-004".</summary>
    public string EntidadId { get; set; } = string.Empty;

    /// <summary>Resumen legible, p. ej. "Editó el repuesto 'Pastillas de freno'".</summary>
    public string Descripcion { get; set; } = string.Empty;
    public DateTime Fecha { get; set; } = DateTime.UtcNow;

    // Navegación
    public Usuario Usuario { get; set; } = null!;
}
