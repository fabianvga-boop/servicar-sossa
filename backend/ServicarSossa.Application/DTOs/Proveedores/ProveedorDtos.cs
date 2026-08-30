using System.ComponentModel.DataAnnotations;

namespace ServicarSossa.Application.DTOs.Proveedores;

/// <summary>USU028 — alta y edición de proveedor.</summary>
public class ProveedorRequestDto
{
    [Required(ErrorMessage = "El nombre del proveedor es obligatorio.")]
    [MaxLength(150)]
    public string Nombre { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? Contacto { get; set; }

    [Phone(ErrorMessage = "El formato del teléfono no es válido.")]
    [MaxLength(20)]
    public string? Telefono { get; set; }

    [EmailAddress(ErrorMessage = "El formato del email no es válido.")]
    [MaxLength(150)]
    public string? Email { get; set; }

    [MaxLength(200)]
    public string? Direccion { get; set; }
}

/// <summary>Salida pública de un proveedor.</summary>
public class ProveedorResponseDto
{
    public string ProveedorId { get; set; } = string.Empty;
    public string Nombre { get; set; } = string.Empty;
    public string? Contacto { get; set; }
    public string? Telefono { get; set; }
    public string? Email { get; set; }
    public string? Direccion { get; set; }
    public int CantidadRepuestos { get; set; }
}
