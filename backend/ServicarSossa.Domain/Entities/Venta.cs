using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Domain.Entities;

/// <summary>
/// Tabla <c>ventas</c>: venta de repuestos en mostrador (punto de venta), sin
/// orden de trabajo ni vehículo de por medio. PK formato VTA-000.
///
/// A diferencia de una factura de taller se cobra completa en el acto, así que
/// el método de pago vive en la cabecera y no hay saldo pendiente ni pagos
/// parciales asociados.
/// </summary>
public class Venta
{
    public string VentaId { get; set; } = string.Empty;      // VTA-001

    /// <summary>Opcional: el cliente de mostrador no siempre está registrado.</summary>
    public string? ClienteId { get; set; }

    /// <summary>Quién realizó la venta (usuario autenticado).</summary>
    public string UsuarioId { get; set; } = string.Empty;

    public DateTime FechaVenta { get; set; } = DateTime.UtcNow;
    public MetodoPago MetodoPago { get; set; } = MetodoPago.Efectivo;
    public decimal Total { get; set; }
    public EstadoVenta Estado { get; set; } = EstadoVenta.Emitida;
    public string? Observaciones { get; set; }

    // Navegación
    public Cliente? Cliente { get; set; }
    public Usuario Usuario { get; set; } = null!;
    public ICollection<VentaDetalle> Detalles { get; set; } = [];
}
