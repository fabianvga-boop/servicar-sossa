using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.Clientes;

namespace ServicarSossa.Application.Interfaces;

/// <summary>USU006, USU007, USU008 — CRUD de clientes.</summary>
public interface IClienteService
{
    Task<Result<IEnumerable<ClienteResponseDto>>> GetAllAsync(
        string? buscar, CancellationToken ct = default);

    Task<Result<ClienteResponseDto>> GetByIdAsync(string id, CancellationToken ct = default);

    Task<Result<ClienteResponseDto>> CreateAsync(
        ClienteRequestDto dto, string usuarioId, CancellationToken ct = default);

    Task<Result<ClienteResponseDto>> UpdateAsync(
        string id, ClienteUpdateDto dto, string usuarioId, CancellationToken ct = default);

    /// <summary>USU008 — baja lógica: cambia el estado, nunca borra el registro.</summary>
    Task<Result<ClienteResponseDto>> CambiarEstadoAsync(
        string id, CambiarEstadoClienteDto dto, string usuarioId, CancellationToken ct = default);
}
