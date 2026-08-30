using System.ComponentModel.DataAnnotations;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.DTOs.Ordenes;

// ---------------------------------------------------------------- Mecánicos

/// <summary>USU022 — asigna un mecánico a la orden.</summary>
public class AsignarMecanicoDto
{
    [Required(ErrorMessage = "El mecánico es obligatorio.")]
    [RegularExpression(@"^USU-\d{3,}$", ErrorMessage = "El mecánico debe tener el formato USU-000.")]
    public string MecanicoId { get; set; } = string.Empty;
}

public class OrdenMecanicoResponseDto
{
    public string MecanicoId { get; set; } = string.Empty;
    public string NombreMecanico { get; set; } = string.Empty;
    public DateTime FechaAsignacion { get; set; }
}

// ---------------------------------------------------------------- Servicios

/// <summary>
/// USU023 — agrega un servicio ejecutado a la orden. Del catálogo (
/// <see cref="ServicioId"/>, precio opcional: si no se envía se toma el
/// <c>precio_base</c>) o suelto, fuera de catálogo (<see cref="NombreLibre"/>
/// y <see cref="Precio"/> obligatorios).
/// </summary>
public class OrdenServicioRequestDto : IValidatableObject
{
    /// <summary>Obligatorio solo si el servicio viene del catálogo.</summary>
    [RegularExpression(@"^SER-\d{3,}$", ErrorMessage = "El servicio debe tener el formato SER-000.")]
    public string? ServicioId { get; set; }

    /// <summary>Nombre libre del servicio cuando no está en el catálogo.</summary>
    [MaxLength(150, ErrorMessage = "El nombre no puede superar los 150 caracteres.")]
    public string? NombreLibre { get; set; }

    /// <summary>El mecánico que ejecuta; es la base del cálculo de su comisión.</summary>
    [Required(ErrorMessage = "El mecánico responsable es obligatorio.")]
    [RegularExpression(@"^USU-\d{3,}$", ErrorMessage = "El mecánico debe tener el formato USU-000.")]
    public string MecanicoId { get; set; } = string.Empty;

    /// <summary>Diagnóstico que originó el servicio (opcional).</summary>
    [RegularExpression(@"^DIA-\d{3,}$", ErrorMessage = "El diagnóstico debe tener el formato DIA-000.")]
    public string? DiagnosticoId { get; set; }

    [MaxLength(255)]
    public string? Descripcion { get; set; }

    /// <summary>Catálogo: si es null se usa el precio base. Fuera de catálogo: obligatorio.</summary>
    [Range(0, 99999999.99, ErrorMessage = "El precio no puede ser negativo.")]
    public decimal? Precio { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (string.IsNullOrWhiteSpace(ServicioId))
        {
            if (string.IsNullOrWhiteSpace(NombreLibre))
                yield return new ValidationResult(
                    "Indique el servicio del catálogo o describa el trabajo realizado.",
                    [nameof(ServicioId), nameof(NombreLibre)]);

            if (Precio is null || Precio <= 0)
                yield return new ValidationResult(
                    "Un servicio fuera de catálogo exige el precio cobrado.", [nameof(Precio)]);
        }
    }
}

public class CambiarEstadoOrdenServicioDto
{
    [Required(ErrorMessage = "El estado es obligatorio.")]
    public EstadoServicioOrden Estado { get; set; }
}

public class OrdenServicioResponseDto
{
    public string OrdenServicioId { get; set; } = string.Empty;
    public string? ServicioId { get; set; }
    public string NombreServicio { get; set; } = string.Empty;
    public string MecanicoId { get; set; } = string.Empty;
    public string NombreMecanico { get; set; } = string.Empty;
    public string? DiagnosticoId { get; set; }
    public string? Descripcion { get; set; }
    public decimal Precio { get; set; }
    public EstadoServicioOrden Estado { get; set; }
}

// ---------------------------------------------------------------- Repuestos

/// <summary>
/// Repuesto usado en la orden. El precio unitario se congela al momento de
/// agregarlo. El <see cref="Origen"/> decide las reglas:
///   * <c>Inventario</c>    — exige <see cref="RepuestoId"/>; sale del stock y se cobra.
///   * <c>ClienteTrae</c>   — exige <see cref="Descripcion"/>; no se cobra (precio 0).
///   * <c>CompraExterna</c> — exige <see cref="Descripcion"/> y precio; se cobra al costo.
/// </summary>
public class OrdenRepuestoRequestDto : IValidatableObject
{
    public OrigenRepuesto Origen { get; set; } = OrigenRepuesto.Inventario;

    /// <summary>Obligatorio solo cuando el origen es Inventario.</summary>
    [RegularExpression(@"^REP-\d{3,}$", ErrorMessage = "El repuesto debe tener el formato REP-000.")]
    public string? RepuestoId { get; set; }

    /// <summary>Nombre libre del repuesto cuando no sale del inventario.</summary>
    [MaxLength(150, ErrorMessage = "La descripción no puede superar los 150 caracteres.")]
    public string? Descripcion { get; set; }

    [Range(1, int.MaxValue, ErrorMessage = "La cantidad debe ser mayor a cero.")]
    public int Cantidad { get; set; }

    /// <summary>
    /// Inventario: si es null se usa el precio vigente del repuesto.
    /// Compra externa: es el costo pagado (obligatorio). Cliente trae: se ignora (queda en 0).
    /// </summary>
    [Range(0, 99999999.99, ErrorMessage = "El precio unitario no puede ser negativo.")]
    public decimal? PrecioUnitario { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (Origen == OrigenRepuesto.Inventario)
        {
            if (string.IsNullOrWhiteSpace(RepuestoId))
                yield return new ValidationResult(
                    "Debe indicar el repuesto del inventario.", [nameof(RepuestoId)]);
        }
        else
        {
            if (string.IsNullOrWhiteSpace(Descripcion))
                yield return new ValidationResult(
                    "Debe describir el repuesto que no proviene del inventario.",
                    [nameof(Descripcion)]);

            if (Origen == OrigenRepuesto.CompraExterna
                && (PrecioUnitario is null || PrecioUnitario <= 0))
                yield return new ValidationResult(
                    "La compra externa exige el costo del repuesto.", [nameof(PrecioUnitario)]);
        }
    }
}

public class OrdenRepuestoResponseDto
{
    public string OrdenRepuestoId { get; set; } = string.Empty;
    public string? RepuestoId { get; set; }
    public OrigenRepuesto Origen { get; set; }
    public string NombreRepuesto { get; set; } = string.Empty;
    public int Cantidad { get; set; }
    public decimal PrecioUnitario { get; set; }
    public decimal Subtotal { get; set; }
}
