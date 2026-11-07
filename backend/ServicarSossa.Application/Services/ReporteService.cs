using System.Globalization;
using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.Comunes;
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
            TipoReporte.DetalleVentas => await DetalleVentasAsync(desdeUtc, hastaUtc, ct),
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

    public async Task<Result<ResultadoPaginadoDto<ReporteGeneradoResponseDto>>> GetBitacoraAsync(
        string? tipoReporte, int pagina, int tamanoPagina, CancellationToken ct = default)
    {
        var (items, total) = await reportes.GetBitacoraAsync(tipoReporte, pagina, tamanoPagina, ct);

        return Result<ResultadoPaginadoDto<ReporteGeneradoResponseDto>>.Ok(
            new ResultadoPaginadoDto<ReporteGeneradoResponseDto>
            {
                Items = items.Select(r => new ReporteGeneradoResponseDto
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
                }),
                TotalRegistros = total,
                Pagina = pagina,
                TamanoPagina = tamanoPagina
            });
    }

    // ================================================================== REPORTES

    /// <summary>USU017 — lo vendido (proformas y mostrador) y lo cobrado.</summary>
    private async Task<ReporteDto> VentasAsync(DateTime desde, DateTime hasta, CancellationToken ct)
    {
        var filas = (await reportes.VentasAsync(desde, hasta, ct)).ToList();
        var vigentes = filas.Where(f => f.Estado != nameof(EstadoProforma.Anulada)).ToList();
        var deOrdenes = vigentes.Count(f => f.Placa is not null);
        var deMostrador = vigentes.Count(f => f.Placa is null);

        var vendido = vigentes.Sum(f => f.Total);
        var cobrado = vigentes.Sum(f => f.Pagado);

        return new ReporteDto
        {
            Titulo = "Reporte de ventas",
            Columnas = ["Documento", "Fecha", "Cliente", "Placa", "Total (Bs)", "Pagado (Bs)", "Saldo (Bs)", "Estado"],
            Filas = [.. filas.Select(f => new List<string>
            {
                f.Documento,
                f.FechaEmision.ToString("dd/MM/yyyy"),
                f.Cliente,
                f.Placa ?? "Mostrador",
                Monto(f.Total),
                Monto(f.Pagado),
                // Lo anulado no se debe: sin saldo.
                f.Estado == nameof(EstadoProforma.Anulada) ? "—" : Monto(f.Total - f.Pagado),
                f.Estado
            })],
            Totales = new Dictionary<string, string>
            {
                ["Proformas de órdenes"] = deOrdenes.ToString(),
                ["Ventas de mostrador"] = deMostrador.ToString(),
                ["Anuladas"] = (filas.Count - vigentes.Count).ToString(),
                ["Total vendido"] = MontoBs(vendido),
                ["Total cobrado"] = MontoBs(cobrado),
                ["Por cobrar"] = MontoBs(vendido - cobrado)
            }
        };
    }

    /// <summary>Qué se vendió: cada servicio y repuesto, con cantidad y precio.</summary>
    private async Task<ReporteDto> DetalleVentasAsync(DateTime desde, DateTime hasta, CancellationToken ct)
    {
        var filas = (await reportes.DetalleVentasAsync(desde, hasta, ct)).ToList();
        var servicios = filas.Where(f => f.Tipo == "Servicio").ToList();
        var repuestos = filas.Where(f => f.Tipo == "Repuesto").ToList();

        var totales = new Dictionary<string, string>
        {
            ["Servicios realizados"] = servicios.Count.ToString(),
            ["Repuestos vendidos (unidades)"] = repuestos.Sum(f => f.Cantidad).ToString(),
            ["Total en servicios"] = MontoBs(servicios.Sum(f => f.Cantidad * f.PrecioUnitario)),
            ["Total en repuestos"] = MontoBs(repuestos.Sum(f => f.Cantidad * f.PrecioUnitario)),
            ["Total vendido"] = MontoBs(filas.Sum(f => f.Cantidad * f.PrecioUnitario))
        };

        var servicioTop = servicios.GroupBy(f => f.Descripcion)
            .OrderByDescending(g => g.Count()).FirstOrDefault();
        if (servicioTop is not null)
            totales["Servicio más realizado"] = $"{servicioTop.Key} ({servicioTop.Count()})";

        var repuestoTop = repuestos.GroupBy(f => f.Descripcion)
            .OrderByDescending(g => g.Sum(f => f.Cantidad)).FirstOrDefault();
        if (repuestoTop is not null)
            totales["Repuesto más vendido"] = $"{repuestoTop.Key} ({repuestoTop.Sum(f => f.Cantidad)} u.)";

        return new ReporteDto
        {
            Titulo = "Detalle de ventas",
            Columnas = ["Fecha", "Documento", "Cliente", "Tipo", "Servicio o repuesto", "Cant.", "Precio (Bs)", "Subtotal (Bs)"],
            Filas = [.. filas.Select(f => new List<string>
            {
                f.Fecha.ToString("dd/MM/yyyy"),
                f.Documento,
                f.Cliente,
                f.Tipo,
                f.Descripcion,
                f.Cantidad.ToString(),
                Monto(f.PrecioUnitario),
                Monto(f.Cantidad * f.PrecioUnitario)
            })],
            Totales = totales
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
                ["Total pendiente de pago"] = MontoBs(filas.Sum(f => f.TotalPendiente)),
                ["Total ya pagado"] = MontoBs(filas.Sum(f => f.TotalPagado)),
                ["Total general"] = MontoBs(filas.Sum(f => f.TotalPendiente + f.TotalPagado))
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
                ["Valor total del inventario (a costo)"] = MontoBs(filas.Sum(f => f.StockActual * f.PrecioCompra))
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

        totales["Total de las órdenes"] = MontoBs(filas.Sum(f => f.TotalServicios + f.TotalRepuestos));

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

    /// <summary>Para los totales, que no tienen la columna "(Bs)" encima.</summary>
    private static string MontoBs(decimal valor) => "Bs " + Monto(valor);
}
