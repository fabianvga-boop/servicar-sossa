using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Interfaces;

/// <summary>Repositorio de pagos. Las lecturas traen la proforma y su orden.</summary>
public interface IPagoRepository : IRepository<Pago>
{
    Task<Pago?> GetByIdCompletoAsync(string pagoId, CancellationToken ct = default);

    Task<(IEnumerable<Pago> Items, int Total)> BuscarAsync(
        string? proformaId, string? clienteId, MetodoPago? metodoPago,
        DateTime? desde, DateTime? hasta, int pagina, int tamanoPagina, CancellationToken ct = default);

    /// <summary>Suma cobrada hasta ahora sobre una proforma.</summary>
    Task<decimal> TotalPagadoAsync(string proformaId, CancellationToken ct = default);
}
