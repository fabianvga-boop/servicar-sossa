using System.ComponentModel.DataAnnotations;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.DTOs.Usuarios;

/// <summary>USU001 — alta de usuario. El ID lo genera la capa de aplicación.</summary>
public class UsuarioRequestDto
{
    [Required(ErrorMessage = "El nombre es obligatorio.")]
    [MaxLength(100)]
    public string Nombre { get; set; } = string.Empty;

    [Required(ErrorMessage = "El apellido es obligatorio.")]
    [MaxLength(100)]
    public string Apellido { get; set; } = string.Empty;

    [Required(ErrorMessage = "El email es obligatorio.")]
    [EmailAddress(ErrorMessage = "El formato del email no es válido.")]
    [MaxLength(150)]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "El nombre de usuario es obligatorio.")]
    [MaxLength(50)]
    public string Username { get; set; } = string.Empty;

    [Required(ErrorMessage = "La contraseña es obligatoria.")]
    [MinLength(8, ErrorMessage = "La contraseña debe tener al menos 8 caracteres.")]
    public string Password { get; set; } = string.Empty;

    [Required(ErrorMessage = "El rol es obligatorio.")]
    [RegularExpression(@"^ROL-\d{3,}$", ErrorMessage = "El rol debe tener el formato ROL-000.")]
    public string RolId { get; set; } = string.Empty;

    [Phone(ErrorMessage = "El formato del teléfono no es válido.")]
    [MaxLength(20)]
    public string? Telefono { get; set; }
}

/// <summary>USU003 — edición. La contraseña se cambia por su propio endpoint.</summary>
public class UsuarioUpdateDto
{
    [Required(ErrorMessage = "El nombre es obligatorio.")]
    [MaxLength(100)]
    public string Nombre { get; set; } = string.Empty;

    [Required(ErrorMessage = "El apellido es obligatorio.")]
    [MaxLength(100)]
    public string Apellido { get; set; } = string.Empty;

    [Required(ErrorMessage = "El email es obligatorio.")]
    [EmailAddress(ErrorMessage = "El formato del email no es válido.")]
    [MaxLength(150)]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "El rol es obligatorio.")]
    [RegularExpression(@"^ROL-\d{3,}$", ErrorMessage = "El rol debe tener el formato ROL-000.")]
    public string RolId { get; set; } = string.Empty;

    [Phone(ErrorMessage = "El formato del teléfono no es válido.")]
    [MaxLength(20)]
    public string? Telefono { get; set; }
}

/// <summary>USU004 — activar/desactivar usuario (no se borra físicamente).</summary>
public class CambiarEstadoUsuarioDto
{
    [Required(ErrorMessage = "El estado es obligatorio.")]
    public EstadoUsuario Estado { get; set; }
}

/// <summary>Salida pública de un usuario. Nunca expone el password_hash.</summary>
public class UsuarioResponseDto
{
    public string UsuarioId { get; set; } = string.Empty;
    public string Nombre { get; set; } = string.Empty;
    public string Apellido { get; set; } = string.Empty;
    public string NombreCompleto => $"{Nombre} {Apellido}".Trim();
    public string Email { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string RolId { get; set; } = string.Empty;
    public string NombreRol { get; set; } = string.Empty;
    public string? Telefono { get; set; }
    public EstadoUsuario Estado { get; set; }
    public DateTime FechaRegistro { get; set; }
}
