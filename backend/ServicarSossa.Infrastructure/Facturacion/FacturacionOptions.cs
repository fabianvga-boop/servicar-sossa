using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Infrastructure.Facturacion;

/// <summary>
/// Sección <c>Facturacion</c> de appsettings. Decide con qué emisor arranca el
/// sistema y guarda lo que haga falta para hablar con el SIAT el día que el
/// taller esté habilitado.
///
/// Todo lo del SIAT vive acá y no en la base: son credenciales y parámetros de
/// entorno, no datos del negocio.
/// </summary>
public class FacturacionOptions
{
    public const string Seccion = "Facturacion";

    /// <summary>
    /// <c>INTERNAL</c> (nota de venta / recibo interno, modo actual) o
    /// <c>SIAT_ONLINE</c> (factura electrónica en línea). Cualquier otro valor
    /// se rechaza al arrancar en vez de caer en un modo por accidente.
    /// </summary>
    public string Modo { get; set; } = "INTERNAL";

    public ModoFacturacion ModoResuelto => Modo?.Trim().ToUpperInvariant() switch
    {
        "SIAT_ONLINE" => ModoFacturacion.SiatEnLinea,
        "INTERNAL" or null or "" => ModoFacturacion.Interno,
        _ => throw new InvalidOperationException(
            $"Facturacion:Modo tiene el valor '{Modo}', que no es válido. " +
            "Use 'INTERNAL' (recibo interno) o 'SIAT_ONLINE' (factura electrónica).")
    };

    /// <summary>Leyenda al pie del comprobante interno, para que nadie lo confunda con una factura.</summary>
    public string LeyendaDocumentoInterno { get; set; } =
        "Documento sin valor fiscal. No válido para crédito fiscal.";

    /// <summary>Parámetros del SIAT. Solo se validan si el modo es SIAT_ONLINE.</summary>
    public SiatOptions Siat { get; set; } = new();
}

/// <summary>
/// Credenciales y catálogos del SIAT.
///
/// Los códigos numéricos traen valores de arranque pero NO son autoritativos:
/// el SIN publica y actualiza sus catálogos por webservice y manda el vigente.
/// Por eso son configurables — para corregirlos sin recompilar — y por eso cada
/// venta guarda el código con el que se emitió en su propia columna.
/// </summary>
public class SiatOptions
{
    public string Nit { get; set; } = string.Empty;

    /// <summary>Token de delegación que entrega el SIN (API key del contribuyente).</summary>
    public string ApiKey { get; set; } = string.Empty;

    /// <summary>Código del sistema informático, asignado al registrar el software.</summary>
    public string CodigoSistema { get; set; } = string.Empty;

    public int CodigoSucursal { get; set; }
    public int CodigoPuntoVenta { get; set; }

    /// <summary>Ambiente del SIN: 1 producción, 2 pruebas.</summary>
    public int CodigoAmbiente { get; set; } = 2;

    /// <summary>Modalidad: 1 electrónica en línea, 2 computarizada en línea.</summary>
    public int CodigoModalidad { get; set; } = 1;

    /// <summary>URL base de los webservices (cambia entre pruebas y producción).</summary>
    public string UrlBase { get; set; } = string.Empty;

    /// <summary>Ruta del certificado digital para firmar el XML.</summary>
    public string RutaCertificado { get; set; } = string.Empty;

    /// <summary>
    /// Código del SIN para cada forma de cobro del taller, por nombre del enum
    /// <see cref="MetodoPago"/>. VERIFICAR contra el catálogo vigente antes de
    /// emitir en producción: los valores de acá son solo un punto de partida.
    /// </summary>
    public Dictionary<string, int> CodigosMetodoPago { get; set; } = new()
    {
        [nameof(MetodoPago.Efectivo)] = 1,
        [nameof(MetodoPago.Tarjeta)] = 2,
        [nameof(MetodoPago.Transferencia)] = 7,
        [nameof(MetodoPago.QR)] = 7,
        [nameof(MetodoPago.Otro)] = 1
    };

    /// <summary>Unidad de medida por defecto para ítems sin homologar.</summary>
    public int UnidadMedidaPorDefecto { get; set; } = 57;
}
