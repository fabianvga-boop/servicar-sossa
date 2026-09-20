using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Domain.Entities;

/// <summary>Tabla <c>pagos</c>. PK formato PAG-000. US037.</summary>
public class Pago
{
    public string PagoId { get; set; } = string.Empty;       // PAG-001

    /// <summary>
    /// El cobro se registra contra la proforma, que es el documento operativo
    /// del taller. La factura fiscal, cuando exista, representa ese mismo
    /// dinero y no duplica los pagos.
    /// </summary>
    public string ProformaId { get; set; } = string.Empty;
    public decimal Monto { get; set; }                       // CHECK > 0
    public DateTime FechaPago { get; set; } = DateTime.UtcNow;
    public MetodoPago MetodoPago { get; set; }
    public string? Referencia { get; set; }

    /// <summary>
    /// Código de "tipo de método de pago" del SIN, congelado al cobrar. Mismo
    /// criterio que <see cref="Venta.MetodoPagoId"/>: el cobro de una orden
    /// también necesita el código para poder facturarse en línea.
    /// </summary>
    public int? MetodoPagoId { get; set; }

    // Navegación
    public Proforma Proforma { get; set; } = null!;
}
