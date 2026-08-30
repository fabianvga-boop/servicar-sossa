namespace ServicarSossa.Domain.Entities;

/// <summary>Tabla <c>roles</c>. PK formato ROL-000. Solo existen Administrador y Mecanico.</summary>
public class Rol
{
    public string RolId { get; set; } = string.Empty;        // ROL-001
    public string NombreRol { get; set; } = string.Empty;    // UNIQUE
    public string? Descripcion { get; set; }

    // Navegación
    public ICollection<Usuario> Usuarios { get; set; } = [];
    public ICollection<RolPermiso> RolPermisos { get; set; } = [];
}
