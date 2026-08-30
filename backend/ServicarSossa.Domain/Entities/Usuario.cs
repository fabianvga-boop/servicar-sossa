using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Domain.Entities;

/// <summary>Tabla <c>usuarios</c>. PK formato USU-000.</summary>
public class Usuario
{
    public string UsuarioId { get; set; } = string.Empty;    // USU-001
    public string Nombre { get; set; } = string.Empty;
    public string Apellido { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;        // UNIQUE
    public string Username { get; set; } = string.Empty;     // UNIQUE
    public string PasswordHash { get; set; } = string.Empty; // BCrypt
    public string RolId { get; set; } = string.Empty;
    public string? Telefono { get; set; }
    public EstadoUsuario Estado { get; set; } = EstadoUsuario.Activo;
    public DateTime FechaRegistro { get; set; } = DateTime.UtcNow;

    // Navegación
    public Rol Rol { get; set; } = null!;
    public ICollection<Diagnostico> Diagnosticos { get; set; } = [];
    public ICollection<OrdenTrabajo> OrdenesAdministradas { get; set; } = [];
    public ICollection<OrdenMecanico> OrdenesAsignadas { get; set; } = [];
    public ICollection<OrdenServicio> ServiciosEjecutados { get; set; } = [];
    public ICollection<Compra> Compras { get; set; } = [];
    public ICollection<Comision> Comisiones { get; set; } = [];
    public ComisionConfig? ComisionConfig { get; set; }
    public ICollection<ReporteGenerado> ReportesGenerados { get; set; } = [];
}
