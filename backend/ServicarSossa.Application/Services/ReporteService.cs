using System.Globalization;
using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.Reportes;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Services;

/// <summary>USU017-USU020 — generación y exportación de reportes.</summary>
public class ReporteService(
    IReporteRepository reportes,
    IUsuarioRepository usuarios,
    IExportadorReportes exportador,
    IGeneradorId generadorId) : IReporteService
{
    /// <summary>Formato boliviano para montos: Bs con separador de miles.</summary>
    private static readonly CultureInfo Cultura = CultureInfo.GetCultureInfo("es-BO");

    public async Task<Result<ReporteDto>> GenerarAsync(
        TipoReporte tipo, DateOnly desde, DateOnly hasta,
        string usuarioId, CancellationToken ct = default)
    {
        if (desde > hasta)
            return Result<ReporteDto>.Fail("La fecha inicial no puede ser posterior a la final.");

        var usuario = await usuarios.GetByIdConRolAsync(usuarioId, ct);
        var generadoPor = usuario is null
            ? usuarioId
            : $"{usuario.Nombre} {usuario.Apellido}".Trim();

        // El rango se toma completo: desde las 00:00 del día inicial hasta las
        // 23:59:59 del final, en UTC, que es como se guardan las marcas de tiempo.
        var desdeUtc = desde.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var hastaUtc = hasta.ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc);

        var reporte = tipo switch
        {
            TipoReporte.Ventas => await VentasAsync(desdeUtc, hastaUtc, ct),
            TipoReporte.Comisiones => await ComisionesAsync(desdeUtc, hastaUtc, ct),
            TipoReporte.Inventario => await InventarioAsync(ct),
            TipoReporte.Ordenes => await OrdenesAsync(desdeUtc, hastaUtc, ct),
            _ => null
        };

        if (reporte is null)
            return Result<ReporteDto>.Fail($"El tipo de reporte '{tipo}' no está soportado.");

        reporte.Tipo = tipo;
        reporte.FechaInicio = desde;
        reporte.FechaFin = hasta;
        reporte.FechaGeneracion = DateTime.UtcNow;
        reporte.GeneradoPor = generadoPor;

        return Result<ReporteDto>.Ok(reporte);
    }

    public async Task<Result<ArchivoReporteDto>> ExportarAsync(
        TipoReporte tipo, DateOnly desde, DateOnly hasta,
        FormatoReporte formato, string usuarioId, CancellationToken ct = default)
    {
        var generado = await GenerarAsync(tipo, desde, hasta, usuarioId, ct);

        if (!generado.Success)
            return Result<ArchivoReporteDto>.Fail(generado.Message!, generado.Error);

        var archivo = exportador.Exportar(generado.Data!, formato);

        // Bitácora: queda constancia de quién emitió qué y cuándo.
        await reportes.AgregarBitacoraAsync(new ReporteGenerado
        {
            ReporteId = await generadorId.SiguienteAsync<ReporteGenerado>("RPT", ct),
            TipoReporte = tipo.ToString(),
            FechaInicio = desde,
            FechaFin = hasta,
            UsuarioId = usuarioId,
            FechaGeneracion = DateTime.UtcNow,
            Formato = formato
        }, ct);

        await reportes.GuardarAsync(ct);

        return Result<ArchivoReporteDto>.Ok(archivo, "Reporte generado correctamente.");
    }

    public async Task<Result<IEnumerable<ReporteGeneradoResponseDto>>> GetBitacoraAsync(
        string? tipoReporte, CancellationToken ct = default)
    {
        var lista = await reportes.GetBitacoraAsync(tipoReporte, ct);

        return Result<IEnumerable<ReporteGeneradoResponseDto>>.Ok(lista.Select(r =>
            new ReporteGeneradoResponseDto
            {
                ReporteId = r.ReporteId,
                TipoReporte = r.TipoReporte,
                FechaInicio = r.FechaInicio,
                FechaFin = r.FechaFin,
                UsuarioId = r.UsuarioId,
                NombreUsuario = r.Usuario is null
                    ? string.Empty
                    : $"{r.Usuario.Nombre} {r.Usuario.Apellido}".Trim(),
                FechaGeneracion = r.FechaGeneracion,
                Formato = r.Formato
            }));
    }

    // ================================================================== REPORTES

    /// <summary>USU017 — ventas facturadas y cobradas.</summary>
    private async Task<ReporteDto> VentasAsync(DateTime desde, DateTime hasta, CancellationToken ct)
    {
        var filas = (await reportes.VentasAsync(desde, hasta, ct)).ToList();
        var vigentes = filas.Where(f => f.Estado != nameof(EstadoFactura.Anulada)).ToList();

        var facturado = vigentes.Sum(f => f.Total);
        var cobrado = vigentes.Sum(f => f.Pagado);

        return new ReporteDto
        {
            Titulo = "Reporte de ventas",
            Columnas = ["Factura", "Fecha", "Cliente", "Placa", "Total (Bs)", "Pagado (Bs)", "Saldo (Bs)", "Estado"],
            Filas = [.. filas.Select(f => new List<string>
            {
                f.FacturaId,
                f.FechaEmision.ToString("dd/MM/yyyy"),
                f.Cliente,
                f.Placa,
                Monto(f.Total),
                Monto(f.Pagado),
                Monto(f.Total - f.Pagado),
                f.Estado
            })],
            Totales = new Dictionary<string, string>
            {
                ["Facturas emitidas"] = vigentes.Count.ToString(),
                ["Facturas anuladas"] = (filas.Count - vigentes.Count).ToString(),
                ["Total facturado"] = Monto(facturado),
                ["Total cobrado"] = Monto(cobrado),
                ["Por cobrar"] = Monto(facturado - cobrado)
            }
        };
    }

    /// <summary>USU018 — comisiones por mecánico.</summary>
    private async Task<ReporteDto> ComisionesAsync(DateTime desde, DateTime hasta, CancellationToken ct)
    {
        var filas = (await reportes.ComisionesAsync(desde, hasta, ct))
            .OrderByDescending(f => f.TotalPendiente + f.TotalPagado)
            .ToList();

        return new ReporteDto
        {
            Titulo = "Reporte de comisiones por mecánico",
            Columnas = ["Código", "Mecánico", "Órdenes", "Pendiente (Bs)", "Pagado (Bs)", "Total (Bs)"],
            Filas = [.. filas.Select(f => new List<string>
            {
                f.MecanicoId,
                f.Mecanico,
                f.CantidadOrdenes.ToString(),
                Monto(f.TotalPendiente),
                Monto(f.TotalPagado),
                Monto(f.TotalPendiente + f.TotalPagado)
            })],
            Totales = new Dictionary<string, string>
            {
                ["Mecánicos con comisiones"] = filas.Count.ToString(),
                ["Total pendiente de pago"] = Monto(filas.Sum(f => f.TotalPendiente)),
                ["Total ya pagado"] = Monto(filas.Sum(f => f.TotalPagado)),
                ["Total general"] = Monto(filas.Sum(f => f.TotalPendiente + f.TotalPagado))
            }
        };
    }

    /// <summary>
    /// USU019 — estado del inventario. Es una foto del momento: el rango de
    /// fechas no aplica, porque el esquema no guarda histórico de movimientos.
    /// </summary>
    private async Task<ReporteDto> InventarioAsync(CancellationToken ct)
    {
        var filas = (await reportes.InventarioAsync(ct)).ToList();
        var bajos = filas.Where(f => f.StockActual <= f.StockMinimo).ToList();

        return new ReporteDto
        {
            Titulo = "Reporte de inventario (estado actual)",
            Columnas = ["Código", "Repuesto", "Proveedor", "Stock", "Mínimo", "Costo (Bs)", "Venta (Bs)", "Valor (Bs)", "Alerta"],
            Filas = [.. filas.Select(f => new List<string>
            {
                f.RepuestoId,
                f.Nombre,
                f.Proveedor ?? "—",
                f.StockActual.ToString(),
                f.StockMinimo.ToString(),
                Monto(f.PrecioCompra),
                Monto(f.PrecioVenta),
                Monto(f.StockActual * f.PrecioCompra),
                f.StockActual <= f.StockMinimo ? "REPONER" : ""
            })],
            Totales = new Dictionary<string, string>
            {
                ["Repuestos registrados"] = filas.Count.ToString(),
                ["Con stock bajo"] = bajos.Count.ToString(),
                ["Valor total del inventario (a costo)"] = Monto(filas.Sum(f => f.StockActual * f.PrecioCompra))
            }
        };
    }

    /// <summary>USU020 — órdenes de trabajo del periodo.</summary>
    private async Task<ReporteDto> OrdenesAsync(DateTime desde, DateTime hasta, CancellationToken ct)
    {
        var filas = (await reportes.OrdenesAsync(desde, hasta, ct)).ToList();

        var porEstado = filas
            .GroupBy(f => f.Estado)
            .ToDictionary(g => $"Órdenes {g.Key}", g => g.Count().ToString());

        var totales = new Dictionary<string, string>
        {
            ["Órdenes en el periodo"] = filas.Count.ToString()
        };

        foreach (var (clave, valor) in porEstado)
            totales[clave] = valor;

        totales["Total facturable"] = Monto(filas.Sum(f => f.TotalServicios + f.TotalRepuestos));

        return new ReporteDto
        {
            Titulo = "Reporte de órdenes de trabajo",
            Columnas = ["Orden", "Apertura", "Cierre", "Cliente", "Placa", "Estado", "Servicios (Bs)", "Repuestos (Bs)", "Total (Bs)"],
            Filas = [.. filas.Select(f => new List<string>
            {
                f.OrdenId,
                f.FechaCreacion.ToString("dd/MM/yyyy"),
                f.FechaCierre?.ToString("dd/MM/yyyy") ?? "—",
                f.Cliente,
                f.Placa,
                f.Estado,
                Monto(f.TotalServicios),
                Monto(f.TotalRepuestos),
                Monto(f.TotalServicios + f.TotalRepuestos)
            })],
            Totales = totales
        };
    }

    private static string Monto(decimal valor) => valor.ToString("N2", Cultura);
}
