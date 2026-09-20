using ServicarSossa.Application.DTOs.Comunes;

namespace ServicarSossa.Application.Common;

/// <summary>Reglas del SVG que se sube a la biblioteca de plantillas de vehículo.</summary>
internal static class ValidadorPlantillasVehiculo
{
    public const int TamanioMaximoBytes = 512 * 1024; // 512 KB: es vector, no debería pesar más.

    public static string? Validar(SubirFotoDto dto)
    {
        if (dto.Contenido.Length == 0) return "El archivo está vacío.";

        if (dto.Contenido.Length > TamanioMaximoBytes)
            return "El SVG no puede superar los 512 KB.";

        if (!Path.GetExtension(dto.NombreOriginal).Equals(".svg", StringComparison.OrdinalIgnoreCase))
            return "Formato no admitido. Debe ser un archivo .svg.";

        return null;
    }
}
