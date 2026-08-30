using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.Pagos;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Services;

/// <summary>USU037 — registro de pagos de clientes contra facturas.</summary>
public class PagoService(
    IPagoRepository pagos,
    IFacturaRepository facturas,
    IGeneradorId generadorId,
    IAuditor auditor) : IPagoService
{
    public async Task<Result<IEnumerable<PagoResponseDto>>> GetAllAsync(
        string? facturaId, string? clienteId, MetodoPago? metodoPago,
        DateTime? desde, DateTime? hasta, CancellationToken ct = default)
    {
        if (desde.HasValue && hasta.HasValue && desde > hasta)
            return Result<IEnumerable<PagoResponseDto>>.Fail(
                "La fecha inicial no puede ser posterior a la final.");

        var lista = await pagos.BuscarAsync(facturaId, clienteId, metodoPago, desde, hasta, ct);
        return Result<IEnumerable<PagoResponseDto>>.Ok(lista.Select(Mapear));
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
        PagoRequestDto dto, CancellationToken ct = default)
    {
        var factura = await facturas.FirstOrDefaultAsync(f => f.FacturaId == dto.FacturaId, ct);

        if (factura is null)
            return Result<PagoResponseDto>.Fail($"La factura {dto.FacturaId} no existe.");

        // Cobrar contra una factura anulada dejaría el dinero sin respaldo documental.
        if (factura.Estado == EstadoFactura.Anulada)
            return Result<PagoResponseDto>.Fail(
                $"La factura {dto.FacturaId} está anulada: no admite pagos.");

        var pagadoHastaAhora = await pagos.TotalPagadoAsync(dto.FacturaId, ct);
        var saldo = factura.Total - pagadoHastaAhora;

        if (saldo <= 0)
            return Result<PagoResponseDto>.Conflicto(
                $"La factura {dto.FacturaId} ya está saldada (Bs {factura.Total:N2}).");

        if (dto.Monto > saldo)
            return Result<PagoResponseDto>.Fail(
                $"El monto (Bs {dto.Monto:N2}) supera el saldo pendiente (Bs {saldo:N2}).");

        var pago = new Pago
        {
            PagoId = await generadorId.SiguienteAsync<Pago>("PAG", ct),
            FacturaId = dto.FacturaId,
            Monto = dto.Monto,
            FechaPago = DateTime.UtcNow,
            MetodoPago = dto.MetodoPago,
            Referencia = string.IsNullOrWhiteSpace(dto.Referencia) ? null : dto.Referencia.Trim()
        };

        await pagos.AddAsync(pago, ct);
        await pagos.SaveChangesAsync(ct);

        var creado = await pagos.GetByIdCompletoAsync(pago.PagoId, ct);
        var nuevoSaldo = saldo - dto.Monto;

        var mensaje = nuevoSaldo <= 0
            ? $"Pago registrado. La factura {dto.FacturaId} queda saldada."
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
        FacturaId = p.FacturaId,
        OrdenId = p.Factura?.OrdenId ?? string.Empty,
        NombreCliente = p.Factura?.Orden?.Cliente is null
            ? string.Empty
            : $"{p.Factura.Orden.Cliente.Nombre} {p.Factura.Orden.Cliente.Apellido}".Trim(),
        Monto = p.Monto,
        FechaPago = p.FechaPago,
        MetodoPago = p.MetodoPago,
        Referencia = p.Referencia,
        TotalFactura = p.Factura?.Total ?? 0m,
        TotalPagadoFactura = p.Factura?.Pagos.Sum(x => x.Monto) ?? 0m
    };
}
