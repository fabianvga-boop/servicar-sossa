using System.Linq.Expressions;
using System.Reflection;
using Microsoft.EntityFrameworkCore;

namespace ServicarSossa.Infrastructure.Extensions;

/// <summary>
/// Búsqueda por palabras para los listados: el texto se separa en palabras y
/// cada una debe aparecer, sin distinguir mayúsculas, en al menos uno de los
/// campos indicados. Así "Javier Mendoza Salinas" encuentra al cliente aunque
/// nombre y apellido estén en columnas distintas, y "Toyota Hilux" encuentra
/// el vehículo aunque marca y modelo también lo estén.
///
/// En SQL queda un AND por palabra de ORs por campo:
/// <c>(nombre ILIKE '%javier%' OR apellido ILIKE '%javier%') AND (...)</c>.
/// </summary>
public static class BusquedaPorPalabras
{
    /// <summary>Una frase larga no debe convertirse en una consulta enorme.</summary>
    private const int MaximoPalabras = 6;

    /// <summary>Carácter de escape de los patrones; usarlo en <c>EF.Functions.ILike</c>.</summary>
    public const string CaracterEscape = "\\";

    private static readonly MethodInfo MetodoILike = typeof(NpgsqlDbFunctionsExtensions).GetMethod(
        nameof(NpgsqlDbFunctionsExtensions.ILike),
        [typeof(DbFunctions), typeof(string), typeof(string), typeof(string)])!;

    public static IQueryable<T> BuscarPorPalabras<T>(
        this IQueryable<T> query, string? texto, params Expression<Func<T, string?>>[] campos)
        => query.BuscarPorPalabras(texto, ademas: null, campos);

    /// <summary>
    /// Igual que la anterior, pero cada palabra también puede coincidir con la
    /// condición <paramref name="ademas"/>: sirve para buscar dentro de una
    /// colección (por ejemplo, los vehículos compatibles de un repuesto).
    /// </summary>
    public static IQueryable<T> BuscarPorPalabras<T>(
        this IQueryable<T> query, string? texto,
        Expression<Func<T, PalabraBuscada, bool>>? ademas,
        params Expression<Func<T, string?>>[] campos)
    {
        var palabras = Palabras(texto);
        if (palabras.Count == 0 || (campos.Length == 0 && ademas is null)) return query;

        var parametro = Expression.Parameter(typeof(T), "x");
        Expression? condicion = null;

        foreach (var palabra in palabras)
        {
            // Envuelta en un objeto para que EF la envíe como parámetro SQL y
            // no la incruste como literal en el texto de la consulta.
            var buscada = Expression.Constant(new PalabraBuscada(
                $"%{Escapar(palabra)}%", ComoAnio(palabra)));
            var patron = Expression.Property(buscada, nameof(PalabraBuscada.Patron));

            Expression? algunCampo = null;
            foreach (var campo in campos)
            {
                var valor = Expression.Coalesce(
                    new ReemplazoParametro(campo.Parameters[0], parametro).Visit(campo.Body)!,
                    Expression.Constant(string.Empty));

                var coincide = Expression.Call(
                    MetodoILike,
                    Expression.Constant(EF.Functions),
                    valor,
                    patron,
                    Expression.Constant(CaracterEscape));

                algunCampo = algunCampo is null ? coincide : Expression.OrElse(algunCampo, coincide);
            }

            if (ademas is not null)
            {
                var extra = new ReemplazoParametro(ademas.Parameters[0], parametro).Visit(
                    new ReemplazoParametro(ademas.Parameters[1], buscada).Visit(ademas.Body)!)!;
                algunCampo = algunCampo is null ? extra : Expression.OrElse(algunCampo, extra);
            }

            condicion = condicion is null ? algunCampo : Expression.AndAlso(condicion, algunCampo!);
        }

        return query.Where(Expression.Lambda<Func<T, bool>>(condicion!, parametro));
    }

    private static List<string> Palabras(string? texto)
        => string.IsNullOrWhiteSpace(texto)
            ? []
            : texto.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Take(MaximoPalabras)
                .ToList();

    /// <summary>"2017" se puede buscar también como año; "123" o "ABC" no.</summary>
    private static short? ComoAnio(string palabra)
        => palabra.Length == 4 && short.TryParse(palabra, out var anio) && anio is >= 1900 and <= 2100
            ? anio
            : null;

    /// <summary>
    /// '%' y '_' son comodines de LIKE: sin escaparlos, buscar "%" traería
    /// todos los registros y "_" cualquier carácter.
    /// </summary>
    private static string Escapar(string palabra)
        => palabra.Replace(CaracterEscape, CaracterEscape + CaracterEscape)
            .Replace("%", CaracterEscape + "%")
            .Replace("_", CaracterEscape + "_");

    private sealed class ReemplazoParametro(ParameterExpression anterior, Expression nuevo)
        : ExpressionVisitor
    {
        protected override Expression VisitParameter(ParameterExpression node)
            => node == anterior ? nuevo : base.VisitParameter(node);
    }
}

/// <summary>
/// Una palabra de la búsqueda, lista para una condición propia: el patrón ILIKE
/// ya escapado (<c>%palabra%</c>) y, si la palabra es un año, ese año.
/// </summary>
public sealed record PalabraBuscada(string Patron, short? Anio);
