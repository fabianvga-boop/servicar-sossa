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

    /// <summary>USU014 — historial filtrable por vehículo, mecánico o estado.</summary>
    Task<IEnumerable<Diagnostico>> BuscarAsync(
        string? vehiculoId,
        string? mecanicoId,
        EstadoDiag? estado,
        CancellationToken ct = default);
}
