using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Interfaces;

/// <summary>
/// Repositorio de comprobantes fiscales. Las lecturas traen el documento de
/// origen (orden con vehículo y cliente, o venta) para poder mostrar de qué
/// cobro salió la factura.
/// </summary>
public interface IFacturaRepository : IRepository<Factura>
{
    Task<Factura?> GetByIdCompletaAsync(string facturaId, CancellationToken ct = default);

    Task<(IEnumerable<Factura> Items, int Total)> BuscarAsync(
        string? ordenId, string? ventaId, EstadoFactura? estado, EstadoSiat? estadoSiat,
        DateTime? desde, DateTime? hasta, int pagina, int tamanoPagina, CancellationToken ct = default);
}
