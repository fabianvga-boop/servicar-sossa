using System.ComponentModel.DataAnnotations;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.DTOs.Clientes;

/// <summary>USU006 — alta de cliente. El ID lo genera la capa de aplicación.</summary>
public class ClienteRequestDto
{
    [Required(ErrorMessage = "El nombre es obligatorio.")]
    [MaxLength(100)]
    public string Nombre { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? Apellido { get; set; }

    [MaxLength(150)]
    public string? RazonSocial { get; set; }

    [Required(ErrorMessage = "El CI/NIT es obligatorio.")]
    [MaxLength(30)]
    public string CiNit { get; set; } = string.Empty;

    [Phone(ErrorMessage = "El formato del teléfono no es válido.")]
    [MaxLength(20)]
    public string? Telefono { get; set; }

    [EmailAddress(ErrorMessage = "El formato del email no es válido.")]
    [MaxLength(150)]
    public string? Email { get; set; }

    [MaxLength(200)]
    public string? Direccion { get; set; }
}

/// <summary>USU007 — edición de cliente.</summary>
public class ClienteUpdateDto
{
    [Required(ErrorMessage = "El nombre es obligatorio.")]
    [MaxLength(100)]
    public string Nombre { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? Apellido { get; set; }

    [MaxLength(150)]
    public string? RazonSocial { get; set; }

    [Required(ErrorMessage = "El CI/NIT es obligatorio.")]
    [MaxLength(30)]
    public string CiNit { get; set; } = string.Empty;

    [Phone(ErrorMessage = "El formato del teléfono no es válido.")]
    [MaxLength(20)]
    public string? Telefono { get; set; }

    [EmailAddress(ErrorMessage = "El formato del email no es válido.")]
    [MaxLength(150)]
    public string? Email { get; set; }

    [MaxLength(200)]
    public string? Direccion { get; set; }
}

/// <summary>USU008 — activar/desactivar cliente (no se borra físicamente).</summary>
public class CambiarEstadoClienteDto
{
    [Required(ErrorMessage = "El estado es obligatorio.")]
    public EstadoCliente Estado { get; set; }
}

/// <summary>Salida pública de un cliente.</summary>
public class ClienteResponseDto
{
    public string ClienteId { get; set; } = string.Empty;
    public string Nombre { get; set; } = string.Empty;
    public string? Apellido { get; set; }
    public string? RazonSocial { get; set; }
    public string CiNit { get; set; } = string.Empty;
    public string? Telefono { get; set; }
    public string? Email { get; set; }
    public string? Direccion { get; set; }
    public DateTime FechaRegistro { get; set; }
    public EstadoCliente Estado { get; set; }
    public int CantidadVehiculos { get; set; }
}
