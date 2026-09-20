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

    // --- Datos fiscales (preparación SIAT) ------------------------------------
    // Nullables a propósito: hoy el taller emite recibos internos y nadie los
    // carga. El día que se habilite la facturación en línea se completan sin
    // migrar nada, porque `CiNit` sigue siendo el dato que usa el taller.

    /// <summary>Código del catálogo del SIN. Ver <see cref="TipoDocumentoIdentidad"/>.</summary>
    public TipoDocumentoIdentidad? TipoDocumentoId { get; set; }

    /// <summary>
    /// Número de documento tal como lo pide el SIAT. Se guarda aparte de
    /// <see cref="CiNit"/> porque ese campo es de uso interno y admite formatos
    /// que el webservice rechazaría.
    /// </summary>
    public string? NumeroDocumento { get; set; }

    /// <summary>Complemento del CI: la letra que acompaña a algunos carnets.</summary>
    public string? Complemento { get; set; }

    // Navegación
    public ICollection<Vehiculo> Vehiculos { get; set; } = [];
    public ICollection<OrdenTrabajo> OrdenesTrabajo { get; set; } = [];
    public ICollection<Venta> Ventas { get; set; } = [];
}
