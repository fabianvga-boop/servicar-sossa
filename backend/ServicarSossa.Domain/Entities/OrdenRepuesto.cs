using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Domain.Entities;

/// <summary>
/// Tabla <c>orden_repuestos</c>: repuesto usado en una orden. PK formato ORE-000.
/// El origen decide todo: solo los de <see cref="OrigenRepuesto.Inventario"/> tienen
/// <see cref="RepuestoId"/> y descuentan stock; los demás llevan una descripción libre.
/// </summary>
public class OrdenRepuesto
{
    public string OrdenRepuestoId { get; set; } = string.Empty;  // ORE-001
    public string OrdenId { get; set; } = string.Empty;

    /// <summary>Solo para origen Inventario; null cuando lo trae el cliente o es compra externa.</summary>
    public string? RepuestoId { get; set; }

    public OrigenRepuesto Origen { get; set; } = OrigenRepuesto.Inventario;

    /// <summary>Nombre libre del repuesto cuando no sale del inventario (cliente trae / compra externa).</summary>
    public string? Descripcion { get; set; }

    public int Cantidad { get; set; }
    public decimal PrecioUnitario { get; set; }

    /// <summary>Columna calculada en PostgreSQL (GENERATED ALWAYS AS ... STORED): solo lectura.</summary>
    public decimal Subtotal { get; private set; }

    // Navegación
    public OrdenTrabajo Orden { get; set; } = null!;

    /// <summary>Null cuando el repuesto no proviene del inventario.</summary>
    public Repuesto? Repuesto { get; set; }
}
