using ServicarSossa.Domain.Entities;

namespace ServicarSossa.Application.Interfaces;

/// <summary>
/// Repositorio de vehículos con las consultas que el genérico no cubre: todas
/// incluyen el <see cref="Cliente"/> porque la respuesta muestra el propietario.
/// </summary>
public interface IVehiculoRepository : IRepository<Vehiculo>
{
    Task<Vehiculo?> GetByIdConClienteAsync(string vehiculoId, CancellationToken ct = default);

    Task<IEnumerable<Vehiculo>> BuscarAsync(
        string? buscar, string? clienteId, CancellationToken ct = default);
}
