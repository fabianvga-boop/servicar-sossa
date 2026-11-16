using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Domain.Entities;

/// <summary>Tabla <c>tipos_servicio</c> (catálogo). PK formato SER-000.</summary>
public class TipoServicio
{
    public string ServicioId { get; set; } = string.Empty;   // SER-001
    public string Nombre { get; set; } = string.Empty;
    public string? Descripcion { get; set; }
    public decimal PrecioBase { get; set; }
    public EstadoServicio Estado { get; set; } = EstadoServicio.Activo;

    /// <summary>
    /// El servicio consume un repuesto (cambio de aceite, de batería…): en la
    /// orden no se puede completar sin registrar el repuesto que se usó.
    /// </summary>
    public bool RequiereRepuesto { get; set; }

    // Navegación
    public ICollection<OrdenServicio> OrdenServicios { get; set; } = [];

    /// <summary>
    /// Tipos de repuesto que lleva el servicio. En la orden no se le registra un
    /// repuesto del inventario de otra categoría (salvo excepción del Administrador).
    /// Vacío = acepta cualquier repuesto.
    /// </summary>
    public ICollection<ServicioCategoria> Categorias { get; set; } = [];
}
