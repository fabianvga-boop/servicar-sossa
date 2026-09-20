using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Interfaces;

/// <summary>
/// Repositorio de diagnósticos. Las consultas de lectura incluyen vehículo,
/// cliente y mecánico porque la respuesta los expone juntos.
/// </summary>
public interface IDiagnosticoRepository : IRepository<Diagnostico>
{
    Task<Diagnostico?> GetByIdCompletoAsync(string diagnosticoId, CancellationToken ct = default);

    /// <summary>
    /// USU014 — historial filtrable por vehículo, mecánico o estado, sin paginar.
    /// La usa el historial del vehículo, que necesita la trazabilidad completa.
    /// </summary>
    Task<IEnumerable<Diagnostico>> BuscarAsync(
        string? vehiculoId,
        string? mecanicoId,
        EstadoDiag? estado,
        CancellationToken ct = default);

    /// <summary>
    /// Misma búsqueda que <see cref="BuscarAsync"/>, para la pantalla de listado.
    /// <paramref name="buscar"/> compara contra la falla reportada, las
    /// observaciones técnicas y la placa del vehículo.
    /// </summary>
    Task<(IEnumerable<Diagnostico> Items, int Total)> BuscarPaginadoAsync(
        string? vehiculoId,
        string? mecanicoId,
        EstadoDiag? estado,
        string? buscar,
        int pagina, int tamanoPagina,
        CancellationToken ct = default);

    /// <summary>
    /// Diagnóstico asistido: candidatos para comparar contra una falla nueva —
    /// solo los que ya se convirtieron en orden de trabajo (si no hay orden no
    /// hay servicios/repuestos reales que sugerir), con esa orden ya cargada.
    /// </summary>
    Task<IEnumerable<Diagnostico>> ObtenerConOrdenParaSugerenciasAsync(CancellationToken ct = default);
}
