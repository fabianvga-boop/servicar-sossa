using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.Comunes;
using ServicarSossa.Application.DTOs.TiposServicio;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Services;

/// <summary>USU013 — gestión del catálogo de tipos de servicio.</summary>
public class TipoServicioService(
    ITipoServicioRepository servicios,
    IGeneradorId generadorId,
    IAuditor auditor) : ITipoServicioService
{
    public async Task<Result<ResultadoPaginadoDto<TipoServicioResponseDto>>> GetAllAsync(
        string? buscar, bool soloActivos, int pagina, int tamanoPagina, CancellationToken ct = default)
    {
        var (items, total) = await servicios.BuscarAsync(buscar, soloActivos, pagina, tamanoPagina, ct);
        return Result<ResultadoPaginadoDto<TipoServicioResponseDto>>.Ok(
            new ResultadoPaginadoDto<TipoServicioResponseDto>
            {
                Items = items.Select(Mapear),
                TotalRegistros = total,
                Pagina = pagina,
                TamanoPagina = tamanoPagina
            });
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
        TipoServicioRequestDto dto, string usuarioId, CancellationToken ct = default)
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

        await auditor.RegistrarAsync(
            usuarioId, AccionAuditoria.Crear, "TipoServicio", servicio.ServicioId,
            $"Registró el servicio '{nombre}' en el catálogo.", ct);

        await servicios.SaveChangesAsync(ct);

        return Result<TipoServicioResponseDto>.Ok(Mapear(servicio), "Servicio registrado correctamente.");
    }

    public async Task<Result<TipoServicioResponseDto>> UpdateAsync(
        string id, TipoServicioUpdateDto dto, string usuarioId, CancellationToken ct = default)
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

        await auditor.RegistrarAsync(
            usuarioId, AccionAuditoria.Editar, "TipoServicio", id,
            $"Editó el servicio '{nombre}' del catálogo.", ct);

        await servicios.SaveChangesAsync(ct);

        return Result<TipoServicioResponseDto>.Ok(Mapear(servicio), "Servicio actualizado correctamente.");
    }

    public async Task<Result<TipoServicioResponseDto>> CambiarEstadoAsync(
        string id, CambiarEstadoServicioDto dto, string usuarioId, CancellationToken ct = default)
    {
        var servicio = await servicios.FirstOrDefaultAsync(s => s.ServicioId == id, ct);

        if (servicio is null)
            return Result<TipoServicioResponseDto>.NoEncontrado($"No existe el servicio {id}.");

        if (servicio.Estado == dto.Estado)
            return Result<TipoServicioResponseDto>.Fail($"El servicio ya está {dto.Estado}.");

        servicio.Estado = dto.Estado;

        await auditor.RegistrarAsync(
            usuarioId, AccionAuditoria.CambiarEstado, "TipoServicio", id,
            $"Marcó el servicio '{servicio.Nombre}' como {dto.Estado}.", ct);

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
