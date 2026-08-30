using ServicarSossa.Domain.Entities;

namespace ServicarSossa.Application.Interfaces;

/// <summary>Repositorio del catálogo de servicios.</summary>
public interface ITipoServicioRepository : IRepository<TipoServicio>
{
    Task<IEnumerable<TipoServicio>> BuscarAsync(
        string? buscar, bool soloActivos, CancellationToken ct = default);
}
