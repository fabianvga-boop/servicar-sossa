namespace ServicarSossa.Domain.Entities;

/// <summary>
/// Tabla puente <c>servicio_categorias</c> (tipos_servicio ↔ categorias_repuesto).
/// PK compuesta. Qué tipos de repuesto lleva normalmente un servicio del catálogo.
/// </summary>
public class ServicioCategoria
{
    public string ServicioId { get; set; } = string.Empty;
    public string CategoriaId { get; set; } = string.Empty;

    // Navegación
    public TipoServicio Servicio { get; set; } = null!;
    public CategoriaRepuesto Categoria { get; set; } = null!;
}
