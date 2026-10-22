namespace ServicarSossa.Application.Interfaces;

/// <summary>
/// Guarda y sirve archivos subidos por el usuario (fotos, adjuntos) en disco.
/// Vive como interfaz en Application para que los servicios de negocio no
/// dependan de rutas de archivo ni de ASP.NET Core directamente.
/// </summary>
public interface IAlmacenArchivos
{
    /// <summary>
    /// Guarda el contenido bajo la subcarpeta indicada y devuelve el nombre
    /// físico del archivo creado. Ese nombre parte del nombre base (sin
    /// extensión) pero lleva un sufijo aleatorio: cada subida produce un
    /// nombre nuevo, así que quien reemplaza un archivo debe borrar el anterior.
    /// </summary>
    Task<string> GuardarAsync(
        string subcarpeta, string nombreBase, byte[] contenido, string extension,
        CancellationToken ct = default);

    /// <summary>Elimina el archivo si existe; no falla si ya no está.</summary>
    Task EliminarAsync(string subcarpeta, string nombreArchivo, CancellationToken ct = default);

    /// <summary>
    /// Dirección para acceder al archivo: relativa al origen del backend
    /// (<c>/uploads/...</c>) en disco, o absoluta cuando vive en un
    /// almacenamiento externo.
    /// </summary>
    string RutaPublica(string subcarpeta, string nombreArchivo);
}
