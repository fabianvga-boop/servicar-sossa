using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Interfaces;

public interface IAuditoriaRepository : IRepository<Auditoria>
{
    /// <summary>
    /// Sin paginar (tope de 500 registros): la usa el historial de ajustes de
    /// un repuesto puntual, ya acotado por <c>entidadId</c>.
    /// </summary>
    Task<IEnumerable<Auditoria>> BuscarAsync(
        string? entidad, string? entidadId, string? usuarioId, AccionAuditoria? accion,
        DateTime? desde, DateTime? hasta, CancellationToken ct = default);

    /// <summary>Misma búsqueda que <see cref="BuscarAsync"/>, para la bitácora de auditoría.</summary>
    Task<(IEnumerable<Auditoria> Items, int Total)> BuscarPaginadoAsync(
        string? entidad, string? entidadId, string? usuarioId, AccionAuditoria? accion,
        DateTime? desde, DateTime? hasta, int pagina, int tamanoPagina, CancellationToken ct = default);
}
