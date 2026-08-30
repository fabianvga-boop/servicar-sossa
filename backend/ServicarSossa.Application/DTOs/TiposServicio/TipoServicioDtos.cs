using System.ComponentModel.DataAnnotations;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.DTOs.TiposServicio;

/// <summary>USU013 — alta de un tipo de servicio del catálogo.</summary>
public class TipoServicioRequestDto
{
    [Required(ErrorMessage = "El nombre del servicio es obligatorio.")]
    [MaxLength(100)]
    public string Nombre { get; set; } = string.Empty;

    [MaxLength(255)]
    public string? Descripcion { get; set; }

    [Range(0, 99999999.99, ErrorMessage = "El precio base no puede ser negativo.")]
    public decimal PrecioBase { get; set; }
}

/// <summary>USU013 — edición de un tipo de servicio.</summary>
public class TipoServicioUpdateDto
{
    [Required(ErrorMessage = "El nombre del servicio es obligatorio.")]
    [MaxLength(100)]
    public string Nombre { get; set; } = string.Empty;

    [MaxLength(255)]
    public string? Descripcion { get; set; }

    [Range(0, 99999999.99, ErrorMessage = "El precio base no puede ser negativo.")]
    public decimal PrecioBase { get; set; }
}

/// <summary>Habilita o deshabilita el servicio en el catálogo (baja lógica).</summary>
public class CambiarEstadoServicioDto
{
    [Required(ErrorMessage = "El estado es obligatorio.")]
    public EstadoServicio Estado { get; set; }
}

/// <summary>Salida pública de un tipo de servicio.</summary>
public class TipoServicioResponseDto
{
    public string ServicioId { get; set; } = string.Empty;
    public string Nombre { get; set; } = string.Empty;
    public string? Descripcion { get; set; }
    public decimal PrecioBase { get; set; }
    public EstadoServicio Estado { get; set; }
}
