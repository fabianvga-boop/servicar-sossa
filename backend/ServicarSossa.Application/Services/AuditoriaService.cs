using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.Auditoria;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Services;

/// <summary>Consulta de la bitácora de auditoría (solo lectura).</summary>
public class AuditoriaService(IAuditoriaRepository auditorias) : IAuditoriaService
{
    public async Task<Result<IEnumerable<AuditoriaResponseDto>>> BuscarAsync(
        string? entidad, string? entidadId, string? usuarioId, AccionAuditoria? accion,
        DateTime? desde, DateTime? hasta, CancellationToken ct = default)
    {
        var lista = await auditorias.BuscarAsync(entidad, entidadId, usuarioId, accion, desde, hasta, ct);
        return Result<IEnumerable<AuditoriaResponseDto>>.Ok(lista.Select(Mapear));
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
