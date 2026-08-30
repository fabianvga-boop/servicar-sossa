using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.DTOs.Auditoria;

/// <summary>Una fila de la bitácora de auditoría.</summary>
public class AuditoriaResponseDto
{
    public string AuditoriaId { get; set; } = string.Empty;
    public string UsuarioId { get; set; } = string.Empty;
    public string NombreUsuario { get; set; } = string.Empty;
    public AccionAuditoria Accion { get; set; } = AccionAuditoria.Crear;
    public string Entidad { get; set; } = string.Empty;
    public string EntidadId { get; set; } = string.Empty;
    public string Descripcion { get; set; } = string.Empty;
    public DateTime Fecha { get; set; }
}
