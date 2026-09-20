using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.DTOs.Facturacion;

/// <summary>
/// Lo que hay que emitir, contado en términos del negocio y no del SIAT: quién
/// compra, qué se le vendió y cuánto pagó.
///
/// Es a propósito independiente de <c>Factura</c> y <c>Venta</c>: los dos flujos
/// de cobro del taller arman esta misma solicitud, y el emisor de turno decide
/// si eso termina en un recibo interno o en una factura electrónica. Agregar un
/// tercer flujo de cobro mañana no obliga a tocar los emisores.
/// </summary>
public class SolicitudEmisionDto
{
    public OrigenComprobante Origen { get; set; }

    /// <summary>Documento transaccional que origina la emisión: FAC-014 o VTA-031.</summary>
    public string DocumentoId { get; set; } = string.Empty;

    public DateTime Fecha { get; set; } = DateTime.UtcNow;

    public CompradorDto Comprador { get; set; } = new();

    public List<LineaEmisionDto> Lineas { get; set; } = [];

    public decimal Total { get; set; }

    public MetodoPago MetodoPago { get; set; } = MetodoPago.Efectivo;

    /// <summary>
    /// Código del catálogo del SIN que corresponde a <see cref="MetodoPago"/>.
    /// Lo resuelve el emisor si viene nulo.
    /// </summary>
    public int? CodigoMetodoPagoSin { get; set; }
}

/// <summary>A nombre de quién sale el comprobante.</summary>
public class CompradorDto
{
    /// <summary>Nulo en el mostrador: no todo el que compra un filtro está registrado.</summary>
    public string? ClienteId { get; set; }

    public string Nombre { get; set; } = "Sin nombre";

    /// <summary>Documento tal como lo usa el taller hoy (CI o NIT, sin normalizar).</summary>
    public string? CiNit { get; set; }

    public TipoDocumentoIdentidad? TipoDocumentoId { get; set; }
    public string? NumeroDocumento { get; set; }
    public string? Complemento { get; set; }
    public string? Correo { get; set; }
}

/// <summary>
/// Una línea del comprobante. Sirve igual para un servicio de taller que para un
/// repuesto de mostrador: al emisor solo le importa qué se cobró y a cuánto.
/// </summary>
public class LineaEmisionDto
{
    public string Descripcion { get; set; } = string.Empty;
    public decimal Cantidad { get; set; } = 1;
    public decimal PrecioUnitario { get; set; }
    public decimal Subtotal { get; set; }

    /// <summary>Homologación del ítem ante el SIN; nulo mientras no se facture en línea.</summary>
    public string? CodigoSin { get; set; }
    public int? UnidadMedidaSin { get; set; }

    /// <summary>Código interno del ítem (REP-004, SER-002) para trazar la línea.</summary>
    public string? CodigoInterno { get; set; }
}

/// <summary>
/// El artefacto fiscal que produjo el emisor. Es un resultado, no una entidad:
/// quien lo persiste es <c>FacturaService</c>, para que el emisor no tenga que
/// saber nada del modelo de datos.
/// </summary>
public class ResultadoEmisionDto
{
    public ModoFacturacion Modo { get; set; }

    /// <summary>Correlativo fiscal que exige el SIN.</summary>
    public long? NumeroFactura { get; set; }

    public string? Cuf { get; set; }
    public string? Cufd { get; set; }
    public string? CodigoRecepcion { get; set; }

    public EstadoSiat EstadoSiat { get; set; } = EstadoSiat.Pendiente;

    /// <summary>XML armado según el XSD del SIN, antes de firmar.</summary>
    public string? XmlGenerado { get; set; }

    /// <summary>El mismo XML ya firmado: es lo que se envía al webservice.</summary>
    public string? XmlFirmado { get; set; }

    public DateTime? FechaEmisionSiat { get; set; }

    /// <summary>Acuse o motivo de rechazo, para mostrar y para la bitácora.</summary>
    public string? Mensaje { get; set; }
}

/// <summary>Anulación del comprobante ya emitido.</summary>
public class SolicitudAnulacionDto
{
    public OrigenComprobante Origen { get; set; }
    public string DocumentoId { get; set; } = string.Empty;

    /// <summary>
    /// Motivo de anulación. El SIAT exige un código de su catálogo; el recibo
    /// interno se conforma con el texto que quede en la bitácora.
    /// </summary>
    public string? Motivo { get; set; }
}
