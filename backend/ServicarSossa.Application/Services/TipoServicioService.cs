using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.TiposServicio;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Services;

/// <summary>USU013 — gestión del catálogo de tipos de servicio.</summary>
public class TipoServicioService(
    ITipoServicioRepository servicios,
    IGeneradorId generadorId) : ITipoServicioService
{
    public async Task<Result<IEnumerable<TipoServicioResponseDto>>> GetAllAsync(
        string? buscar, bool soloActivos, CancellationToken ct = default)
    {
        var lista = await servicios.BuscarAsync(buscar, soloActivos, ct);
        return Result<IEnumerable<TipoServicioResponseDto>>.Ok(lista.Select(Mapear));
    }

    public async Task<Result<TipoServicioResponseDto>> GetByIdAsync(
        string id, CancellationToken ct = default)
    {
        var servicio = await servicios.GetByIdAsync(id, ct);

        return servicio is null
            ? Result<TipoServicioResponseDto>.NoEncontrado($"No existe el servicio {id}.")
            : Result<TipoServicioResponseDto>.Ok(Mapear(servicio));
    }

    public async Task<Result<TipoServicioResponseDto>> CreateAsync(
        TipoServicioRequestDto dto, CancellationToken ct = default)
    {
        var nombre = dto.Nombre.Trim();

        // El DDL no impone UNIQUE sobre el nombre, pero dos servicios homónimos
        // en el catálogo harían ambiguo el selector de la orden de trabajo.
        if (await servicios.ExistsAsync(s => s.Nombre.ToLower() == nombre.ToLower(), ct))
            return Result<TipoServicioResponseDto>.Conflicto(
                $"Ya existe un servicio llamado '{nombre}'.");

        var servicio = new TipoServicio
        {
            ServicioId = await generadorId.SiguienteAsync<TipoServicio>("SER", ct),
            Nombre = nombre,
            Descripcion = string.IsNullOrWhiteSpace(dto.Descripcion) ? null : dto.Descripcion.Trim(),
            PrecioBase = dto.PrecioBase,
            Estado = EstadoServicio.Activo
        };

        await servicios.AddAsync(servicio, ct);
        await servicios.SaveChangesAsync(ct);

        return Result<TipoServicioResponseDto>.Ok(Mapear(servicio), "Servicio registrado correctamente.");
    }

    public async Task<Result<TipoServicioResponseDto>> UpdateAsync(
        string id, TipoServicioUpdateDto dto, CancellationToken ct = default)
    {
        var servicio = await servicios.FirstOrDefaultAsync(s => s.ServicioId == id, ct);

        if (servicio is null)
            return Result<TipoServicioResponseDto>.NoEncontrado($"No existe el servicio {id}.");

        var nombre = dto.Nombre.Trim();

        if (await servicios.ExistsAsync(
                s => s.Nombre.ToLower() == nombre.ToLower() && s.ServicioId != id, ct))
            return Result<TipoServicioResponseDto>.Conflicto(
                $"Ya existe otro servicio llamado '{nombre}'.");

        servicio.Nombre = nombre;
        servicio.Descripcion = string.IsNullOrWhiteSpace(dto.Descripcion) ? null : dto.Descripcion.Trim();
        servicio.PrecioBase = dto.PrecioBase;

        await servicios.SaveChangesAsync(ct);

        return Result<TipoServicioResponseDto>.Ok(Mapear(servicio), "Servicio actualizado correctamente.");
    }

    public async Task<Result<TipoServicioResponseDto>> CambiarEstadoAsync(
        string id, CambiarEstadoServicioDto dto, CancellationToken ct = default)
    {
        var servicio = await servicios.FirstOrDefaultAsync(s => s.ServicioId == id, ct);

        if (servicio is null)
            return Result<TipoServicioResponseDto>.NoEncontrado($"No existe el servicio {id}.");

        if (servicio.Estado == dto.Estado)
            return Result<TipoServicioResponseDto>.Fail($"El servicio ya está {dto.Estado}.");

        servicio.Estado = dto.Estado;
        await servicios.SaveChangesAsync(ct);

        return Result<TipoServicioResponseDto>.Ok(
            Mapear(servicio), $"Servicio marcado como {dto.Estado}.");
    }

    private static TipoServicioResponseDto Mapear(TipoServicio s) => new()
    {
        ServicioId = s.ServicioId,
        Nombre = s.Nombre,
        Descripcion = s.Descripcion,
        PrecioBase = s.PrecioBase,
        Estado = s.Estado
    };
}
