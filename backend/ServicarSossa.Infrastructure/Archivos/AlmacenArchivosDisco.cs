using ServicarSossa.Application.Interfaces;

namespace ServicarSossa.Infrastructure.Archivos;

/// <summary>
/// Guarda los archivos subidos por el usuario en una carpeta "Uploads" runtime,
/// separada de "Recursos" (que sí se versiona y se copia al publicar). Se sirve
/// vía archivos estáticos montados en "/uploads" (ver Program.cs).
///
/// Es el almacenamiento del entorno local. En producción no sirve: el disco del
/// contenedor se borra en cada despliegue (ver <see cref="AlmacenArchivosSupabase"/>).
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

        var nombreArchivo = NombresArchivo.Generar(nombreBase, extension);
        await File.WriteAllBytesAsync(Path.Combine(carpeta, nombreArchivo), contenido, ct);

        return nombreArchivo;
    }

    public Task EliminarAsync(string subcarpeta, string nombreArchivo, CancellationToken ct = default)
    {
        var ruta = Path.Combine(AppContext.BaseDirectory, CarpetaRaiz, subcarpeta, nombreArchivo);
        if (File.Exists(ruta)) File.Delete(ruta);
        return Task.CompletedTask;
    }

    public string RutaPublica(string subcarpeta, string nombreArchivo) => $"/uploads/{subcarpeta}/{nombreArchivo}";
}
