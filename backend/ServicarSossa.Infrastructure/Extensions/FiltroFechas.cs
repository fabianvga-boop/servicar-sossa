namespace ServicarSossa.Infrastructure.Extensions;

/// <summary>
/// Límites de un filtro "desde / hasta" por día completo, listos para comparar
/// contra columnas <c>timestamptz</c>.
///
/// Las fechas que llegan por la query string se enlazan con
/// <c>Kind=Unspecified</c>, y Npgsql solo acepta <c>Kind=Utc</c> para
/// <c>timestamp with time zone</c>: comparadas tal cual, la consulta lanza
/// <see cref="ArgumentException"/>. Además se descarta cualquier hora que haya
/// llegado, porque el filtro es por día: "hasta" incluye todo ese día.
/// </summary>
public static class FiltroFechas
{
    /// <summary>00:00 del día indicado, en UTC.</summary>
    public static DateTime InicioDelDia(DateTime fecha)
        => DateTime.SpecifyKind(fecha.Date, DateTimeKind.Utc);

    /// <summary>00:00 del día siguiente, en UTC: el límite exclusivo de "hasta".</summary>
    public static DateTime FinDelDia(DateTime fecha)
        => DateTime.SpecifyKind(fecha.Date.AddDays(1), DateTimeKind.Utc);
}
