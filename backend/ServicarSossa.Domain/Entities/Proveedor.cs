namespace ServicarSossa.Domain.Entities;

/// <summary>Tabla <c>proveedores</c>. PK formato PRO-000.</summary>
public class Proveedor
{
    public string ProveedorId { get; set; } = string.Empty;  // PRO-001
    public string Nombre { get; set; } = string.Empty;
    public string? Contacto { get; set; }
    public string? Telefono { get; set; }
    public string? Email { get; set; }
    public string? Direccion { get; set; }

    // Navegación
    public ICollection<Repuesto> Repuestos { get; set; } = [];
    public ICollection<Compra> Compras { get; set; } = [];
}
