using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.Comunes;
using ServicarSossa.Application.DTOs.Repuestos;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Services;

/// <summary>USU026, USU027, USU030 — inventario de repuestos.</summary>
public class RepuestoService(
    IRepuestoRepository repuestos,
    IProveedorRepository proveedores,
    IAlmacenArchivos archivos,
    IGeneradorId generadorId,
    IAuditor auditor) : IRepuestoService
{
    private const string SubcarpetaFotos = "repuestos";
    public async Task<Result<IEnumerable<RepuestoResponseDto>>> GetAllAsync(
        string? buscar, string? proveedorId, bool soloStockBajo, CancellationToken ct = default)
    {
        if (!string.IsNullOrWhiteSpace(proveedorId)
            && !await proveedores.ExistsAsync(p => p.ProveedorId == proveedorId, ct))
            return Result<IEnumerable<RepuestoResponseDto>>.NoEncontrado(
                $"No existe el proveedor {proveedorId}.");

        var lista = await repuestos.BuscarAsync(buscar, proveedorId, soloStockBajo, ct);
        return Result<IEnumerable<RepuestoResponseDto>>.Ok(lista.Select(Mapear));
    }

    public async Task<Result<RepuestoResponseDto>> GetByIdAsync(
        string id, CancellationToken ct = default)
    {
        var repuesto = await repuestos.GetByIdConProveedorAsync(id, ct);

        return repuesto is null
            ? Result<RepuestoResponseDto>.NoEncontrado($"No existe el repuesto {id}.")
            : Result<RepuestoResponseDto>.Ok(Mapear(repuesto));
    }

    public async Task<Result<RepuestoResponseDto>> CreateAsync(
        RepuestoRequestDto dto, string usuarioId, CancellationToken ct = default)
    {
        var nombre = dto.Nombre.Trim();

        if (await repuestos.ExistsAsync(r => r.Nombre.ToLower() == nombre.ToLower(), ct))
            return Result<RepuestoResponseDto>.Conflicto(
                $"Ya existe un repuesto llamado '{nombre}'.");

        var error = await ValidarProveedorAsync(dto.ProveedorId, ct);
        if (error is not null) return error;

        var repuesto = new Repuesto
        {
            RepuestoId = await generadorId.SiguienteAsync<Repuesto>("REP", ct),
            Nombre = nombre,
            Descripcion = string.IsNullOrWhiteSpace(dto.Descripcion) ? null : dto.Descripcion.Trim(),
            StockActual = dto.StockActual,
            StockMinimo = dto.StockMinimo,
            PrecioCompra = dto.PrecioCompra,
            PrecioVenta = dto.PrecioVenta,
            ProveedorId = string.IsNullOrWhiteSpace(dto.ProveedorId) ? null : dto.ProveedorId
        };

        await repuestos.AddAsync(repuesto, ct);

        await auditor.RegistrarAsync(
            usuarioId, AccionAuditoria.Crear, "Repuesto", repuesto.RepuestoId,
            $"Registró el repuesto '{repuesto.Nombre}'.", ct);

        await repuestos.SaveChangesAsync(ct);

        var creado = await repuestos.GetByIdConProveedorAsync(repuesto.RepuestoId, ct);
        return Result<RepuestoResponseDto>.Ok(Mapear(creado!), "Repuesto registrado correctamente.");
    }

    public async Task<Result<RepuestoResponseDto>> UpdateAsync(
        string id, RepuestoUpdateDto dto, string usuarioId, CancellationToken ct = default)
    {
        var repuesto = await repuestos.FirstOrDefaultAsync(r => r.RepuestoId == id, ct);

        if (repuesto is null)
            return Result<RepuestoResponseDto>.NoEncontrado($"No existe el repuesto {id}.");

        var nombre = dto.Nombre.Trim();

        if (await repuestos.ExistsAsync(
                r => r.Nombre.ToLower() == nombre.ToLower() && r.RepuestoId != id, ct))
            return Result<RepuestoResponseDto>.Conflicto(
                $"Ya existe otro repuesto llamado '{nombre}'.");

        var error = await ValidarProveedorAsync(dto.ProveedorId, ct);
        if (error is not null) return error;

        repuesto.Nombre = nombre;
        repuesto.Descripcion = string.IsNullOrWhiteSpace(dto.Descripcion) ? null : dto.Descripcion.Trim();
        repuesto.StockMinimo = dto.StockMinimo;
        repuesto.PrecioCompra = dto.PrecioCompra;
        repuesto.PrecioVenta = dto.PrecioVenta;
        repuesto.ProveedorId = string.IsNullOrWhiteSpace(dto.ProveedorId) ? null : dto.ProveedorId;

        await auditor.RegistrarAsync(
            usuarioId, AccionAuditoria.Editar, "Repuesto", id,
            $"Editó el repuesto '{repuesto.Nombre}'.", ct);

        await repuestos.SaveChangesAsync(ct);

        var actualizado = await repuestos.GetByIdConProveedorAsync(id, ct);
        return Result<RepuestoResponseDto>.Ok(Mapear(actualizado!), "Repuesto actualizado correctamente.");
    }

    public async Task<Result<RepuestoResponseDto>> AjustarStockAsync(
        string id, AjustarStockDto dto, string usuarioId, CancellationToken ct = default)
    {
        var repuesto = await repuestos.FirstOrDefaultAsync(r => r.RepuestoId == id, ct);

        if (repuesto is null)
            return Result<RepuestoResponseDto>.NoEncontrado($"No existe el repuesto {id}.");

        var anterior = repuesto.StockActual;

        if (anterior == dto.StockActual)
            return Result<RepuestoResponseDto>.Fail(
                $"El stock de '{repuesto.Nombre}' ya es {dto.StockActual}.");

        repuesto.StockActual = dto.StockActual;

        await auditor.RegistrarAsync(
            usuarioId, AccionAuditoria.Ajustar, "Repuesto", id,
            $"Ajustó el stock de '{repuesto.Nombre}' de {anterior} a {dto.StockActual} unidades.", ct);

        await repuestos.SaveChangesAsync(ct);

        var actualizado = await repuestos.GetByIdConProveedorAsync(id, ct);
        return Result<RepuestoResponseDto>.Ok(
            Mapear(actualizado!), $"Stock ajustado de {anterior} a {dto.StockActual} unidades.");
    }

    public async Task<Result<bool>> DeleteAsync(string id, string usuarioId, CancellationToken ct = default)
    {
        var repuesto = await repuestos.FirstOrDefaultAsync(r => r.RepuestoId == id, ct);

        if (repuesto is null)
            return Result<bool>.NoEncontrado($"No existe el repuesto {id}.");

        // Borrarlo rompería el histórico de compras, órdenes de trabajo y ventas.
        if (await repuestos.TieneMovimientosAsync(id, ct))
            return Result<bool>.Conflicto(
                "No se puede eliminar el repuesto: tiene compras, órdenes o ventas asociadas.");

        var nombre = repuesto.Nombre;
        var foto = repuesto.NombreArchivoFoto;

        repuestos.Remove(repuesto);

        await auditor.RegistrarAsync(
            usuarioId, AccionAuditoria.Eliminar, "Repuesto", id,
            $"Eliminó el repuesto '{nombre}'.", ct);

        await repuestos.SaveChangesAsync(ct);

        if (foto is not null) archivos.Eliminar(SubcarpetaFotos, foto);

        return Result<bool>.Ok(true, "Repuesto eliminado correctamente.");
    }

    // --- Foto del producto (opcional) -----------------------------------------

    public async Task<Result<RepuestoResponseDto>> SubirFotoAsync(
        string id, SubirFotoDto dto, CancellationToken ct = default)
    {
        var repuesto = await repuestos.FirstOrDefaultAsync(r => r.RepuestoId == id, ct);

        if (repuesto is null)
            return Result<RepuestoResponseDto>.NoEncontrado($"No existe el repuesto {id}.");

        var invalida = ValidadorFotos.Validar(dto);
        if (invalida is not null) return Result<RepuestoResponseDto>.Fail(invalida);

        var anterior = repuesto.NombreArchivoFoto;

        // Una sola foto por repuesto: la nueva reemplaza a la anterior.
        repuesto.NombreArchivoFoto = await archivos.GuardarAsync(
            SubcarpetaFotos, id, dto.Contenido, ValidadorFotos.Extension(dto), ct);

        await repuestos.SaveChangesAsync(ct);

        // Si cambió la extensión, el archivo viejo quedaría huérfano en disco.
        if (anterior is not null && anterior != repuesto.NombreArchivoFoto)
            archivos.Eliminar(SubcarpetaFotos, anterior);

        var actualizado = await repuestos.GetByIdConProveedorAsync(id, ct);
        return Result<RepuestoResponseDto>.Ok(Mapear(actualizado!), "Foto actualizada correctamente.");
    }

    public async Task<Result<RepuestoResponseDto>> EliminarFotoAsync(
        string id, CancellationToken ct = default)
    {
        var repuesto = await repuestos.FirstOrDefaultAsync(r => r.RepuestoId == id, ct);

        if (repuesto is null)
            return Result<RepuestoResponseDto>.NoEncontrado($"No existe el repuesto {id}.");

        if (repuesto.NombreArchivoFoto is null)
            return Result<RepuestoResponseDto>.Fail($"'{repuesto.Nombre}' no tiene foto.");

        var archivo = repuesto.NombreArchivoFoto;
        repuesto.NombreArchivoFoto = null;
        await repuestos.SaveChangesAsync(ct);

        archivos.Eliminar(SubcarpetaFotos, archivo);

        var actualizado = await repuestos.GetByIdConProveedorAsync(id, ct);
        return Result<RepuestoResponseDto>.Ok(Mapear(actualizado!), "Foto eliminada correctamente.");
    }

    private async Task<Result<RepuestoResponseDto>?> ValidarProveedorAsync(
        string? proveedorId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(proveedorId)) return null;

        return await proveedores.ExistsAsync(p => p.ProveedorId == proveedorId, ct)
            ? null
            : Result<RepuestoResponseDto>.Fail($"El proveedor {proveedorId} no existe.");
    }

    private RepuestoResponseDto Mapear(Repuesto r) => new()
    {
        RepuestoId = r.RepuestoId,
        Nombre = r.Nombre,
        Descripcion = r.Descripcion,
        StockActual = r.StockActual,
        StockMinimo = r.StockMinimo,
        PrecioCompra = r.PrecioCompra,
        PrecioVenta = r.PrecioVenta,
        ProveedorId = r.ProveedorId,
        NombreProveedor = r.Proveedor?.Nombre,
        FotoUrl = r.NombreArchivoFoto is null
            ? null
            : archivos.RutaPublica(SubcarpetaFotos, r.NombreArchivoFoto)
    };
}
