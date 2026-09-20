using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.Comprobantes;
using ServicarSossa.Application.DTOs.Comunes;
using ServicarSossa.Application.DTOs.Diagnosticos;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Interfaces;

/// <summary>USU012, USU014, USU015, USU016 — diagnósticos de vehículos.</summary>
public interface IDiagnosticoService
{
    /// <summary>USU014 — historial de diagnósticos, filtrable.</summary>
    Task<Result<ResultadoPaginadoDto<DiagnosticoResponseDto>>> GetAllAsync(
        string? vehiculoId, string? mecanicoId, EstadoDiag? estado, string? buscar,
        int pagina, int tamanoPagina, CancellationToken ct = default);

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

    // ------------------------------------------------------- Diagnóstico asistido

    /// <summary>
    /// Sugiere servicios, repuestos y un rango de precio para una falla que
    /// todavía se está redactando (antes de guardar el diagnóstico), comparándola
    /// contra el historial de diagnósticos que sí llegaron a una orden.
    /// </summary>
    Task<Result<SugerenciaDiagnosticoDto>> GetSugerenciasAsync(
        string descripcionFalla, CancellationToken ct = default);

    /// <summary>Misma sugerencia, pero a partir de la falla ya guardada de un diagnóstico existente.</summary>
    Task<Result<SugerenciaDiagnosticoDto>> GetSugerenciasPorIdAsync(
        string diagnosticoId, CancellationToken ct = default);
}
