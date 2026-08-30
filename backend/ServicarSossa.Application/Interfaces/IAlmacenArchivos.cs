namespace ServicarSossa.Application.Interfaces;

/// <summary>
/// Guarda y sirve archivos subidos por el usuario (fotos, adjuntos) en disco.
/// Vive como interfaz en Application para que los servicios de negocio no
/// dependan de rutas de archivo ni de ASP.NET Core directamente.
/// </summary>
public interface IAlmacenArchivos
{
    /// <summary>
    /// Guarda el contenido bajo la subcarpeta indicada con el nombre base dado
    /// (sin extensión) y devuelve el nombre físico completo del archivo creado.
    /// </summary>
    Task<string> GuardarAsync(
        string subcarpeta, string nombreBase, byte[] contenido, string extension,
        CancellationToken ct = default);

    /// <summary>Elimina el archivo si existe; no falla si ya no está.</summary>
    void Eliminar(string subcarpeta, string nombreArchivo);

    /// <summary>Ruta pública (relativa al origen del backend) para acceder al archivo.</summary>
    string RutaPublica(string subcarpeta, string nombreArchivo);
}
