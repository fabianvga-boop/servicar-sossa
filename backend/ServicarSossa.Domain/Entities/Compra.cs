namespace ServicarSossa.Domain.Entities;

/// <summary>Tabla <c>compras</c>. PK formato CMP-000. Al registrarse incrementa el stock.</summary>
public class Compra
{
    public string CompraId { get; set; } = string.Empty;     // CMP-001
    public string ProveedorId { get; set; } = string.Empty;
    public string UsuarioId { get; set; } = string.Empty;
    public DateTime Fecha { get; set; } = DateTime.UtcNow;
    public decimal Total { get; set; }

    // Navegación
    public Proveedor Proveedor { get; set; } = null!;
    public Usuario Usuario { get; set; } = null!;
    public ICollection<CompraDetalle> Detalles { get; set; } = [];
}
