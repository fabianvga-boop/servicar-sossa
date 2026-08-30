namespace ServicarSossa.Domain.Entities;

/// <summary>Tabla puente <c>rol_permisos</c> (roles ↔ permisos). PK compuesta.</summary>
public class RolPermiso
{
    public string RolId { get; set; } = string.Empty;
    public string PermisoId { get; set; } = string.Empty;

    // Navegación
    public Rol Rol { get; set; } = null!;
    public Permiso Permiso { get; set; } = null!;
}
