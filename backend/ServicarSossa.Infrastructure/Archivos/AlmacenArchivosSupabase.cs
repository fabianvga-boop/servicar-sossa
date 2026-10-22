using System.Net.Http.Headers;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using ServicarSossa.Application.Interfaces;

namespace ServicarSossa.Infrastructure.Archivos;

/// <summary>
/// Guarda los archivos subidos en Supabase Storage, a través de su API REST.
///
/// El bucket es público: cualquiera con la URL puede ver la foto, pero subir o
/// borrar exige la clave secreta, que solo conoce la API. Por eso los nombres
/// llevan un sufijo aleatorio (ver <see cref="NombresArchivo"/>): la URL de la
/// foto de un vehículo no se puede adivinar a partir de su código.
/// </summary>
public sealed class AlmacenArchivosSupabase : IAlmacenArchivos
{
    // Un solo HttpClient para toda la vida de la API: crear uno por petición
    // agota los sockets. La vida limitada de las conexiones evita quedar
    // pegado a una IP vieja si Supabase cambia sus servidores.
    private static readonly HttpClient Http = new(new SocketsHttpHandler
    {
        PooledConnectionLifetime = TimeSpan.FromMinutes(10)
    })
    {
        Timeout = TimeSpan.FromSeconds(60)
    };

    private readonly ArchivosOptions opciones;
    private readonly ILogger<AlmacenArchivosSupabase> logger;
    private readonly string urlBase;

    public AlmacenArchivosSupabase(IOptions<ArchivosOptions> opciones, ILogger<AlmacenArchivosSupabase> logger)
    {
        this.opciones = opciones.Value;
        this.logger = logger;
        urlBase = this.opciones.SupabaseUrl.TrimEnd('/');
    }

    public async Task<string> GuardarAsync(
        string subcarpeta, string nombreBase, byte[] contenido, string extension,
        CancellationToken ct = default)
    {
        var nombreArchivo = NombresArchivo.Generar(nombreBase, extension);

        using var peticion = new HttpRequestMessage(HttpMethod.Post, UrlObjeto(subcarpeta, nombreArchivo));
        Autenticar(peticion);
        peticion.Headers.Add("x-upsert", "true");
        peticion.Content = new ByteArrayContent(contenido);
        peticion.Content.Headers.ContentType = new MediaTypeHeaderValue(TipoContenido(extension));

        using var respuesta = await Http.SendAsync(peticion, ct);
        if (!respuesta.IsSuccessStatusCode)
        {
            var detalle = await respuesta.Content.ReadAsStringAsync(ct);
            logger.LogError(
                "Supabase Storage rechazó la subida de {Archivo}: {Estado} {Detalle}",
                $"{subcarpeta}/{nombreArchivo}", (int)respuesta.StatusCode, detalle);
            throw new InvalidOperationException(
                "No se pudo guardar el archivo en el almacenamiento. Intente nuevamente.");
        }

        return nombreArchivo;
    }

    public async Task EliminarAsync(string subcarpeta, string nombreArchivo, CancellationToken ct = default)
    {
        // Borrar es un efecto secundario: la fila ya se actualizó. Si el
        // archivo no está o Supabase falla, queda un huérfano en el bucket,
        // nunca un error para quien usa el sistema.
        try
        {
            using var peticion = new HttpRequestMessage(HttpMethod.Delete, UrlObjeto(subcarpeta, nombreArchivo));
            Autenticar(peticion);

            using var respuesta = await Http.SendAsync(peticion, ct);
            if (!respuesta.IsSuccessStatusCode && (int)respuesta.StatusCode != 404)
                logger.LogWarning(
                    "No se pudo borrar {Archivo} de Supabase Storage: {Estado}",
                    $"{subcarpeta}/{nombreArchivo}", (int)respuesta.StatusCode);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            logger.LogWarning(ex, "No se pudo borrar {Archivo} de Supabase Storage.", $"{subcarpeta}/{nombreArchivo}");
        }
    }

    public string RutaPublica(string subcarpeta, string nombreArchivo)
        => $"{urlBase}/storage/v1/object/public/{opciones.Bucket}/{subcarpeta}/{Uri.EscapeDataString(nombreArchivo)}";

    private string UrlObjeto(string subcarpeta, string nombreArchivo)
        => $"{urlBase}/storage/v1/object/{opciones.Bucket}/{subcarpeta}/{Uri.EscapeDataString(nombreArchivo)}";

    // Las claves nuevas (sb_secret_…) van en "apikey"; las antiguas
    // (service_role, un JWT) además en Authorization. Mandar ambas sirve para
    // los dos tipos.
    private void Autenticar(HttpRequestMessage peticion)
    {
        peticion.Headers.Add("apikey", opciones.SupabaseClave);
        peticion.Headers.Authorization = new AuthenticationHeaderValue("Bearer", opciones.SupabaseClave);
    }

    private static string TipoContenido(string extension) => extension.ToLowerInvariant() switch
    {
        ".jpg" or ".jpeg" => "image/jpeg",
        ".png" => "image/png",
        ".webp" => "image/webp",
        ".svg" => "image/svg+xml",
        _ => "application/octet-stream"
    };
}
