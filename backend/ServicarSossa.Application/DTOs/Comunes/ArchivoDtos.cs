using System.ComponentModel.DataAnnotations;

namespace ServicarSossa.Application.DTOs.Comunes;

/// <summary>
/// Contenido de una imagen a subir, ya leída en memoria por el controller: así
/// la capa de aplicación no depende de <c>IFormFile</c>/ASP.NET Core. La usan
/// las fotos de vehículo y la foto de producto de un repuesto.
/// </summary>
public class SubirFotoDto
{
    [Required(ErrorMessage = "El archivo es obligatorio.")]
    public byte[] Contenido { get; set; } = [];

    [Required(ErrorMessage = "El nombre original del archivo es obligatorio.")]
    [MaxLength(255)]
    public string NombreOriginal { get; set; } = string.Empty;
}
