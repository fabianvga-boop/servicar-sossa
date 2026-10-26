namespace ServicarSossa.Domain.Entities;

/// <summary>
/// Tabla <c>repuesto_compatibilidad</c>. PK formato RCP-000.
/// Un vehículo en el que calza un repuesto Específico: marca obligatoria,
/// modelo opcional (vacío = todos los modelos de la marca) y rango de años
/// opcional (vacío = sin límite).
/// </summary>
public class RepuestoCompatibilidad
{
    public string CompatibilidadId { get; set; } = string.Empty;   // RCP-001
    public string RepuestoId { get; set; } = string.Empty;
    public string Marca { get; set; } = string.Empty;
    public string? Modelo { get; set; }
    public short? AnioDesde { get; set; }
    public short? AnioHasta { get; set; }

    // Navegación
    public Repuesto Repuesto { get; set; } = null!;

    /// <summary>
    /// True si el vehículo cae dentro de esta compatibilidad. Compara sin
    /// distinguir mayúsculas ni espacios de los extremos. Si el vehículo no
    /// tiene año registrado, el rango de años no puede descartarlo.
    /// </summary>
    public bool Admite(string marca, string modelo, short? anio)
    {
        if (!Igual(Marca, marca)) return false;
        if (!string.IsNullOrWhiteSpace(Modelo) && !Igual(Modelo, modelo)) return false;
        if (anio is null) return true;
        if (AnioDesde is not null && anio < AnioDesde) return false;
        if (AnioHasta is not null && anio > AnioHasta) return false;
        return true;
    }

    /// <summary>Texto legible: "Toyota Corolla 2015–2020", "Toyota (todos) desde 2018".</summary>
    public string Descripcion()
    {
        var vehiculo = string.IsNullOrWhiteSpace(Modelo) ? $"{Marca} (todos los modelos)" : $"{Marca} {Modelo}";
        var anios = (AnioDesde, AnioHasta) switch
        {
            (null, null) => string.Empty,
            ({ } d, null) => $" desde {d}",
            (null, { } h) => $" hasta {h}",
            ({ } d, { } h) when d == h => $" {d}",
            ({ } d, { } h) => $" {d}–{h}",
        };
        return vehiculo + anios;
    }

    private static bool Igual(string? a, string? b)
        => string.Equals(a?.Trim(), b?.Trim(), StringComparison.OrdinalIgnoreCase);
}
