using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.Auditoria;
using ServicarSossa.Application.DTOs.Comunes;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Interfaces;

public interface IAuditoriaService
{
    Task<Result<ResultadoPaginadoDto<AuditoriaResponseDto>>> BuscarAsync(
        string? entidad, string? entidadId, string? usuarioId, AccionAuditoria? accion,
        DateTime? desde, DateTime? hasta, int pagina, int tamanoPagina, CancellationToken ct = default);
}
