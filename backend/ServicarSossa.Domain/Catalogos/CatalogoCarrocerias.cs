using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Domain.Catalogos;

/// <summary>
/// Resuelve el tipo de carrocería (para elegir el diagrama vectorial del
/// vehículo) a partir de Marca/Modelo, sin depender de un campo nuevo en la
/// tabla <c>vehiculos</c>. Es una heurística por palabras clave del modelo y,
/// si no hay match, por marca; ante duda cae en <see cref="TipoCarroceria.Generico"/>.
/// </summary>
/// <remarks>
/// Pensado para ampliarse con el tiempo a medida que aparezcan modelos nuevos
/// en el taller: agregar una palabra clave acá no requiere migración de BD.
/// </remarks>
public static class CatalogoCarrocerias
{
    // Se evalúan en orden: la primera palabra clave que aparezca en el modelo gana.
    private static readonly (string Palabra, TipoCarroceria Tipo)[] PorModelo =
    [
        ("hilux", TipoCarroceria.Pickup),
        ("dmax", TipoCarroceria.Pickup),
        ("d-max", TipoCarroceria.Pickup),
        ("l200", TipoCarroceria.Pickup),
        ("ranger", TipoCarroceria.Pickup),
        ("frontier", TipoCarroceria.Pickup),
        ("amarok", TipoCarroceria.Pickup),
        ("navara", TipoCarroceria.Pickup),
        ("tacoma", TipoCarroceria.Pickup),
        ("f-150", TipoCarroceria.Pickup),
        ("silverado", TipoCarroceria.Pickup),

        ("fortuner", TipoCarroceria.Suv),
        ("prado", TipoCarroceria.Suv),
        ("land cruiser", TipoCarroceria.Suv),
        ("rav4", TipoCarroceria.Suv),
        ("cr-v", TipoCarroceria.Suv),
        ("crv", TipoCarroceria.Suv),
        ("tucson", TipoCarroceria.Suv),
        ("santa fe", TipoCarroceria.Suv),
        ("sportage", TipoCarroceria.Suv),
        ("x-trail", TipoCarroceria.Suv),
        ("xtrail", TipoCarroceria.Suv),
        ("cx-5", TipoCarroceria.Suv),
        ("outlander", TipoCarroceria.Suv),
        ("montero", TipoCarroceria.Suv),
        ("grand vitara", TipoCarroceria.Suv),
        ("duster", TipoCarroceria.Suv),

        ("hiace", TipoCarroceria.Furgon),
        ("h100", TipoCarroceria.Furgon),
        ("sprinter", TipoCarroceria.Furgon),
        ("transit", TipoCarroceria.Furgon),
        ("nhr", TipoCarroceria.Camion),
        ("npr", TipoCarroceria.Camion),
        ("fh", TipoCarroceria.Camion),

        ("yaris", TipoCarroceria.Hatchback),
        ("i10", TipoCarroceria.Hatchback),
        ("march", TipoCarroceria.Hatchback),
        ("spark", TipoCarroceria.Hatchback),
        ("swift", TipoCarroceria.Hatchback),
    ];

    // Marcas casi exclusivas de motos, para cuando el modelo no dice nada por sí solo.
    private static readonly HashSet<string> MarcasMoto = new(StringComparer.OrdinalIgnoreCase)
    {
        "Yamaha", "Honda Moto", "Bajaj", "TVS", "Suzuki Moto", "Keeway", "Zongshen", "Kymco",
    };

    public static TipoCarroceria Resolver(string? marca, string? modelo)
    {
        var textoModelo = (modelo ?? string.Empty).Trim();

        foreach (var (palabra, tipo) in PorModelo)
            if (textoModelo.Contains(palabra, StringComparison.OrdinalIgnoreCase))
                return tipo;

        if (!string.IsNullOrWhiteSpace(marca) && MarcasMoto.Contains(marca.Trim()))
            return TipoCarroceria.Moto;

        return TipoCarroceria.Generico;
    }
}
