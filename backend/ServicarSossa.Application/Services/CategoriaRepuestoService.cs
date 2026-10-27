using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.CategoriasRepuesto;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Services;

/// <summary>
/// Categorías de repuesto (Aceite de motor, Bujías…): las usa el inventario
/// para clasificar y el catálogo de servicios para saber qué tipo de repuesto
/// lleva cada servicio.
/// </summary>
public class CategoriaRepuestoService(
    ICategoriaRepuestoRepository categorias,
    IGeneradorId generadorId,
    IAuditor auditor) : ICategoriaRepuestoService
{
    public async Task<Result<IEnumerable<CategoriaRepuestoResponseDto>>> GetAllAsync(
        CancellationToken ct = default)
    {
        var lista = await categorias.ListarAsync(ct);
        var usos = await categorias.ContarUsosAsync(ct);

        return Result<IEnumerable<CategoriaRepuestoResponseDto>>.Ok(
            lista.Select(c => Mapear(c, usos.GetValueOrDefault(c.CategoriaId))));
    }

    public async Task<Result<CategoriaRepuestoResponseDto>> CreateAsync(
        CategoriaRepuestoRequestDto dto, string usuarioId, CancellationToken ct = default)
    {
        var nombre = dto.Nombre.Trim();

        if (await categorias.ExistsAsync(c => c.Nombre.ToLower() == nombre.ToLower(), ct))
            return Result<CategoriaRepuestoResponseDto>.Conflicto(
                $"Ya existe la categoría '{nombre}'.");

        var categoria = new CategoriaRepuesto
        {
            CategoriaId = await generadorId.SiguienteAsync<CategoriaRepuesto>("CAT", ct),
            Nombre = nombre
        };

        await categorias.AddAsync(categoria, ct);

        await auditor.RegistrarAsync(
            usuarioId, AccionAuditoria.Crear, "CategoriaRepuesto", categoria.CategoriaId,
            $"Creó la categoría de repuesto '{nombre}'.", ct);

        await categorias.SaveChangesAsync(ct);

        return Result<CategoriaRepuestoResponseDto>.Ok(Mapear(categoria, default), "Categoría creada.");
    }

    public async Task<Result<CategoriaRepuestoResponseDto>> UpdateAsync(
        string id, CategoriaRepuestoRequestDto dto, string usuarioId, CancellationToken ct = default)
    {
        var categoria = await categorias.FirstOrDefaultAsync(c => c.CategoriaId == id, ct);

        if (categoria is null)
            return Result<CategoriaRepuestoResponseDto>.NoEncontrado($"No existe la categoría {id}.");

        var nombre = dto.Nombre.Trim();

        if (await categorias.ExistsAsync(
                c => c.Nombre.ToLower() == nombre.ToLower() && c.CategoriaId != id, ct))
            return Result<CategoriaRepuestoResponseDto>.Conflicto(
                $"Ya existe otra categoría llamada '{nombre}'.");

        var antes = categoria.Nombre;
        categoria.Nombre = nombre;

        if (antes != nombre)
            await auditor.RegistrarAsync(
                usuarioId, AccionAuditoria.Editar, "CategoriaRepuesto", id,
                $"Renombró la categoría de repuesto '{antes}' a '{nombre}'.", ct);

        await categorias.SaveChangesAsync(ct);

        var usos = await categorias.ContarUsosAsync(ct);
        return Result<CategoriaRepuestoResponseDto>.Ok(
            Mapear(categoria, usos.GetValueOrDefault(id)), "Categoría actualizada.");
    }

    public async Task<Result<bool>> DeleteAsync(string id, string usuarioId, CancellationToken ct = default)
    {
        var categoria = await categorias.FirstOrDefaultAsync(c => c.CategoriaId == id, ct);

        if (categoria is null)
            return Result<bool>.NoEncontrado($"No existe la categoría {id}.");

        var (cantRepuestos, cantServicios) = (await categorias.ContarUsosAsync(ct)).GetValueOrDefault(id);

        // La BD hace el resto: los repuestos quedan con categoría NULL (SET NULL)
        // y se borra su enlace con los servicios (CASCADE).
        categorias.Remove(categoria);

        await auditor.RegistrarAsync(
            usuarioId, AccionAuditoria.Eliminar, "CategoriaRepuesto", id,
            $"Eliminó la categoría de repuesto '{categoria.Nombre}' " +
            $"({cantRepuestos} repuesto(s) quedaron sin categoría; la usaban {cantServicios} servicio(s)).", ct);

        await categorias.SaveChangesAsync(ct);

        return Result<bool>.Ok(true, "Categoría eliminada.");
    }

    private static CategoriaRepuestoResponseDto Mapear(
        CategoriaRepuesto c, (int Repuestos, int Servicios) usos) => new()
    {
        CategoriaId = c.CategoriaId,
        Nombre = c.Nombre,
        CantidadRepuestos = usos.Repuestos,
        CantidadServicios = usos.Servicios
    };
}
