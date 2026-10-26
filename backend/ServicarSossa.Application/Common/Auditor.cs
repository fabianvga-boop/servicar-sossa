using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Common;

/// <inheritdoc cref="IAuditor"/>
public class Auditor(IRepository<Auditoria> repo, IGeneradorId generadorId) : IAuditor
{
    private const int LargoDescripcion = 300;

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
            // La columna admite 300 caracteres; un motivo largo no debe
            // impedir guardar la operación que se está auditando.
            Descripcion = descripcion.Length <= LargoDescripcion
                ? descripcion
                : descripcion[..(LargoDescripcion - 1)] + "…",
        }, ct);

        // No hace falta SaveChangesAsync propio: el mismo DbContext (scoped) lo
        // persiste cuando el servicio que llamó guarda sus propios cambios.
    }
}
