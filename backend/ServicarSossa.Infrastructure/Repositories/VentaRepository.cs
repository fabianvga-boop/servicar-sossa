using Microsoft.EntityFrameworkCore;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;
using ServicarSossa.Infrastructure.Data;
using ServicarSossa.Infrastructure.Extensions;

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
        => await ConstruirConsulta(clienteId, estado, desde, hasta).ToListAsync(ct);

    public async Task<(IEnumerable<Venta> Items, int Total)> BuscarPaginadoAsync(
        string? clienteId, EstadoVenta? estado,
        DateTime? desde, DateTime? hasta, int pagina, int tamanoPagina, CancellationToken ct = default)
        => await ConstruirConsulta(clienteId, estado, desde, hasta)
            .ToPagedListAsync(pagina, tamanoPagina, ct);

    private IQueryable<Venta> ConstruirConsulta(
        string? clienteId, EstadoVenta? estado, DateTime? desde, DateTime? hasta)
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

        return query.OrderByDescending(v => v.FechaVenta);
    }

    public async Task AddDetalleAsync(VentaDetalle detalle, CancellationToken ct = default)
        => await Context.VentaDetalles.AddAsync(detalle, ct);
}
