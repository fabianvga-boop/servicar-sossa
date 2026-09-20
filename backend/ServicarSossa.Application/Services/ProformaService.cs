using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.Comprobantes;
using ServicarSossa.Application.DTOs.Comunes;
using ServicarSossa.Application.DTOs.Proformas;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Services;

/// <summary>
/// USU038 — proformas: el documento de cobro del taller.
///
/// No emite nada ante el SIN y no necesita saber de facturación electrónica:
/// eso vive en <see cref="FacturaService"/>. Acá solo se arma el documento que
/// el cliente recibe y contra el que paga.
/// </summary>
public class ProformaService(
    IProformaRepository proformas,
    IOrdenRepository ordenes,
    IGeneradorComprobantes generadorComprobantes,
    IGeneradorId generadorId,
    IAuditor auditor) : IProformaService
{
    public async Task<Result<ResultadoPaginadoDto<ProformaResponseDto>>> GetAllAsync(
        string? ordenId, string? clienteId, EstadoProforma? estado,
        DateTime? desde, DateTime? hasta, int pagina, int tamanoPagina, CancellationToken ct = default)
    {
        if (desde.HasValue && hasta.HasValue && desde > hasta)
            return Result<ResultadoPaginadoDto<ProformaResponseDto>>.Fail(
                "La fecha inicial no puede ser posterior a la final.");

        var (items, total) = await proformas.BuscarAsync(
            ordenId, clienteId, estado, desde, hasta, pagina, tamanoPagina, ct);

        return Result<ResultadoPaginadoDto<ProformaResponseDto>>.Ok(new ResultadoPaginadoDto<ProformaResponseDto>
        {
            Items = items.Select(Mapear),
            TotalRegistros = total,
            Pagina = pagina,
            TamanoPagina = tamanoPagina
        });
    }

    public async Task<Result<ProformaResponseDto>> GetByIdAsync(
        string id, CancellationToken ct = default)
    {
        var proforma = await proformas.GetByIdCompletaAsync(id, ct);

        return proforma is null
            ? Result<ProformaResponseDto>.NoEncontrado($"No existe la proforma {id}.")
            : Result<ProformaResponseDto>.Ok(Mapear(proforma));
    }

    public async Task<Result<ProformaResponseDto>> CreateAsync(
        ProformaRequestDto dto, string usuarioId, CancellationToken ct = default)
    {
        var orden = await ordenes.GetDetalleAsync(dto.OrdenId, ct);

        if (orden is null)
            return Result<ProformaResponseDto>.Fail($"La orden {dto.OrdenId} no existe.");

        // Solo se cobra trabajo terminado.
        if (orden.Estado is not (EstadoOrden.Finalizada or EstadoOrden.Cerrada))
            return Result<ProformaResponseDto>.Fail(
                $"La orden está {orden.Estado}. Solo se puede cobrar una orden " +
                "Finalizada o Cerrada.");

        // Una sola proforma vigente por orden evita el doble cobro.
        var vigente = await proformas.FirstOrDefaultAsync(
            p => p.OrdenId == dto.OrdenId && p.Estado == EstadoProforma.Emitida, ct);

        if (vigente is not null)
            return Result<ProformaResponseDto>.Conflicto(
                $"La orden {dto.OrdenId} ya tiene la proforma {vigente.ProformaId} emitida. " +
                "Anúlela antes de emitir otra.");

        var total = orden.Servicios.Sum(s => s.Precio)
                  + orden.Repuestos.Sum(r => r.Cantidad * r.PrecioUnitario);

        if (total <= 0)
            return Result<ProformaResponseDto>.Fail(
                "El total a cobrar es cero: la orden no tiene servicios ni repuestos.");

        var proforma = new Proforma
        {
            ProformaId = await generadorId.SiguienteAsync<Proforma>("PRF", ct),
            OrdenId = dto.OrdenId,
            FechaEmision = DateTime.UtcNow,
            NitRazonSocial = string.IsNullOrWhiteSpace(dto.NitRazonSocial)
                ? null
                : dto.NitRazonSocial.Trim(),
            Total = total,
            Estado = EstadoProforma.Emitida
        };

        await proformas.AddAsync(proforma, ct);

        await auditor.RegistrarAsync(
            usuarioId, AccionAuditoria.Crear, "Proforma", proforma.ProformaId,
            $"Emitió la proforma {proforma.ProformaId} de la orden {dto.OrdenId} por Bs {proforma.Total:N2}.", ct);

        await proformas.SaveChangesAsync(ct);

        var creada = await proformas.GetByIdCompletaAsync(proforma.ProformaId, ct);
        return Result<ProformaResponseDto>.Ok(Mapear(creada!), "Proforma emitida correctamente.");
    }

    public async Task<Result<ProformaResponseDto>> AnularAsync(
        string id, string usuarioId, CancellationToken ct = default)
    {
        var proforma = await proformas.FirstOrDefaultAsync(p => p.ProformaId == id, ct);

        if (proforma is null)
            return Result<ProformaResponseDto>.NoEncontrado($"No existe la proforma {id}.");

        if (proforma.Estado == EstadoProforma.Anulada)
            return Result<ProformaResponseDto>.Fail($"La proforma {id} ya está anulada.");

        // Anular con dinero cobrado dejaría los pagos sin respaldo documental.
        if (await proformas.TienePagosAsync(id, ct))
            return Result<ProformaResponseDto>.Conflicto(
                "No se puede anular la proforma: tiene pagos registrados. " +
                "Revierta primero los pagos.");

        proforma.Estado = EstadoProforma.Anulada;

        await auditor.RegistrarAsync(
            usuarioId, AccionAuditoria.Anular, "Proforma", id,
            $"Anuló la proforma {id}.", ct);

        await proformas.SaveChangesAsync(ct);

        var anulada = await proformas.GetByIdCompletaAsync(id, ct);
        return Result<ProformaResponseDto>.Ok(Mapear(anulada!), "Proforma anulada correctamente.");
    }

    /// <summary>
    /// Arma el comprobante en el momento leyendo la orden: no se guarda el PDF.
    /// Es seguro porque una orden Finalizada o Cerrada ya no admite cambios en
    /// sus servicios ni repuestos, así que el detalle impreso siempre coincide
    /// con el total que quedó registrado en la proforma.
    /// </summary>
    public async Task<Result<ArchivoComprobanteDto>> GetPdfAsync(
        string id, CancellationToken ct = default)
    {
        var proforma = await proformas.GetByIdCompletaAsync(id, ct);

        if (proforma is null)
            return Result<ArchivoComprobanteDto>.NoEncontrado($"No existe la proforma {id}.");

        var orden = await ordenes.GetDetalleAsync(proforma.OrdenId, ct);

        if (orden is null)
            return Result<ArchivoComprobanteDto>.Fail(
                $"La orden {proforma.OrdenId} de la proforma ya no existe.");

        var comprobante = ArmadorComprobantes.DesdeOrden(orden);

        comprobante.Numero = proforma.ProformaId;
        comprobante.FechaEmision = proforma.FechaEmision;
        comprobante.Estado = proforma.Estado.ToString();
        comprobante.NitRazonSocial = proforma.NitRazonSocial;
        comprobante.Total = proforma.Total;

        var pagado = proforma.Pagos.Sum(p => p.Monto);
        comprobante.TotalPagado = pagado;
        comprobante.SaldoPendiente = proforma.Total - pagado;

        return Result<ArchivoComprobanteDto>.Ok(generadorComprobantes.Generar(comprobante));
    }

    private static ProformaResponseDto Mapear(Proforma p) => new()
    {
        ProformaId = p.ProformaId,
        OrdenId = p.OrdenId,
        PlacaVehiculo = p.Orden?.Vehiculo?.Placa ?? string.Empty,
        ClienteId = p.Orden?.ClienteId ?? string.Empty,
        NombreCliente = p.Orden?.Cliente is null
            ? string.Empty
            : $"{p.Orden.Cliente.Nombre} {p.Orden.Cliente.Apellido}".Trim(),
        FechaEmision = p.FechaEmision,
        NitRazonSocial = p.NitRazonSocial,
        Total = p.Total,
        Estado = p.Estado,
        TotalPagado = p.Pagos.Sum(x => x.Monto)
    };
}
