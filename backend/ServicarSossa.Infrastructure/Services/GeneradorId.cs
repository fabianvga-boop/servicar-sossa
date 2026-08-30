using Microsoft.EntityFrameworkCore;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Infrastructure.Data;

namespace ServicarSossa.Infrastructure.Services;

/// <summary>
/// Genera las PKs alfanuméricas leyendo el mayor sufijo numérico existente y
/// sumando uno. Verifica que el código resultante no exista antes de devolverlo
/// (requisito del CLAUDE.md) y, si lo encuentra ocupado, avanza al siguiente.
/// </summary>
/// <remarks>
/// Bajo concurrencia alta dos peticiones simultáneas podrían calcular el mismo
/// código; la PK de PostgreSQL lo rechazaría con error 23505. Para el volumen de
/// un taller esto es aceptable, y el CHECK de formato del DDL garantiza que nunca
/// se inserte un código mal construido.
/// </remarks>
public class GeneradorId(AppDbContext context) : IGeneradorId
{
    private const int AnchoMinimo = 3;   // CLI-001

    public async Task<string> SiguienteAsync<T>(string prefijo, CancellationToken ct = default)
        where T : class
    {
        prefijo = prefijo.ToUpperInvariant();

        var nombrePk = context.Model.FindEntityType(typeof(T))
            ?.FindPrimaryKey()?.Properties.Single().Name
            ?? throw new InvalidOperationException(
                $"La entidad {typeof(T).Name} no tiene una PK simple configurada.");

        // Trae solo los códigos con el prefijo esperado y calcula el máximo sufijo.
        var codigos = await context.Set<T>()
            .Select(e => EF.Property<string>(e, nombrePk))
            .Where(c => c.StartsWith(prefijo + "-"))
            .ToListAsync(ct);

        var maximo = codigos
            .Select(c => int.TryParse(c[(prefijo.Length + 1)..], out var n) ? n : 0)
            .DefaultIfEmpty(0)
            .Max();

        // Verifica que no exista antes de devolverlo; avanza si está ocupado.
        var ocupados = codigos.ToHashSet(StringComparer.OrdinalIgnoreCase);
        string candidato;
        do
        {
            maximo++;
            candidato = $"{prefijo}-{maximo.ToString().PadLeft(AnchoMinimo, '0')}";
        } while (ocupados.Contains(candidato));

        return candidato;
    }
}
