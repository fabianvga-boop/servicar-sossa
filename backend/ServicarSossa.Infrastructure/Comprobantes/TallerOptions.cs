namespace ServicarSossa.Infrastructure.Comprobantes;

/// <summary>
/// Identidad del taller que encabeza los comprobantes. Vive en appsettings
/// (sección <c>Taller</c>) en vez de en la base de datos: son datos que
/// cambian una vez cada varios años y no justifican una tabla ni una pantalla.
/// </summary>
public class TallerOptions
{
    public const string Seccion = "Taller";

    public string Nombre { get; set; } = "Servicar SOSSA";
    public string Rubro { get; set; } = "Taller automotriz";
    public string Direccion { get; set; } = string.Empty;
    public string Ciudad { get; set; } = string.Empty;
    public string Telefono { get; set; } = string.Empty;
    public string Nit { get; set; } = string.Empty;

    /// <summary>
    /// Ruta del logotipo relativa al directorio del ejecutable. El archivo se
    /// copia al output desde <c>ServicarSossa.API/Recursos</c>, así que la
    /// misma ruta sirve en desarrollo y en publicación.
    /// </summary>
    public string RutaLogo { get; set; } = "Recursos/logo.png";

    public string TextoGarantia { get; set; } = string.Empty;
}
