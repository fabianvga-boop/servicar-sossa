using ServicarSossa.Domain.Entities;

namespace ServicarSossa.Application.Interfaces;

/// <summary>Repositorio del catálogo de servicios.</summary>
public interface ITipoServicioRepository : IRepository<TipoServicio>
{
    Task<(IEnumerable<TipoServicio> Items, int Total)> BuscarAsync(
        string? buscar, bool soloActivos, int pagina, int tamanoPagina, CancellationToken ct = default);

    /// <summary>
    /// Servicio con sus categorías, con seguimiento: para editarlas, porque los
    /// enlaces que se quitan de la colección se borran al guardar.
    /// </summary>
    Task<TipoServicio?> GetConCategoriasAsync(string servicioId, CancellationToken ct = default);
}
