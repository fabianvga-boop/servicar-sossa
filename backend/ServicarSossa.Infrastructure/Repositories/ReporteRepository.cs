using Microsoft.EntityFrameworkCore;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;
using ServicarSossa.Infrastructure.Data;

namespace ServicarSossa.Infrastructure.Repositories;

/// <inheritdoc cref="IReporteRepository"/>
public class ReporteRepository(AppDbContext context) : IReporteRepository
{
    public async Task<IEnumerable<FilaVentaDto>> VentasAsync(
        DateTime desde, DateTime hasta, CancellationToken ct = default)
        => await context.Facturas
            .AsNoTracking()
            .Where(f => f.FechaEmision >= desde && f.FechaEmision <= hasta)
            .OrderBy(f => f.FechaEmision)
            .Select(f => new FilaVentaDto(
                f.FacturaId,
                f.FechaEmision,
                f.Orden.Cliente.RazonSocial ?? (f.Orden.Cliente.Nombre + " " + f.Orden.Cliente.Apellido),
                f.Orden.Vehiculo.Placa,
                f.Total,
                f.Pagos.Sum(p => (decimal?)p.Monto) ?? 0m,
                f.Estado.ToString()))
            .ToListAsync(ct);

    public async Task<IEnumerable<FilaComisionDto>> ComisionesAsync(
        DateTime desde, DateTime hasta, CancellationToken ct = default)
        => await context.Comisiones
            .AsNoTracking()
            .Where(c => c.FechaCalculo >= desde && c.FechaCalculo <= hasta)
            .GroupBy(c => new { c.MecanicoId, c.Mecanico.Nombre, c.Mecanico.Apellido })
            .Select(g => new FilaComisionDto(
                g.Key.MecanicoId,
                g.Key.Nombre + " " + g.Key.Apellido,
                g.Select(c => c.OrdenId).Distinct().Count(),
                g.Where(c => c.EstadoPago == EstadoPago.Pendiente).Sum(c => (decimal?)c.Monto) ?? 0m,
                g.Where(c => c.EstadoPago == EstadoPago.Pagado).Sum(c => (decimal?)c.Monto) ?? 0m))
            .ToListAsync(ct);

    public async Task<IEnumerable<FilaInventarioDto>> InventarioAsync(
        CancellationToken ct = default)
        => await context.Repuestos
            .AsNoTracking()
            .OrderBy(r => r.Nombre)
            .Select(r => new FilaInventarioDto(
                r.RepuestoId,
                r.Nombre,
                r.Proveedor != null ? r.Proveedor.Nombre : null,
                r.StockActual,
                r.StockMinimo,
                r.PrecioCompra,
                r.PrecioVenta))
            .ToListAsync(ct);

    public async Task<IEnumerable<FilaOrdenDto>> OrdenesAsync(
        DateTime desde, DateTime hasta, CancellationToken ct = default)
        => await context.OrdenesTrabajo
            .AsNoTracking()
            .Where(o => o.FechaCreacion >= desde && o.FechaCreacion <= hasta)
            .OrderBy(o => o.FechaCreacion)
            .Select(o => new FilaOrdenDto(
                o.OrdenId,
                o.FechaCreacion,
                o.FechaCierre,
                o.Cliente.RazonSocial ?? (o.Cliente.Nombre + " " + o.Cliente.Apellido),
                o.Vehiculo.Placa,
                o.Estado.ToString(),
                o.Servicios.Sum(s => (decimal?)s.Precio) ?? 0m,
                o.Repuestos.Sum(r => (decimal?)(r.Cantidad * r.PrecioUnitario)) ?? 0m))
            .ToListAsync(ct);

    public async Task AgregarBitacoraAsync(
        ReporteGenerado reporte, CancellationToken ct = default)
        => await context.ReportesGenerados.AddAsync(reporte, ct);

    public async Task<IEnumerable<ReporteGenerado>> GetBitacoraAsync(
        string? tipoReporte, CancellationToken ct = default)
    {
        var query = context.ReportesGenerados.Include(r => r.Usuario).AsNoTracking();

        if (!string.IsNullOrWhiteSpace(tipoReporte))
            query = query.Where(r => r.TipoReporte == tipoReporte);

        return await query.OrderByDescending(r => r.FechaGeneracion).Take(200).ToListAsync(ct);
    }

    public async Task<int> GuardarAsync(CancellationToken ct = default)
        => await context.SaveChangesAsync(ct);
}
