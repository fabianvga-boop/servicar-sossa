using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.Usuarios;

namespace ServicarSossa.Application.Interfaces;

/// <summary>USU001, USU003, USU004, USU005 — CRUD de usuarios y asignación de rol.</summary>
public interface IUsuarioService
{
    Task<Result<IEnumerable<UsuarioResponseDto>>> GetAllAsync(
        string? buscar, CancellationToken ct = default);

    Task<Result<UsuarioResponseDto>> GetByIdAsync(string id, CancellationToken ct = default);

    Task<Result<UsuarioResponseDto>> CreateAsync(
        UsuarioRequestDto dto, string actorId, CancellationToken ct = default);

    Task<Result<UsuarioResponseDto>> UpdateAsync(
        string id, UsuarioUpdateDto dto, string actorId, CancellationToken ct = default);

    /// <summary>USU004 — baja lógica: cambia el estado, nunca borra el registro.</summary>
    Task<Result<UsuarioResponseDto>> CambiarEstadoAsync(
        string id, CambiarEstadoUsuarioDto dto, string actorId, CancellationToken ct = default);
}
