using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.Auditoria;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Interfaces;

public interface IAuditoriaService
{
    Task<Result<IEnumerable<AuditoriaResponseDto>>> BuscarAsync(
        string? entidad, string? entidadId, string? usuarioId, AccionAuditoria? accion,
        DateTime? desde, DateTime? hasta, CancellationToken ct = default);
}
