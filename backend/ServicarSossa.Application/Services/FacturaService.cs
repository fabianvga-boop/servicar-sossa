using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.Comunes;
using ServicarSossa.Application.DTOs.Facturas;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Services;

/// <summary>
/// Facturación electrónica: el comprobante FISCAL ante el SIN.
///
/// No duplica al cobro: el dinero se registra contra la proforma. Acá solo se
/// produce y se archiva el documento que exige Impuestos, con su CUF y su XML.
///
/// Todo lo específico del protocolo SIAT vive detrás de
/// <see cref="IEmisorComprobante"/>; este servicio solo decide qué se factura,
/// valida que se pueda, y persiste lo que el emisor devuelve.
/// </summary>
public class FacturaService(
    IFacturaRepository facturas,
    IOrdenRepository ordenes,
    IVentaRepository ventas,
    IEmisorComprobante emisor,
    IGeneradorId generadorId,
    IAuditor auditor) : IFacturaService
{
    public async Task<Result<ResultadoPaginadoDto<FacturaResponseDto>>> GetAllAsync(
        string? ordenId, string? ventaId, EstadoFactura? estado, EstadoSiat? estadoSiat,
        DateTime? desde, DateTime? hasta, int pagina, int tamanoPagina, CancellationToken ct = default)
    {
        if (desde.HasValue && hasta.HasValue && desde > hasta)
            return Result<ResultadoPaginadoDto<FacturaResponseDto>>.Fail(
                "La fecha inicial no puede ser posterior a la final.");

        var (items, total) = await facturas.BuscarAsync(
            ordenId, ventaId, estado, estadoSiat, desde, hasta, pagina, tamanoPagina, ct);

        return Result<ResultadoPaginadoDto<FacturaResponseDto>>.Ok(new ResultadoPaginadoDto<FacturaResponseDto>
        {
            Items = items.Select(Mapear),
            TotalRegistros = total,
            Pagina = pagina,
            TamanoPagina = tamanoPagina
        });
    }

    public async Task<Result<FacturaResponseDto>> GetByIdAsync(
        string id, CancellationToken ct = default)
    {
        var factura = await facturas.GetByIdCompletaAsync(id, ct);

        return factura is null
            ? Result<FacturaResponseDto>.NoEncontrado($"No existe la factura {id}.")
            : Result<FacturaResponseDto>.Ok(Mapear(factura));
    }

    public Result<EstadoFacturacionDto> GetEstadoFacturacion()
        => Result<EstadoFacturacionDto>.Ok(new EstadoFacturacionDto
        {
            Modo = emisor.Modo,
            EmisionHabilitada = emisor.Modo == ModoFacturacion.SiatEnLinea,
            Motivo = emisor.Modo == ModoFacturacion.SiatEnLinea
                ? null
                : "El taller no tiene facturación electrónica habilitada. " +
                  "El cobro se documenta con proformas."
        });

    public async Task<Result<FacturaResponseDto>> EmitirAsync(
        FacturaRequestDto dto, string usuarioId, CancellationToken ct = default)
    {
        var solicitud = await ArmarSolicitudAsync(dto, ct);

        if (!solicitud.Success || solicitud.Data is null)
            return Result<FacturaResponseDto>.Fail(solicitud.Message!, solicitud.Error);

        // Una sola factura vigente por documento: evita facturar dos veces lo mismo.
        var yaFacturado = await facturas.FirstOrDefaultAsync(
            f => f.Estado == EstadoFactura.Emitida
                 && ((dto.OrdenId != null && f.OrdenId == dto.OrdenId)
                     || (dto.VentaId != null && f.VentaId == dto.VentaId)), ct);

        if (yaFacturado is not null)
            return Result<FacturaResponseDto>.Conflicto(
                $"Ese documento ya tiene la factura {yaFacturado.FacturaId} emitida. " +
                "Anúlela antes de emitir otra.");

        var emision = await emisor.EmitirAsync(solicitud.Data, ct);

        // En modo interno el emisor rechaza: no hay NIT habilitado y la factura
        // fiscal no puede existir. El mensaje ya explica qué usar en su lugar.
        if (!emision.Success || emision.Data is null)
            return Result<FacturaResponseDto>.Fail(emision.Message!, emision.Error);

        var resultado = emision.Data;

        var factura = new Factura
        {
            FacturaId = await generadorId.SiguienteAsync<Factura>("FAC", ct),
            OrdenId = dto.OrdenId,
            VentaId = dto.VentaId,
            FechaEmision = DateTime.UtcNow,
            NitRazonSocial = string.IsNullOrWhiteSpace(dto.NitRazonSocial)
                ? null
                : dto.NitRazonSocial.Trim(),
            Total = solicitud.Data.Total,
            MetodoPagoId = solicitud.Data.CodigoMetodoPagoSin,
            Estado = EstadoFactura.Emitida,

            NumeroFactura = resultado.NumeroFactura,
            Cuf = resultado.Cuf,
            Cufd = resultado.Cufd,
            CodigoRecepcion = resultado.CodigoRecepcion,
            EstadoSiat = resultado.EstadoSiat,
            XmlGenerado = resultado.XmlGenerado,
            XmlFirmado = resultado.XmlFirmado,
            FechaEmisionSiat = resultado.FechaEmisionSiat,
            MensajeServicio = resultado.Mensaje
        };

        await facturas.AddAsync(factura, ct);

        await auditor.RegistrarAsync(
            usuarioId, AccionAuditoria.Crear, "Factura", factura.FacturaId,
            $"Emitió la factura {factura.FacturaId} por Bs {factura.Total:N2} " +
            $"({factura.EstadoSiat}).", ct);

        await facturas.SaveChangesAsync(ct);

        var creada = await facturas.GetByIdCompletaAsync(factura.FacturaId, ct);
        return Result<FacturaResponseDto>.Ok(Mapear(creada!), resultado.Mensaje ?? "Factura emitida.");
    }

    public async Task<Result<FacturaResponseDto>> AnularAsync(
        string id, string? motivo, string usuarioId, CancellationToken ct = default)
    {
        var factura = await facturas.FirstOrDefaultAsync(f => f.FacturaId == id, ct);

        if (factura is null)
            return Result<FacturaResponseDto>.NoEncontrado($"No existe la factura {id}.");

        if (factura.Estado == EstadoFactura.Anulada)
            return Result<FacturaResponseDto>.Fail($"La factura {id} ya está anulada.");

        var anulacion = await emisor.AnularAsync(new DTOs.Facturacion.SolicitudAnulacionDto
        {
            Origen = factura.OrdenId is not null
                ? OrigenComprobante.OrdenTrabajo
                : OrigenComprobante.Mostrador,
            DocumentoId = factura.OrdenId ?? factura.VentaId ?? id,
            Motivo = motivo
        }, ct);

        if (!anulacion.Success)
            return Result<FacturaResponseDto>.Fail(anulacion.Message!, anulacion.Error);

        factura.Estado = EstadoFactura.Anulada;
        factura.EstadoSiat = EstadoSiat.Anulada;
        factura.MensajeServicio = anulacion.Data?.Mensaje ?? motivo;

        await auditor.RegistrarAsync(
            usuarioId, AccionAuditoria.Anular, "Factura", id,
            $"Anuló la factura {id}." + (motivo is null ? "" : $" Motivo: {motivo}"), ct);

        await facturas.SaveChangesAsync(ct);

        var anulada = await facturas.GetByIdCompletaAsync(id, ct);
        return Result<FacturaResponseDto>.Ok(Mapear(anulada!), "Factura anulada.");
    }

    public async Task<Result<string>> GetXmlAsync(
        string id, bool firmado, CancellationToken ct = default)
    {
        var factura = await facturas.FirstOrDefaultAsync(f => f.FacturaId == id, ct);

        if (factura is null)
            return Result<string>.NoEncontrado($"No existe la factura {id}.");

        var xml = firmado ? factura.XmlFirmado : factura.XmlGenerado;

        return string.IsNullOrWhiteSpace(xml)
            ? Result<string>.NoEncontrado(
                $"La factura {id} no tiene XML {(firmado ? "firmado" : "generado")}.")
            : Result<string>.Ok(xml);
    }

    /// <summary>
    /// Traduce "facturar la orden X" o "facturar la venta Y" a la solicitud
    /// neutra que entiende el emisor, validando que el documento exista y esté
    /// en condiciones de facturarse.
    /// </summary>
    private async Task<Result<DTOs.Facturacion.SolicitudEmisionDto>> ArmarSolicitudAsync(
        FacturaRequestDto dto, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(dto.OrdenId))
        {
            var orden = await ordenes.GetDetalleAsync(dto.OrdenId, ct);

            if (orden is null)
                return Result<DTOs.Facturacion.SolicitudEmisionDto>.NoEncontrado(
                    $"La orden {dto.OrdenId} no existe.");

            if (orden.Estado is not (EstadoOrden.Finalizada or EstadoOrden.Cerrada))
                return Result<DTOs.Facturacion.SolicitudEmisionDto>.Fail(
                    $"La orden está {orden.Estado}. Solo se factura una orden Finalizada o Cerrada.");

            return Result<DTOs.Facturacion.SolicitudEmisionDto>.Ok(
                ArmadorComprobantes.SolicitudDesdeOrden(orden, dto.NitRazonSocial));
        }

        var venta = await ventas.GetByIdCompletaAsync(dto.VentaId!, ct);

        if (venta is null)
            return Result<DTOs.Facturacion.SolicitudEmisionDto>.NoEncontrado(
                $"La venta {dto.VentaId} no existe.");

        if (venta.Estado == EstadoVenta.Anulada)
            return Result<DTOs.Facturacion.SolicitudEmisionDto>.Fail(
                $"La venta {dto.VentaId} está anulada: no se puede facturar.");

        return Result<DTOs.Facturacion.SolicitudEmisionDto>.Ok(
            ArmadorComprobantes.SolicitudDesdeVenta(venta));
    }

    private static FacturaResponseDto Mapear(Factura f) => new()
    {
        FacturaId = f.FacturaId,
        OrdenId = f.OrdenId,
        VentaId = f.VentaId,
        PlacaVehiculo = f.Orden?.Vehiculo?.Placa ?? string.Empty,
        NombreCliente = f.Orden?.Cliente is not null
            ? $"{f.Orden.Cliente.Nombre} {f.Orden.Cliente.Apellido}".Trim()
            : (f.Venta?.Cliente is not null
                ? $"{f.Venta.Cliente.Nombre} {f.Venta.Cliente.Apellido}".Trim()
                : "Cliente de mostrador"),
        FechaEmision = f.FechaEmision,
        NitRazonSocial = f.NitRazonSocial,
        Total = f.Total,
        Estado = f.Estado,
        NumeroFactura = f.NumeroFactura,
        Cuf = f.Cuf,
        CodigoRecepcion = f.CodigoRecepcion,
        EstadoSiat = f.EstadoSiat,
        FechaEmisionSiat = f.FechaEmisionSiat,
        MensajeServicio = f.MensajeServicio,
        TieneXml = !string.IsNullOrWhiteSpace(f.XmlGenerado)
    };
}
