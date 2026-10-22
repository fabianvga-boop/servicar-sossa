using System.Security.Cryptography;

namespace ServicarSossa.Infrastructure.Archivos;

/// <summary>
/// Nombre físico de un archivo subido: el código del registro más un sufijo
/// aleatorio, por ejemplo <c>VEH-001-k3f9x2qa.jpg</c>.
///
/// El sufijo cumple dos funciones: la URL de una foto no se puede adivinar a
/// partir del código, y al reemplazar una foto el nombre cambia, así el
/// navegador no sigue mostrando la versión vieja que tenía en caché.
/// </summary>
internal static class NombresArchivo
{
    private const string Alfabeto = "abcdefghijklmnopqrstuvwxyz0123456789";

    public static string Generar(string nombreBase, string extension)
        => $"{nombreBase}-{RandomNumberGenerator.GetString(Alfabeto, 8)}{extension.ToLowerInvariant()}";
}
