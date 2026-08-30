using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.Comprobantes;
using ServicarSossa.Application.DTOs.Facturas;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Services;

/// <summary>USU038 — emisión y anulación de facturas (documento "Proforma" del taller).</summary>
public class FacturaService(
    IFacturaRepository facturas,
    IOrdenRepository ordenes,
    IGeneradorComprobantes generadorComprobantes,
    IGeneradorId generadorId,
    IAuditor auditor) : IFacturaService
{
    public async Task<Result<IEnumerable<FacturaResponseDto>>> GetAllAsync(
        string? ordenId, string? clienteId, EstadoFactura? estado,
        DateTime? desde, DateTime? hasta, CancellationToken ct = default)
    {
        if (desde.HasValue && hasta.HasValue && desde > hasta)
            return Result<IEnumerable<FacturaResponseDto>>.Fail(
                "La fecha inicial no puede ser posterior a la final.");

        var lista = await facturas.BuscarAsync(ordenId, clienteId, estado, desde, hasta, ct);
        return Result<IEnumerable<FacturaResponseDto>>.Ok(lista.Select(Mapear));
    }

    public async Task<Result<FacturaResponseDto>> GetByIdAsync(
        string id, CancellationToken ct = default)
    {
        var factura = await facturas.GetByIdCompletaAsync(id, ct);

        return factura is null
            ? Result<FacturaResponseDto>.NoEncontrado($"No existe la factura {id}.")
            : Result<FacturaResponseDto>.Ok(Mapear(factura));
    }

    public async Task<Result<FacturaResponseDto>> CreateAsync(
        FacturaRequestDto dto, CancellationToken ct = default)
    {
        var orden = await ordenes.GetDetalleAsync(dto.OrdenId, ct);

        if (orden is null)
            return Result<FacturaResponseDto>.Fail($"La orden {dto.OrdenId} no existe.");

        // Solo se factura trabajo terminado.
        if (orden.Estado is not (EstadoOrden.Finalizada or EstadoOrden.Cerrada))
            return Result<FacturaResponseDto>.Fail(
                $"La orden está {orden.Estado}. Solo se puede facturar una orden " +
                "Finalizada o Cerrada.");

        // Una sola factura vigente por orden evita la doble facturación.
        var vigente = await facturas.FirstOrDefaultAsync(
            f => f.OrdenId == dto.OrdenId && f.Estado == EstadoFactura.Emitida, ct);

        if (vigente is not null)
            return Result<FacturaResponseDto>.Conflicto(
                $"La orden {dto.OrdenId} ya tiene la factura {vigente.FacturaId} emitida. " +
                "Anúlela antes de emitir otra.");

        var total = orden.Servicios.Sum(s => s.Precio)
                  + orden.Repuestos.Sum(r => r.Cantidad * r.PrecioUnitario);

        if (total <= 0)
            return Result<FacturaResponseDto>.Fail(
                "El total a facturar es cero: la orden no tiene servicios ni repuestos.");

        var factura = new Factura
        {
            FacturaId = await generadorId.SiguienteAsync<Factura>("FAC", ct),
            OrdenId = dto.OrdenId,
            FechaEmision = DateTime.UtcNow,
            NitRazonSocial = string.IsNullOrWhiteSpace(dto.NitRazonSocial)
                ? null
                : dto.NitRazonSocial.Trim(),
            Total = total,
            Estado = EstadoFactura.Emitida
        };

        await facturas.AddAsync(factura, ct);
        await facturas.SaveChangesAsync(ct);

        var creada = await facturas.GetByIdCompletaAsync(factura.FacturaId, ct);
        return Result<FacturaResponseDto>.Ok(Mapear(creada!), "Factura emitida correctamente.");
    }

    public async Task<Result<FacturaResponseDto>> AnularAsync(
        string id, string usuarioId, CancellationToken ct = default)
    {
        var factura = await facturas.FirstOrDefaultAsync(f => f.FacturaId == id, ct);

        if (factura is null)
            return Result<FacturaResponseDto>.NoEncontrado($"No existe la factura {id}.");

        if (factura.Estado == EstadoFactura.Anulada)
            return Result<FacturaResponseDto>.Fail($"La factura {id} ya está anulada.");

        // Anular con dinero cobrado dejaría los pagos sin respaldo documental.
        if (await facturas.TienePagosAsync(id, ct))
            return Result<FacturaResponseDto>.Conflicto(
                "No se puede anular la factura: tiene pagos registrados. " +
                "Revierta primero los pagos.");

        factura.Estado = EstadoFactura.Anulada;

        await auditor.RegistrarAsync(
            usuarioId, AccionAuditoria.Anular, "Factura", id,
            $"Anuló la factura {id}.", ct);

        await facturas.SaveChangesAsync(ct);

        var anulada = await facturas.GetByIdCompletaAsync(id, ct);
        return Result<FacturaResponseDto>.Ok(Mapear(anulada!), "Factura anulada correctamente.");
    }

    /// <summary>
    /// Arma el comprobante en el momento leyendo la orden: no se guarda el PDF.
    /// Es seguro porque una orden Finalizada o Cerrada ya no admite cambios en
    /// sus servicios ni repuestos, así que el detalle impreso siempre coincide
    /// con el total que quedó registrado en la factura.
    /// </summary>
    public async Task<Result<ArchivoComprobanteDto>> GetPdfAsync(
        string id, CancellationToken ct = default)
    {
        var factura = await facturas.GetByIdCompletaAsync(id, ct);

        if (factura is null)
            return Result<ArchivoComprobanteDto>.NoEncontrado($"No existe la factura {id}.");

        var orden = await ordenes.GetDetalleAsync(factura.OrdenId, ct);

        if (orden is null)
            return Result<ArchivoComprobanteDto>.Fail(
                $"La orden {factura.OrdenId} de la factura ya no existe.");

        var comprobante = ArmadorComprobantes.DesdeOrden(orden);

        comprobante.Numero = factura.FacturaId;
        comprobante.FechaEmision = factura.FechaEmision;
        comprobante.Estado = factura.Estado.ToString();
        comprobante.NitRazonSocial = factura.NitRazonSocial;
        comprobante.Total = factura.Total;

        var pagado = factura.Pagos.Sum(p => p.Monto);
        comprobante.TotalPagado = pagado;
        comprobante.SaldoPendiente = factura.Total - pagado;

        return Result<ArchivoComprobanteDto>.Ok(generadorComprobantes.Generar(comprobante));
    }

    private static FacturaResponseDto Mapear(Factura f) => new()
    {
        FacturaId = f.FacturaId,
        OrdenId = f.OrdenId,
        PlacaVehiculo = f.Orden?.Vehiculo?.Placa ?? string.Empty,
        ClienteId = f.Orden?.ClienteId ?? string.Empty,
        NombreCliente = f.Orden?.Cliente is null
            ? string.Empty
            : $"{f.Orden.Cliente.Nombre} {f.Orden.Cliente.Apellido}".Trim(),
        FechaEmision = f.FechaEmision,
        NitRazonSocial = f.NitRazonSocial,
        Total = f.Total,
        Estado = f.Estado,
        TotalPagado = f.Pagos.Sum(p => p.Monto)
    };
}
