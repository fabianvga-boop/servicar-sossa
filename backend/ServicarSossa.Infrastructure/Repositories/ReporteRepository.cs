using Microsoft.EntityFrameworkCore;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;
using ServicarSossa.Infrastructure.Data;
using ServicarSossa.Infrastructure.Extensions;

namespace ServicarSossa.Infrastructure.Repositories;

/// <inheritdoc cref="IReporteRepository"/>
public class ReporteRepository(AppDbContext context) : IReporteRepository
{
    public async Task<IEnumerable<FilaVentaDto>> VentasAsync(
        DateTime desde, DateTime hasta, CancellationToken ct = default)
        // Se reporta sobre proformas, no sobre facturas: es contra la proforma
        // que el cliente paga, así que ahí está el dinero del taller. La tabla
        // de facturas guarda lo fiscal y estaría vacía sin NIT habilitado.
        => await context.Proformas
            .AsNoTracking()
            .Where(p => p.FechaEmision >= desde && p.FechaEmision <= hasta)
            .OrderBy(p => p.FechaEmision)
            .Select(p => new FilaVentaDto(
                p.ProformaId,
                p.FechaEmision,
                p.Orden.Cliente.RazonSocial ?? (p.Orden.Cliente.Nombre + " " + p.Orden.Cliente.Apellido),
                p.Orden.Vehiculo.Placa,
                p.Total,
                p.Pagos.Sum(x => (decimal?)x.Monto) ?? 0m,
                p.Estado.ToString()))
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

    public async Task<(IEnumerable<ReporteGenerado> Items, int Total)> GetBitacoraAsync(
        string? tipoReporte, int pagina, int tamanoPagina, CancellationToken ct = default)
    {
        var query = context.ReportesGenerados.Include(r => r.Usuario).AsNoTracking();

        if (!string.IsNullOrWhiteSpace(tipoReporte))
            query = query.Where(r => r.TipoReporte == tipoReporte);

        return await query.OrderByDescending(r => r.FechaGeneracion).ToPagedListAsync(pagina, tamanoPagina, ct);
    }

    public async Task<int> GuardarAsync(CancellationToken ct = default)
        => await context.SaveChangesAsync(ct);
}
