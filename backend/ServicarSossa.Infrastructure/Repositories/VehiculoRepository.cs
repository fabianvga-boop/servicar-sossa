using Microsoft.EntityFrameworkCore;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Infrastructure.Data;
using ServicarSossa.Infrastructure.Extensions;

namespace ServicarSossa.Infrastructure.Repositories;

/// <inheritdoc cref="IVehiculoRepository"/>
public class VehiculoRepository(AppDbContext context)
    : Repository<Vehiculo>(context), IVehiculoRepository
{
    public async Task<Vehiculo?> GetByIdConClienteAsync(
        string vehiculoId, CancellationToken ct = default)
        => await Set.Include(v => v.Cliente)
                    .AsNoTracking()
                    .FirstOrDefaultAsync(v => v.VehiculoId == vehiculoId, ct);

    public async Task<(IEnumerable<Vehiculo> Items, int Total)> BuscarAsync(
        string? buscar, string? clienteId, int pagina, int tamanoPagina, CancellationToken ct = default)
    {
        var query = Set.Include(v => v.Cliente).AsNoTracking();

        if (!string.IsNullOrWhiteSpace(clienteId))
            query = query.Where(v => v.ClienteId == clienteId);       // USU011

        // Incluye al dueño: en el taller se pregunta "el auto de Mendoza" tanto
        // como "la Hilux".
        query = query.BuscarPorPalabras(buscar,
            v => v.VehiculoId, v => v.Placa, v => v.Marca, v => v.Modelo,
            v => v.Cliente.Nombre, v => v.Cliente.Apellido, v => v.Cliente.RazonSocial);

        // Los más recientes primero, como en clientes: el vehículo recién
        // registrado queda arriba en la lista y en el selector del diagnóstico.
        return await query.OrderByDescending(v => v.FechaRegistro)
                          .ThenByDescending(v => v.VehiculoId)
                          .ToPagedListAsync(pagina, tamanoPagina, ct);
    }
}
