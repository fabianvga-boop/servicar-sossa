using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Interfaces;

/// <summary>Repositorio de pagos. Las lecturas traen la factura y su orden.</summary>
public interface IPagoRepository : IRepository<Pago>
{
    Task<Pago?> GetByIdCompletoAsync(string pagoId, CancellationToken ct = default);

    Task<IEnumerable<Pago>> BuscarAsync(
        string? facturaId, string? clienteId, MetodoPago? metodoPago,
        DateTime? desde, DateTime? hasta, CancellationToken ct = default);

    /// <summary>Suma cobrada hasta ahora sobre una factura.</summary>
    Task<decimal> TotalPagadoAsync(string facturaId, CancellationToken ct = default);
}
