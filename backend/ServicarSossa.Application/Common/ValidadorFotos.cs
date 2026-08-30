using ServicarSossa.Application.DTOs.Comunes;

namespace ServicarSossa.Application.Common;

/// <summary>
/// Reglas comunes de las fotos que sube el usuario (vehículos, repuestos).
/// Centralizadas para que el límite de tamaño y los formatos admitidos sean
/// los mismos en todos los módulos.
/// </summary>
internal static class ValidadorFotos
{
    public const int TamanioMaximoBytes = 8 * 1024 * 1024; // 8 MB

    private static readonly HashSet<string> ExtensionesPermitidas =
        new(StringComparer.OrdinalIgnoreCase) { ".jpg", ".jpeg", ".png", ".webp" };

    /// <summary>Devuelve el mensaje de error, o null si la foto es válida.</summary>
    public static string? Validar(SubirFotoDto dto)
    {
        if (dto.Contenido.Length == 0) return "El archivo está vacío.";

        if (dto.Contenido.Length > TamanioMaximoBytes)
            return "La foto no puede superar los 8 MB.";

        return ExtensionesPermitidas.Contains(Extension(dto))
            ? null
            : "Formato no admitido. Use JPG, PNG o WEBP.";
    }

    public static string Extension(SubirFotoDto dto) => Path.GetExtension(dto.NombreOriginal);
}
