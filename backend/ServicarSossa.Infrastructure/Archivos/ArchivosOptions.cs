namespace ServicarSossa.Infrastructure.Archivos;

/// <summary>
/// Dónde se guardan las fotos y plantillas que suben los usuarios (sección
/// <c>Archivos</c> de appsettings o variables <c>Archivos__*</c>).
///
/// <c>Disco</c> (por defecto) sirve para el entorno local. En producción se usa
/// <c>Supabase</c>: el disco de Render se borra en cada reinicio y despliegue,
/// así que las fotos guardadas ahí desaparecían.
/// </summary>
public class ArchivosOptions
{
    public const string Seccion = "Archivos";

    public string Proveedor { get; set; } = "Disco";

    /// <summary>Dirección del proyecto, del tipo https://&lt;ref&gt;.supabase.co (sin ruta).</summary>
    public string SupabaseUrl { get; set; } = string.Empty;

    /// <summary>Clave secreta (sb_secret_… o service_role). Nunca debe llegar al frontend.</summary>
    public string SupabaseClave { get; set; } = string.Empty;

    /// <summary>Nombre del bucket público donde se guardan los archivos.</summary>
    public string Bucket { get; set; } = string.Empty;

    public bool UsaSupabase => Proveedor.Equals("Supabase", StringComparison.OrdinalIgnoreCase);
}
