using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Domain.Entities;

/// <summary>
/// Tabla <c>proformas</c>. PK formato PRF-000. USU038.
///
/// Documento de cobro del taller, SIN valor fiscal: es contra esto que el
/// cliente paga y lo que se le entrega impreso. Nace de una orden Finalizada o
/// Cerrada y admite pagos parciales.
///
/// Es el flujo operativo de todos los días. No se confunde con
/// <see cref="Factura"/>, que es el comprobante fiscal ante el SIN y solo
/// existe cuando el taller está habilitado ante Impuestos.
/// </summary>
public class Proforma
{
    public string ProformaId { get; set; } = string.Empty;   // PRF-001
    public string OrdenId { get; set; } = string.Empty;
    public DateTime FechaEmision { get; set; } = DateTime.UtcNow;

    /// <summary>NIT o razón social que el cliente pide que figure en el documento.</summary>
    public string? NitRazonSocial { get; set; }

    public decimal Total { get; set; }
    public EstadoProforma Estado { get; set; } = EstadoProforma.Emitida;

    // Navegación
    public OrdenTrabajo Orden { get; set; } = null!;
    public ICollection<Pago> Pagos { get; set; } = [];
}
