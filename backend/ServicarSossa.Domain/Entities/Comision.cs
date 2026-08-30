using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Domain.Entities;

/// <summary>
/// Tabla <c>comisiones</c>. PK formato COM-000.
/// Se genera al cerrar una orden: monto = suma de servicios del mecánico * porcentaje / 100.
/// La BD impone UNIQUE (orden_id, mecanico_id) para evitar duplicados si se cierra dos veces.
/// </summary>
public class Comision
{
    public string ComisionId { get; set; } = string.Empty;   // COM-001
    public string OrdenId { get; set; } = string.Empty;
    public string MecanicoId { get; set; } = string.Empty;
    public decimal Monto { get; set; }
    public DateTime FechaCalculo { get; set; } = DateTime.UtcNow;
    public EstadoPago EstadoPago { get; set; } = EstadoPago.Pendiente;
    public DateTime? FechaPago { get; set; }

    // Navegación
    public OrdenTrabajo Orden { get; set; } = null!;
    public Usuario Mecanico { get; set; } = null!;
}
