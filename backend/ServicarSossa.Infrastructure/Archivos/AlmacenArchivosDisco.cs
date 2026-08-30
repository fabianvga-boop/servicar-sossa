using ServicarSossa.Application.Interfaces;

namespace ServicarSossa.Infrastructure.Archivos;

/// <summary>
/// Guarda los archivos subidos por el usuario en una carpeta "Uploads" runtime,
/// separada de "Recursos" (que sí se versiona y se copia al publicar). Se sirve
/// vía archivos estáticos montados en "/uploads" (ver Program.cs).
/// </summary>
public class AlmacenArchivosDisco : IAlmacenArchivos
{
    private const string CarpetaRaiz = "Uploads";

    public async Task<string> GuardarAsync(
        string subcarpeta, string nombreBase, byte[] contenido, string extension,
        CancellationToken ct = default)
    {
        var carpeta = Path.Combine(AppContext.BaseDirectory, CarpetaRaiz, subcarpeta);
        Directory.CreateDirectory(carpeta);

        var nombreArchivo = $"{nombreBase}{extension}";
        await File.WriteAllBytesAsync(Path.Combine(carpeta, nombreArchivo), contenido, ct);

        return nombreArchivo;
    }

    public void Eliminar(string subcarpeta, string nombreArchivo)
    {
        var ruta = Path.Combine(AppContext.BaseDirectory, CarpetaRaiz, subcarpeta, nombreArchivo);
        if (File.Exists(ruta)) File.Delete(ruta);
    }

    public string RutaPublica(string subcarpeta, string nombreArchivo) => $"/uploads/{subcarpeta}/{nombreArchivo}";
}
