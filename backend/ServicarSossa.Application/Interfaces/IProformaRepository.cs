using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Interfaces;

/// <summary>Repositorio de proformas. Las lecturas traen orden, vehículo, cliente y pagos.</summary>
public interface IProformaRepository : IRepository<Proforma>
{
    Task<Proforma?> GetByIdCompletaAsync(string proformaId, CancellationToken ct = default);

    Task<(IEnumerable<Proforma> Items, int Total)> BuscarAsync(
        string? ordenId, string? clienteId, EstadoProforma? estado,
        DateTime? desde, DateTime? hasta, int pagina, int tamanoPagina, CancellationToken ct = default);

    Task<bool> TienePagosAsync(string proformaId, CancellationToken ct = default);
}
