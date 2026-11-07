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
    {
        // Lo que vende el taller: las proformas de las órdenes (se cobran con
        // pagos y pueden quedar con saldo) y las ventas de mostrador (se cobran
        // completas en el acto).
        var proformas = await context.Proformas
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

        var mostrador = await context.Ventas
            .AsNoTracking()
            .Where(v => v.FechaVenta >= desde && v.FechaVenta <= hasta)
            .Select(v => new FilaVentaDto(
                v.VentaId,
                v.FechaVenta,
                v.Cliente == null
                    ? "Cliente de mostrador"
                    : v.Cliente.RazonSocial ?? (v.Cliente.Nombre + " " + v.Cliente.Apellido),
                null,
                v.Total,
                v.Estado == EstadoVenta.Anulada ? 0m : v.Total,
                v.Estado.ToString()))
            .ToListAsync(ct);

        return [.. proformas.Concat(mostrador).OrderBy(f => f.FechaEmision)];
    }

    public async Task<IEnumerable<FilaDetalleVentaDto>> DetalleVentasAsync(
        DateTime desde, DateTime hasta, CancellationToken ct = default)
    {
        // Las proformas vigentes coinciden con su orden: para corregir una orden
        // se anula antes su proforma. Por eso el detalle sale de la orden.
        var proformas = context.Proformas
            .AsNoTracking()
            .Where(p => p.Estado == EstadoProforma.Emitida
                     && p.FechaEmision >= desde && p.FechaEmision <= hasta);

        var servicios = await proformas
            .SelectMany(p => p.Orden.Servicios, (p, s) => new FilaDetalleVentaDto(
                p.FechaEmision,
                p.ProformaId,
                p.Orden.Cliente.RazonSocial ?? (p.Orden.Cliente.Nombre + " " + p.Orden.Cliente.Apellido),
                "Servicio",
                s.Servicio != null ? s.Servicio.Nombre : (s.NombreLibre ?? "Servicio"),
                1,
                s.Precio))
            .ToListAsync(ct);

        var repuestos = await proformas
            .SelectMany(p => p.Orden.Repuestos, (p, r) => new FilaDetalleVentaDto(
                p.FechaEmision,
                p.ProformaId,
                p.Orden.Cliente.RazonSocial ?? (p.Orden.Cliente.Nombre + " " + p.Orden.Cliente.Apellido),
                "Repuesto",
                r.Repuesto != null ? r.Repuesto.Nombre : (r.Descripcion ?? "Repuesto"),
                r.Cantidad,
                r.PrecioUnitario))
            .ToListAsync(ct);

        var mostrador = await context.VentaDetalles
            .AsNoTracking()
            .Where(d => d.Venta.Estado == EstadoVenta.Emitida
                     && d.Venta.FechaVenta >= desde && d.Venta.FechaVenta <= hasta)
            .Select(d => new FilaDetalleVentaDto(
                d.Venta.FechaVenta,
                d.VentaId,
                d.Venta.Cliente == null
                    ? "Cliente de mostrador"
                    : d.Venta.Cliente.RazonSocial ?? (d.Venta.Cliente.Nombre + " " + d.Venta.Cliente.Apellido),
                "Repuesto",
                d.Repuesto.Nombre,
                d.Cantidad,
                d.PrecioUnitario))
            .ToListAsync(ct);

        return [.. servicios.Concat(repuestos).Concat(mostrador)
            .OrderBy(f => f.Fecha).ThenBy(f => f.Documento).ThenByDescending(f => f.Tipo)];
    }

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
