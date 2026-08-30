using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Interfaces;

/// <summary>
/// Deja constancia en la bitácora de auditoría. Los servicios lo llaman después
/// de cada acción relevante (crear, editar, eliminar, anular, ajustar, cambiar
/// estado); el registro se guarda junto con el resto de los cambios del método
/// que lo llama, en el mismo <c>SaveChangesAsync</c>.
/// </summary>
public interface IAuditor
{
    Task RegistrarAsync(
        string usuarioId, AccionAuditoria accion, string entidad, string entidadId,
        string descripcion, CancellationToken ct = default);
}
