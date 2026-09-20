using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.Clientes;
using ServicarSossa.Application.DTOs.Comunes;

namespace ServicarSossa.Application.Interfaces;

/// <summary>USU006, USU007, USU008 — CRUD de clientes.</summary>
public interface IClienteService
{
    Task<Result<ResultadoPaginadoDto<ClienteResponseDto>>> GetAllAsync(
        string? buscar, int pagina, int tamanoPagina, CancellationToken ct = default);

    Task<Result<ClienteResponseDto>> GetByIdAsync(string id, CancellationToken ct = default);

    Task<Result<ClienteResponseDto>> CreateAsync(
        ClienteRequestDto dto, string usuarioId, CancellationToken ct = default);

    Task<Result<ClienteResponseDto>> UpdateAsync(
        string id, ClienteUpdateDto dto, string usuarioId, CancellationToken ct = default);

    /// <summary>USU008 — baja lógica: cambia el estado, nunca borra el registro.</summary>
    Task<Result<ClienteResponseDto>> CambiarEstadoAsync(
        string id, CambiarEstadoClienteDto dto, string usuarioId, CancellationToken ct = default);
}
