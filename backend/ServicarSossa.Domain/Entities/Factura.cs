using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Domain.Entities;

/// <summary>
/// Tabla <c>facturas</c>. PK formato FAC-000.
///
/// Comprobante FISCAL ante el SIN: lleva CUF, CUFD y el XML firmado que se
/// envía a los webservices del SIAT. Solo existe cuando el taller está
/// habilitado ante Impuestos (<c>Facturacion:Modo = SIAT_ONLINE</c>); mientras
/// tanto la tabla queda vacía y el cobro se documenta con
/// <see cref="Proforma"/>.
///
/// Cuelga de una orden de trabajo O de una venta de mostrador, nunca de las dos
/// (lo garantiza un CHECK en la base). No depende de la proforma: se emite
/// directo del documento que originó el cobro.
/// </summary>
public class Factura
{
    public string FacturaId { get; set; } = string.Empty;    // FAC-001

    /// <summary>Orden de trabajo facturada, si el cobro nace del taller.</summary>
    public string? OrdenId { get; set; }

    /// <summary>Venta de mostrador facturada, si el cobro nace del punto de venta.</summary>
    public string? VentaId { get; set; }

    // --- Datos comerciales, congelados al emitir ------------------------------

    public DateTime FechaEmision { get; set; } = DateTime.UtcNow;
    public string? NitRazonSocial { get; set; }
    public decimal Total { get; set; }

    /// <summary>Código del catálogo del SIN para la forma de cobro.</summary>
    public int? MetodoPagoId { get; set; }

    public EstadoFactura Estado { get; set; } = EstadoFactura.Emitida;

    // --- Datos fiscales (SIAT) ------------------------------------------------

    /// <summary>Correlativo fiscal que exige el SIN, distinto del código interno.</summary>
    public long? NumeroFactura { get; set; }

    /// <summary>Código Único de Factura: se calcula localmente antes de enviar.</summary>
    public string? Cuf { get; set; }

    /// <summary>Código Único de Descarga: lo entrega el SIN y vence cada día.</summary>
    public string? Cufd { get; set; }

    /// <summary>Acuse del webservice cuando la recepción fue correcta.</summary>
    public string? CodigoRecepcion { get; set; }

    public EstadoSiat EstadoSiat { get; set; } = EstadoSiat.Pendiente;

    /// <summary>XML armado según el XSD del SIN, antes de firmar.</summary>
    public string? XmlGenerado { get; set; }

    /// <summary>El mismo XML ya firmado digitalmente: es lo que se envía.</summary>
    public string? XmlFirmado { get; set; }

    /// <summary>Fecha que consta en el comprobante fiscal, no la del cobro.</summary>
    public DateTime? FechaEmisionSiat { get; set; }

    /// <summary>Última respuesta del webservice: acuse o motivo de rechazo.</summary>
    public string? MensajeServicio { get; set; }

    // Navegación
    public OrdenTrabajo? Orden { get; set; }
    public Venta? Venta { get; set; }
}
