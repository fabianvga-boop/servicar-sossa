using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Domain.Entities;

/// <summary>Tabla <c>clientes</c>. PK formato CLI-000.</summary>
public class Cliente
{
    public string ClienteId { get; set; } = string.Empty;    // CLI-001
    public string Nombre { get; set; } = string.Empty;
    public string? Apellido { get; set; }
    public string? RazonSocial { get; set; }                 // para clientes tipo empresa
    public string CiNit { get; set; } = string.Empty;        // UNIQUE
    public string? Telefono { get; set; }
    public string? Email { get; set; }
    public string? Direccion { get; set; }
    public DateTime FechaRegistro { get; set; } = DateTime.UtcNow;
    public EstadoCliente Estado { get; set; } = EstadoCliente.Activo;

    // Navegación
    public ICollection<Vehiculo> Vehiculos { get; set; } = [];
    public ICollection<OrdenTrabajo> OrdenesTrabajo { get; set; } = [];
    public ICollection<Venta> Ventas { get; set; } = [];
}
