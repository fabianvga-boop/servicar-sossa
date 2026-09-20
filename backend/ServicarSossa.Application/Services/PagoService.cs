using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.Comunes;
using ServicarSossa.Application.DTOs.Pagos;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Services;

/// <summary>USU037 — registro de pagos de clientes contra proformas.</summary>
public class PagoService(
    IPagoRepository pagos,
    IProformaRepository proformas,
    IGeneradorId generadorId,
    IAuditor auditor) : IPagoService
{
    public async Task<Result<ResultadoPaginadoDto<PagoResponseDto>>> GetAllAsync(
        string? proformaId, string? clienteId, MetodoPago? metodoPago,
        DateTime? desde, DateTime? hasta, int pagina, int tamanoPagina, CancellationToken ct = default)
    {
        if (desde.HasValue && hasta.HasValue && desde > hasta)
            return Result<ResultadoPaginadoDto<PagoResponseDto>>.Fail(
                "La fecha inicial no puede ser posterior a la final.");

        var (items, total) = await pagos.BuscarAsync(
            proformaId, clienteId, metodoPago, desde, hasta, pagina, tamanoPagina, ct);

        return Result<ResultadoPaginadoDto<PagoResponseDto>>.Ok(new ResultadoPaginadoDto<PagoResponseDto>
        {
            Items = items.Select(Mapear),
            TotalRegistros = total,
            Pagina = pagina,
            TamanoPagina = tamanoPagina
        });
    }

    public async Task<Result<PagoResponseDto>> GetByIdAsync(
        string id, CancellationToken ct = default)
    {
        var pago = await pagos.GetByIdCompletoAsync(id, ct);

        return pago is null
            ? Result<PagoResponseDto>.NoEncontrado($"No existe el pago {id}.")
            : Result<PagoResponseDto>.Ok(Mapear(pago));
    }

    public async Task<Result<PagoResponseDto>> CreateAsync(
        PagoRequestDto dto, string usuarioId, CancellationToken ct = default)
    {
        var proforma = await proformas.FirstOrDefaultAsync(f => f.ProformaId == dto.ProformaId, ct);

        if (proforma is null)
            return Result<PagoResponseDto>.Fail($"La proforma {dto.ProformaId} no existe.");

        // Cobrar contra una proforma anulada dejaría el dinero sin respaldo documental.
        if (proforma.Estado == EstadoProforma.Anulada)
            return Result<PagoResponseDto>.Fail(
                $"La proforma {dto.ProformaId} está anulada: no admite pagos.");

        var pagadoHastaAhora = await pagos.TotalPagadoAsync(dto.ProformaId, ct);
        var saldo = proforma.Total - pagadoHastaAhora;

        if (saldo <= 0)
            return Result<PagoResponseDto>.Conflicto(
                $"La proforma {dto.ProformaId} ya está saldada (Bs {proforma.Total:N2}).");

        if (dto.Monto > saldo)
            return Result<PagoResponseDto>.Fail(
                $"El monto (Bs {dto.Monto:N2}) supera el saldo pendiente (Bs {saldo:N2}).");

        var pago = new Pago
        {
            PagoId = await generadorId.SiguienteAsync<Pago>("PAG", ct),
            ProformaId = dto.ProformaId,
            Monto = dto.Monto,
            FechaPago = DateTime.UtcNow,
            MetodoPago = dto.MetodoPago,
            Referencia = string.IsNullOrWhiteSpace(dto.Referencia) ? null : dto.Referencia.Trim()
        };

        await pagos.AddAsync(pago, ct);

        await auditor.RegistrarAsync(
            usuarioId, AccionAuditoria.Crear, "Pago", pago.PagoId,
            $"Registró el pago {pago.PagoId} de Bs {pago.Monto:N2} ({pago.MetodoPago}) " +
            $"contra la proforma {dto.ProformaId}.", ct);

        await pagos.SaveChangesAsync(ct);

        var creado = await pagos.GetByIdCompletoAsync(pago.PagoId, ct);
        var nuevoSaldo = saldo - dto.Monto;

        var mensaje = nuevoSaldo <= 0
            ? $"Pago registrado. La proforma {dto.ProformaId} queda saldada."
            : $"Pago registrado. Saldo pendiente: Bs {nuevoSaldo:N2}.";

        return Result<PagoResponseDto>.Ok(Mapear(creado!), mensaje);
    }

    public async Task<Result<bool>> RevertirAsync(
        string id, string usuarioId, CancellationToken ct = default)
    {
        var pago = await pagos.FirstOrDefaultAsync(p => p.PagoId == id, ct);

        if (pago is null)
            return Result<bool>.NoEncontrado($"No existe el pago {id}.");

        pagos.Remove(pago);

        await auditor.RegistrarAsync(
            usuarioId, AccionAuditoria.Eliminar, "Pago", id,
            $"Revirtió el pago {id} de Bs {pago.Monto:N2}.", ct);

        await pagos.SaveChangesAsync(ct);

        return Result<bool>.Ok(true, $"Pago de Bs {pago.Monto:N2} revertido correctamente.");
    }

    private static PagoResponseDto Mapear(Pago p) => new()
    {
        PagoId = p.PagoId,
        ProformaId = p.ProformaId,
        OrdenId = p.Proforma?.OrdenId ?? string.Empty,
        NombreCliente = p.Proforma?.Orden?.Cliente is null
            ? string.Empty
            : $"{p.Proforma.Orden.Cliente.Nombre} {p.Proforma.Orden.Cliente.Apellido}".Trim(),
        Monto = p.Monto,
        FechaPago = p.FechaPago,
        MetodoPago = p.MetodoPago,
        Referencia = p.Referencia,
        TotalProforma = p.Proforma?.Total ?? 0m,
        TotalPagadoProforma = p.Proforma?.Pagos.Sum(x => x.Monto) ?? 0m
    };
}
