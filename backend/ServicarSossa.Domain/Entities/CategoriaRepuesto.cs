namespace ServicarSossa.Domain.Entities;

/// <summary>
/// Tabla <c>categorias_repuesto</c>. PK formato CAT-000.
/// Tipo de repuesto (Aceite de motor, Bujías, Batería…). La lista la mantiene
/// el Administrador. Los servicios del catálogo se enlazan a categorías y no a
/// un repuesto concreto: así un solo "Cambio de aceite" cubre todos los aceites
/// del inventario, los de hoy y los que se compren después.
/// </summary>
public class CategoriaRepuesto
{
    public string CategoriaId { get; set; } = string.Empty;   // CAT-001
    public string Nombre { get; set; } = string.Empty;        // UNIQUE
    public DateTime FechaRegistro { get; set; } = DateTime.UtcNow;

    // Navegación
    public ICollection<Repuesto> Repuestos { get; set; } = [];
    public ICollection<ServicioCategoria> Servicios { get; set; } = [];
}
