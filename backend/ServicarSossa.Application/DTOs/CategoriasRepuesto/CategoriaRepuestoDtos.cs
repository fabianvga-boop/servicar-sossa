using System.ComponentModel.DataAnnotations;

namespace ServicarSossa.Application.DTOs.CategoriasRepuesto;

/// <summary>Alta o edición de una categoría de repuesto.</summary>
public class CategoriaRepuestoRequestDto
{
    [Required(ErrorMessage = "El nombre de la categoría es obligatorio.")]
    [MaxLength(60, ErrorMessage = "El nombre no puede superar los 60 caracteres.")]
    public string Nombre { get; set; } = string.Empty;
}

/// <summary>
/// Categoría con cuántos repuestos y servicios la usan: al borrarla, esos
/// repuestos quedan sin categoría y esos servicios dejan de controlarla.
/// </summary>
public class CategoriaRepuestoResponseDto
{
    public string CategoriaId { get; set; } = string.Empty;
    public string Nombre { get; set; } = string.Empty;
    public int CantidadRepuestos { get; set; }
    public int CantidadServicios { get; set; }
}

/// <summary>Referencia corta a una categoría, para incluir en otros DTOs.</summary>
public class CategoriaResumenDto
{
    public string CategoriaId { get; set; } = string.Empty;
    public string Nombre { get; set; } = string.Empty;
}
