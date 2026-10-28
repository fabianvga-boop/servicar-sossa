namespace ServicarSossa.Domain.Entities;

/// <summary>
/// Tabla <c>compras</c>. PK formato CMP-000. Al registrarse incrementa el stock.
/// Sin proveedor es una compra ocasional: a alguien de quien no se tienen (o no
/// conviene guardar) los datos; <see cref="Referencia"/> ayuda a recordar a quién.
/// </summary>
public class Compra
{
    public string CompraId { get; set; } = string.Empty;     // CMP-001

    /// <summary>Null en una compra ocasional.</summary>
    public string? ProveedorId { get; set; }

    /// <summary>Texto libre opcional: "Feria 16 de Julio", "mecánico de otro taller".</summary>
    public string? Referencia { get; set; }

    public bool EsOcasional => ProveedorId is null;

    public string UsuarioId { get; set; } = string.Empty;
    public DateTime Fecha { get; set; } = DateTime.UtcNow;
    public decimal Total { get; set; }

    // Navegación
    public Proveedor? Proveedor { get; set; }
    public Usuario Usuario { get; set; } = null!;
    public ICollection<CompraDetalle> Detalles { get; set; } = [];
}
