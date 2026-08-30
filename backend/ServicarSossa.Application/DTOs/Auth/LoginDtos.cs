using System.ComponentModel.DataAnnotations;

namespace ServicarSossa.Application.DTOs.Auth;

/// <summary>USU002 — credenciales de inicio de sesión.</summary>
public class LoginRequestDto
{
    [Required(ErrorMessage = "El usuario es obligatorio.")]
    [MaxLength(50)]
    public string Username { get; set; } = string.Empty;

    [Required(ErrorMessage = "La contraseña es obligatoria.")]
    public string Password { get; set; } = string.Empty;
}

/// <summary>Respuesta del login: token JWT y datos mínimos para el frontend.</summary>
public class LoginResponseDto
{
    public string Token { get; set; } = string.Empty;
    public DateTime ExpiraEn { get; set; }
    public string UsuarioId { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string NombreCompleto { get; set; } = string.Empty;
    public string Rol { get; set; } = string.Empty;
}

/// <summary>USU003 — cambio de contraseña del usuario autenticado.</summary>
public class CambiarPasswordDto
{
    [Required(ErrorMessage = "La contraseña actual es obligatoria.")]
    public string PasswordActual { get; set; } = string.Empty;

    [Required(ErrorMessage = "La nueva contraseña es obligatoria.")]
    [MinLength(8, ErrorMessage = "La nueva contraseña debe tener al menos 8 caracteres.")]
    public string PasswordNueva { get; set; } = string.Empty;
}
