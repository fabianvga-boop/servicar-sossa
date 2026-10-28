using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Domain.Entities;

/// <summary>
/// Tabla <c>movimientos_inventario</c> (kárdex). PK formato MOV-000.
/// Cada cambio de stock de un repuesto deja una fila: qué pasó, cuánto entró
/// (+) o salió (−), con qué saldo quedó y de qué documento vino. El último
/// saldo de un repuesto coincide con su stock actual.
/// </summary>
public class MovimientoInventario
{
    public string MovimientoId { get; set; } = string.Empty;   // MOV-001
    public string RepuestoId { get; set; } = string.Empty;
    public DateTime Fecha { get; set; } = DateTime.UtcNow;
    public TipoMovimientoInventario Tipo { get; set; }

    /// <summary>Positivo si entra al inventario, negativo si sale.</summary>
    public int Cantidad { get; set; }

    /// <summary>Stock del repuesto después de este movimiento.</summary>
    public int Saldo { get; set; }

    /// <summary>Documento de origen: CMP-, ORD-, VTA-. Null en ajustes y stock inicial.</summary>
    public string? Referencia { get; set; }

    /// <summary>Proveedor, "Compra ocasional (…)", motivo del ajuste…</summary>
    public string? Detalle { get; set; }

    public decimal? PrecioUnitario { get; set; }

    /// <summary>Null en los movimientos reconstruidos al crear el kárdex.</summary>
    public string? UsuarioId { get; set; }

    // Navegación
    public Repuesto Repuesto { get; set; } = null!;
    public Usuario? Usuario { get; set; }
}
