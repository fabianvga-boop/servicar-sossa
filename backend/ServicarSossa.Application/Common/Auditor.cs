using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Common;

/// <inheritdoc cref="IAuditor"/>
public class Auditor(IRepository<Auditoria> repo, IGeneradorId generadorId) : IAuditor
{
    public async Task RegistrarAsync(
        string usuarioId, AccionAuditoria accion, string entidad, string entidadId,
        string descripcion, CancellationToken ct = default)
    {
        await repo.AddAsync(new Auditoria
        {
            AuditoriaId = await generadorId.SiguienteAsync<Auditoria>("AUD", ct),
            UsuarioId = usuarioId,
            Accion = accion,
            Entidad = entidad,
            EntidadId = entidadId,
            Descripcion = descripcion,
        }, ct);

        // No hace falta SaveChangesAsync propio: el mismo DbContext (scoped) lo
        // persiste cuando el servicio que llamó guarda sus propios cambios.
    }
}
