using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.CategoriasRepuesto;
using ServicarSossa.Application.DTOs.Comunes;
using ServicarSossa.Application.DTOs.TiposServicio;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Services;

/// <summary>USU013 — gestión del catálogo de tipos de servicio.</summary>
public class TipoServicioService(
    ITipoServicioRepository servicios,
    ICategoriaRepuestoRepository categorias,
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
        var servicio = await servicios.GetConCategoriasAsync(id, ct);

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

        var (errorCategorias, elegidas) = await ElegirCategoriasAsync(dto.RequiereRepuesto, dto.CategoriaIds, ct);
        if (errorCategorias is not null) return Result<TipoServicioResponseDto>.Fail(errorCategorias);

        var servicio = new TipoServicio
        {
            ServicioId = await generadorId.SiguienteAsync<TipoServicio>("SER", ct),
            Nombre = nombre,
            Descripcion = string.IsNullOrWhiteSpace(dto.Descripcion) ? null : dto.Descripcion.Trim(),
            PrecioBase = dto.PrecioBase,
            RequiereRepuesto = dto.RequiereRepuesto,
            Estado = EstadoServicio.Activo,
            // Solo el código: las categorías se leyeron sin seguimiento y EF las
            // intentaría insertar de nuevo si se enlazara la entidad.
            Categorias = [.. elegidas.Select(c => new ServicioCategoria { CategoriaId = c.CategoriaId })]
        };

        await servicios.AddAsync(servicio, ct);

        await auditor.RegistrarAsync(
            usuarioId, AccionAuditoria.Crear, "TipoServicio", servicio.ServicioId,
            $"Registró el servicio '{nombre}' en el catálogo{DescribirCategorias(elegidas)}.", ct);

        await servicios.SaveChangesAsync(ct);

        var creado = await servicios.GetConCategoriasAsync(servicio.ServicioId, ct);
        return Result<TipoServicioResponseDto>.Ok(Mapear(creado!), "Servicio registrado correctamente.");
    }

    public async Task<Result<TipoServicioResponseDto>> UpdateAsync(
        string id, TipoServicioUpdateDto dto, string usuarioId, CancellationToken ct = default)
    {
        var servicio = await servicios.GetConCategoriasAsync(id, ct);

        if (servicio is null)
            return Result<TipoServicioResponseDto>.NoEncontrado($"No existe el servicio {id}.");

        var nombre = dto.Nombre.Trim();

        if (await servicios.ExistsAsync(
                s => s.Nombre.ToLower() == nombre.ToLower() && s.ServicioId != id, ct))
            return Result<TipoServicioResponseDto>.Conflicto(
                $"Ya existe otro servicio llamado '{nombre}'.");

        var (errorCategorias, elegidas) = await ElegirCategoriasAsync(dto.RequiereRepuesto, dto.CategoriaIds, ct);
        if (errorCategorias is not null) return Result<TipoServicioResponseDto>.Fail(errorCategorias);

        servicio.Nombre = nombre;
        servicio.Descripcion = string.IsNullOrWhiteSpace(dto.Descripcion) ? null : dto.Descripcion.Trim();
        servicio.PrecioBase = dto.PrecioBase;
        // Solo afecta a las órdenes que carguen el servicio de ahora en adelante:
        // las ya cargadas conservan la marca con la que se agregaron.
        servicio.RequiereRepuesto = dto.RequiereRepuesto;

        // Las categorías sí valen enseguida, también en las órdenes en curso: se
        // leen del catálogo al registrar cada repuesto.
        var nuevas = elegidas.Select(c => c.CategoriaId).ToHashSet();
        foreach (var enlace in servicio.Categorias.Where(c => !nuevas.Contains(c.CategoriaId)).ToList())
            servicio.Categorias.Remove(enlace);
        foreach (var categoria in elegidas.Where(c => servicio.Categorias.All(e => e.CategoriaId != c.CategoriaId)))
            servicio.Categorias.Add(new ServicioCategoria { ServicioId = id, CategoriaId = categoria.CategoriaId });

        await auditor.RegistrarAsync(
            usuarioId, AccionAuditoria.Editar, "TipoServicio", id,
            $"Editó el servicio '{nombre}' del catálogo{DescribirCategorias(elegidas)}.", ct);

        await servicios.SaveChangesAsync(ct);

        var actualizado = await servicios.GetConCategoriasAsync(id, ct);
        return Result<TipoServicioResponseDto>.Ok(Mapear(actualizado!), "Servicio actualizado correctamente.");
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

    /// <summary>
    /// Valida las categorías elegidas. Un servicio que no lleva repuestos no
    /// guarda categorías: no habría nada que controlar.
    /// </summary>
    private async Task<(string? Error, List<CategoriaRepuesto> Elegidas)> ElegirCategoriasAsync(
        bool requiereRepuesto, List<string>? categoriaIds, CancellationToken ct)
    {
        if (!requiereRepuesto || categoriaIds is null || categoriaIds.Count == 0) return (null, []);

        var ids = categoriaIds.Where(c => !string.IsNullOrWhiteSpace(c)).Distinct().ToList();
        var encontradas = (await categorias.FindAsync(c => ids.Contains(c.CategoriaId), ct)).ToList();

        return encontradas.Count == ids.Count
            ? (null, encontradas)
            : ("Alguna de las categorías elegidas ya no existe (puede que la hayan borrado). Vuelva a elegirlas.", []);
    }

    private static string DescribirCategorias(List<CategoriaRepuesto> categorias)
        => categorias.Count == 0
            ? string.Empty
            : $" (lleva: {string.Join(", ", categorias.Select(c => c.Nombre).Order())})";

    private static TipoServicioResponseDto Mapear(TipoServicio s) => new()
    {
        ServicioId = s.ServicioId,
        Nombre = s.Nombre,
        Descripcion = s.Descripcion,
        PrecioBase = s.PrecioBase,
        RequiereRepuesto = s.RequiereRepuesto,
        Categorias = [.. s.Categorias
            .Where(c => c.Categoria is not null)
            .OrderBy(c => c.Categoria.Nombre)
            .Select(c => new CategoriaResumenDto { CategoriaId = c.CategoriaId, Nombre = c.Categoria.Nombre })],
        Estado = s.Estado
    };
}
