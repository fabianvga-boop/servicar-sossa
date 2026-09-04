using ServicarSossa.Domain.Entities;

namespace ServicarSossa.Application.Interfaces;

/// <summary>Repositorio de clientes con las consultas que el genérico no cubre.</summary>
public interface IClienteRepository : IRepository<Cliente>
{
    Task<IEnumerable<Cliente>> BuscarAsync(string? buscar, CancellationToken ct = default);

    /// <summary>
    /// Placas de los vehículos de cada cliente, en una sola consulta que
    /// proyecta solo las dos columnas necesarias. La cantidad sale de contar
    /// la lista, así que reemplaza al viejo GROUP BY sin sumar viajes.
    /// </summary>
    Task<Dictionary<string, List<string>>> ObtenerPlacasPorClienteAsync(
        IEnumerable<string> clienteIds, CancellationToken ct = default);
}
