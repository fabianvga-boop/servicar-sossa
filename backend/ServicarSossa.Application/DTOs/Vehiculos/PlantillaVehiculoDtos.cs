using System.ComponentModel.DataAnnotations;
using ServicarSossa.Application.DTOs.Comunes;

namespace ServicarSossa.Application.DTOs.Vehiculos;

/// <summary>Una plantilla vectorial de la biblioteca (una por Marca+Modelo).</summary>
public class PlantillaVehiculoResponseDto
{
    public string PlantillaId { get; set; } = string.Empty;
    public string Marca { get; set; } = string.Empty;
    public string Modelo { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public DateTime FechaSubida { get; set; }
}

/// <summary>Alta de una plantilla: Marca+Modelo exactos y el archivo .svg.</summary>
public class SubirPlantillaVehiculoDto
{
    [Required(ErrorMessage = "La marca es obligatoria.")]
    [MaxLength(50)]
    public string Marca { get; set; } = string.Empty;

    [Required(ErrorMessage = "El modelo es obligatorio.")]
    [MaxLength(50)]
    public string Modelo { get; set; } = string.Empty;

    [Required(ErrorMessage = "El archivo SVG es obligatorio.")]
    public SubirFotoDto Archivo { get; set; } = new();
}
