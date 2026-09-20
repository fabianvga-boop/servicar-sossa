using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.Comunes;
using ServicarSossa.Application.DTOs.Pagos;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Interfaces;

/// <summary>USU037 — registro de pagos de clientes.</summary>
public interface IPagoService
{
    Task<Result<ResultadoPaginadoDto<PagoResponseDto>>> GetAllAsync(
        string? proformaId, string? clienteId, MetodoPago? metodoPago,
        DateTime? desde, DateTime? hasta, int pagina, int tamanoPagina, CancellationToken ct = default);

    Task<Result<PagoResponseDto>> GetByIdAsync(string id, CancellationToken ct = default);

    /// <summary>USU037 — registra un pago (total o parcial) contra una factura emitida.</summary>
    Task<Result<PagoResponseDto>> CreateAsync(
        PagoRequestDto dto, string usuarioId, CancellationToken ct = default);

    /// <summary>Revierte un pago mal registrado. Es la única forma de corregirlo.</summary>
    Task<Result<bool>> RevertirAsync(string id, string usuarioId, CancellationToken ct = default);
}
