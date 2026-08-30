namespace ServicarSossa.Domain.Entities;

/// <summary>Tabla <c>permisos</c>. PK formato PER-000.</summary>
public class Permiso
{
    public string PermisoId { get; set; } = string.Empty;    // PER-001
    public string Nombre { get; set; } = string.Empty;       // UNIQUE
    public string? Descripcion { get; set; }

    // Navegación
    public ICollection<RolPermiso> RolPermisos { get; set; } = [];
}
