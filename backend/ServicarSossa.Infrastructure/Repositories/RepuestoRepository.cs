using Microsoft.EntityFrameworkCore;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;
using ServicarSossa.Infrastructure.Data;
using ServicarSossa.Infrastructure.Extensions;

namespace ServicarSossa.Infrastructure.Repositories;

/// <inheritdoc cref="IRepuestoRepository"/>
public class RepuestoRepository(AppDbContext context)
    : Repository<Repuesto>(context), IRepuestoRepository
{
    public async Task<Repuesto?> GetByIdConProveedorAsync(
        string repuestoId, CancellationToken ct = default)
        => await Set.Include(r => r.Proveedor)
                    .Include(r => r.Categoria)
                    .Include(r => r.Compatibilidades)
                    .AsNoTracking()
                    .FirstOrDefaultAsync(r => r.RepuestoId == repuestoId, ct);

    public async Task<Repuesto?> GetParaEditarAsync(string repuestoId, CancellationToken ct = default)
        => await Set.Include(r => r.Compatibilidades)
                    .FirstOrDefaultAsync(r => r.RepuestoId == repuestoId, ct);

    public async Task<(IEnumerable<Repuesto> Items, int Total)> BuscarAsync(
        string? buscar, string? proveedorId, bool soloStockBajo,
        int pagina, int tamanoPagina, CancellationToken ct = default,
        Vehiculo? vehiculo = null, string? categoriaId = null)
    {
        var query = Set.Include(r => r.Proveedor)
                       .Include(r => r.Categoria)
                       .Include(r => r.Compatibilidades)
                       .AsNoTracking();

        if (categoriaId == IRepuestoRepository.SinCategoria)
            query = query.Where(r => r.CategoriaId == null);
        else if (!string.IsNullOrWhiteSpace(categoriaId))
            query = query.Where(r => r.CategoriaId == categoriaId);

        if (!string.IsNullOrWhiteSpace(proveedorId))
            query = query.Where(r => r.ProveedorId == proveedorId);

        if (soloStockBajo)
            query = query.Where(r => r.StockActual <= r.StockMinimo);   // USU030

        if (vehiculo is not null)
            query = FiltrarPorVehiculo(query, vehiculo);

        // Además del nombre, cada palabra se busca en los vehículos compatibles:
        // "Toyota Corolla 2017" encuentra las pastillas indicadas para ese auto
        // aunque el nombre del repuesto no lo diga.
        query = query.BuscarPorPalabras(buscar,
            (r, p) => r.Compatibilidades.Any(c =>
                EF.Functions.ILike(c.Marca, p.Patron, BusquedaPorPalabras.CaracterEscape) ||
                EF.Functions.ILike(c.Modelo ?? "", p.Patron, BusquedaPorPalabras.CaracterEscape) ||
                (p.Anio != null &&
                    (c.AnioDesde == null || c.AnioDesde <= p.Anio) &&
                    (c.AnioHasta == null || c.AnioHasta >= p.Anio))),
            r => r.RepuestoId, r => r.Nombre, r => r.Descripcion);

        return await query.OrderBy(r => r.Nombre).ToPagedListAsync(pagina, tamanoPagina, ct);
    }

    public async Task<List<MovimientoInventario>> GetMovimientosAsync(
        string repuestoId, CancellationToken ct = default)
        => await Context.MovimientosInventario
            .Include(m => m.Usuario)
            .AsNoTracking()
            .Where(m => m.RepuestoId == repuestoId)
            .OrderBy(m => m.Fecha).ThenBy(m => m.MovimientoId)
            .ToListAsync(ct);

    public async Task<bool> TieneMovimientosAsync(
        string repuestoId, CancellationToken ct = default)
        => await Context.CompraDetalles.AnyAsync(d => d.RepuestoId == repuestoId, ct)
        || await Context.OrdenRepuestos.AnyAsync(o => o.RepuestoId == repuestoId, ct)
        || await Context.VentaDetalles.AnyAsync(v => v.RepuestoId == repuestoId, ct);

    public async Task<int> UltimoNumeroCompatibilidadAsync(CancellationToken ct = default)
    {
        var codigos = await Context.RepuestoCompatibilidades
            .Select(c => c.CompatibilidadId)
            .ToListAsync(ct);

        return codigos
            .Select(c => int.TryParse(c.AsSpan(4), out var n) ? n : 0)
            .DefaultIfEmpty(0)
            .Max();
    }

    /// <summary>
    /// Universales, más los específicos con alguna fila que admita al vehículo.
    /// Misma regla que <see cref="RepuestoCompatibilidad.Admite"/>, escrita para
    /// que PostgreSQL la resuelva (sin distinguir mayúsculas ni espacios).
    /// </summary>
    private static IQueryable<Repuesto> FiltrarPorVehiculo(IQueryable<Repuesto> query, Vehiculo vehiculo)
    {
        var marca = vehiculo.Marca.Trim().ToLower();
        var modelo = vehiculo.Modelo.Trim().ToLower();
        var anio = vehiculo.Anio;

        return query.Where(r =>
            r.TipoAplicacion == TipoAplicacionRepuesto.Universal ||
            r.Compatibilidades.Any(c =>
                c.Marca.Trim().ToLower() == marca &&
                (c.Modelo == null || c.Modelo.Trim() == "" || c.Modelo.Trim().ToLower() == modelo) &&
                (anio == null ||
                    ((c.AnioDesde == null || c.AnioDesde <= anio) &&
                     (c.AnioHasta == null || c.AnioHasta >= anio)))));
    }
}
