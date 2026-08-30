using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Interfaces;

/// <summary>Repositorio de facturas. Las lecturas traen orden, vehículo, cliente y pagos.</summary>
public interface IFacturaRepository : IRepository<Factura>
{
    Task<Factura?> GetByIdCompletaAsync(string facturaId, CancellationToken ct = default);

    Task<IEnumerable<Factura>> BuscarAsync(
        string? ordenId, string? clienteId, EstadoFactura? estado,
        DateTime? desde, DateTime? hasta, CancellationToken ct = default);

    Task<bool> TienePagosAsync(string facturaId, CancellationToken ct = default);
}
