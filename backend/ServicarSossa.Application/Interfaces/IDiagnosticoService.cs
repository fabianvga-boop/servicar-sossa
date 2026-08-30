using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.Comprobantes;
using ServicarSossa.Application.DTOs.Diagnosticos;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Interfaces;

/// <summary>USU012, USU014, USU015, USU016 — diagnósticos de vehículos.</summary>
public interface IDiagnosticoService
{
    /// <summary>USU014 — historial de diagnósticos, filtrable.</summary>
    Task<Result<IEnumerable<DiagnosticoResponseDto>>> GetAllAsync(
        string? vehiculoId, string? mecanicoId, EstadoDiag? estado,
        CancellationToken ct = default);

    Task<Result<DiagnosticoResponseDto>> GetByIdAsync(string id, CancellationToken ct = default);

    /// <summary>USU012 — registra el diagnóstico a nombre del mecánico autenticado.</summary>
    Task<Result<DiagnosticoResponseDto>> CreateAsync(
        DiagnosticoRequestDto dto, string mecanicoId, CancellationToken ct = default);

    /// <summary>
    /// USU015, USU016 — edita el diagnóstico y registra <c>fecha_modificacion</c>.
    /// Un mecánico solo puede editar los suyos; el administrador, cualquiera.
    /// </summary>
    Task<Result<DiagnosticoResponseDto>> UpdateAsync(
        string id, DiagnosticoUpdateDto dto,
        string usuarioId, bool esAdministrador, CancellationToken ct = default);

    /// <summary>Cambia el estado (Registrado → Revisado / Anulado).</summary>
    Task<Result<DiagnosticoResponseDto>> CambiarEstadoAsync(
        string id, CambiarEstadoDiagnosticoDto dto,
        string usuarioId, bool esAdministrador, CancellationToken ct = default);

    /// <summary>
    /// Registra la respuesta del cliente (Aprobado / Rechazado) al presupuesto
    /// aproximado. Solo se responde una vez y exige monto estimado cargado.
    /// </summary>
    Task<Result<DiagnosticoResponseDto>> ResponderAsync(
        string id, ResponderDiagnosticoDto dto,
        string usuarioId, bool esAdministrador, CancellationToken ct = default);

    /// <summary>Genera el presupuesto preliminar del diagnóstico en PDF.</summary>
    Task<Result<ArchivoComprobanteDto>> GetPdfAsync(string id, CancellationToken ct = default);
}
