using ServicarSossa.Domain.Entities;

namespace ServicarSossa.Application.Interfaces;

/// <summary>Repositorio de clientes con las consultas que el genérico no cubre.</summary>
public interface IClienteRepository : IRepository<Cliente>
{
    Task<IEnumerable<Cliente>> BuscarAsync(string? buscar, CancellationToken ct = default);

    /// <summary>Cantidad de vehículos por cliente, calculada en el servidor (GROUP BY).</summary>
    Task<Dictionary<string, int>> ContarVehiculosPorClienteAsync(
        IEnumerable<string> clienteIds, CancellationToken ct = default);
}
