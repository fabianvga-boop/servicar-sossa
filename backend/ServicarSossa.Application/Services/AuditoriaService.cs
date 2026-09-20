using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.Auditoria;
using ServicarSossa.Application.DTOs.Comunes;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Services;

/// <summary>Consulta de la bitácora de auditoría (solo lectura).</summary>
public class AuditoriaService(IAuditoriaRepository auditorias) : IAuditoriaService
{
    public async Task<Result<ResultadoPaginadoDto<AuditoriaResponseDto>>> BuscarAsync(
        string? entidad, string? entidadId, string? usuarioId, AccionAuditoria? accion,
        DateTime? desde, DateTime? hasta, int pagina, int tamanoPagina, CancellationToken ct = default)
    {
        var (items, total) = await auditorias.BuscarPaginadoAsync(
            entidad, entidadId, usuarioId, accion, desde, hasta, pagina, tamanoPagina, ct);

        return Result<ResultadoPaginadoDto<AuditoriaResponseDto>>.Ok(
            new ResultadoPaginadoDto<AuditoriaResponseDto>
            {
                Items = items.Select(Mapear),
                TotalRegistros = total,
                Pagina = pagina,
                TamanoPagina = tamanoPagina
            });
    }

    private static AuditoriaResponseDto Mapear(Auditoria a) => new()
    {
        AuditoriaId = a.AuditoriaId,
        UsuarioId = a.UsuarioId,
        NombreUsuario = $"{a.Usuario.Nombre} {a.Usuario.Apellido}".Trim(),
        Accion = a.Accion,
        Entidad = a.Entidad,
        EntidadId = a.EntidadId,
        Descripcion = a.Descripcion,
        Fecha = a.Fecha,
    };
}
