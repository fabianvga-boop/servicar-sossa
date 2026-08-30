using Microsoft.EntityFrameworkCore;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;
using ServicarSossa.Infrastructure.Data;

namespace ServicarSossa.Infrastructure.Repositories;

public class VentaRepository(AppDbContext context) : Repository<Venta>(context), IVentaRepository
{
    public async Task<Venta?> GetByIdCompletaAsync(string id, CancellationToken ct = default)
        => await Set.Include(v => v.Cliente)
                    .Include(v => v.Usuario)
                    .Include(v => v.Detalles).ThenInclude(d => d.Repuesto)
                    .FirstOrDefaultAsync(v => v.VentaId == id, ct);

    public async Task<IEnumerable<Venta>> BuscarAsync(
        string? clienteId, EstadoVenta? estado,
        DateTime? desde, DateTime? hasta, CancellationToken ct = default)
    {
        var query = Set.Include(v => v.Cliente)
                       .Include(v => v.Usuario)
                       .Include(v => v.Detalles).ThenInclude(d => d.Repuesto)
                       .AsNoTracking()
                       .AsQueryable();

        if (!string.IsNullOrWhiteSpace(clienteId))
            query = query.Where(v => v.ClienteId == clienteId);

        if (estado.HasValue)
            query = query.Where(v => v.Estado == estado.Value);

        if (desde.HasValue)
            query = query.Where(v => v.FechaVenta >= desde.Value);

        if (hasta.HasValue)
        {
            // El filtro "hasta" incluye todo el día indicado.
            var limite = hasta.Value.Date.AddDays(1);
            query = query.Where(v => v.FechaVenta < limite);
        }

        return await query.OrderByDescending(v => v.FechaVenta).ToListAsync(ct);
    }

    public async Task AddDetalleAsync(VentaDetalle detalle, CancellationToken ct = default)
        => await Context.VentaDetalles.AddAsync(detalle, ct);
}
