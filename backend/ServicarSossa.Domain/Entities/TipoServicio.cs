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

    // --- Datos fiscales (preparación SIAT) ------------------------------------
    // La mano de obra también se factura, así que el catálogo de servicios
    // necesita su homologación igual que los repuestos. Ver Repuesto.CodigoSin.

    /// <summary>Código de servicio del catálogo del SIN.</summary>
    public string? CodigoSin { get; set; }

    /// <summary>Código de unidad de medida del SIN (para servicios suele ser "unidad").</summary>
    public int? UnidadMedidaSin { get; set; }

    // Navegación
    public ICollection<OrdenServicio> OrdenServicios { get; set; } = [];
}
