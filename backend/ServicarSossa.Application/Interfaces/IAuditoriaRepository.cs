using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Interfaces;

public interface IAuditoriaRepository : IRepository<Auditoria>
{
    Task<IEnumerable<Auditoria>> BuscarAsync(
        string? entidad, string? entidadId, string? usuarioId, AccionAuditoria? accion,
        DateTime? desde, DateTime? hasta, CancellationToken ct = default);
}
