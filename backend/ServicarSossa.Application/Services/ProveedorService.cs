using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.Proveedores;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Services;

/// <summary>USU028 — gestión de proveedores.</summary>
public class ProveedorService(
    IProveedorRepository proveedores,
    IGeneradorId generadorId,
    IAuditor auditor) : IProveedorService
{
    public async Task<Result<IEnumerable<ProveedorResponseDto>>> GetAllAsync(
        string? buscar, CancellationToken ct = default)
    {
        var lista = (await proveedores.BuscarAsync(buscar, ct)).ToList();
        var conteo = await proveedores.ContarRepuestosPorProveedorAsync(
            lista.Select(p => p.ProveedorId), ct);

        return Result<IEnumerable<ProveedorResponseDto>>.Ok(
            lista.Select(p => Mapear(p, conteo.GetValueOrDefault(p.ProveedorId))));
    }

    public async Task<Result<ProveedorResponseDto>> GetByIdAsync(
        string id, CancellationToken ct = default)
    {
        var proveedor = await proveedores.GetByIdAsync(id, ct);

        if (proveedor is null)
            return Result<ProveedorResponseDto>.NoEncontrado($"No existe el proveedor {id}.");

        var conteo = await proveedores.ContarRepuestosPorProveedorAsync([id], ct);
        return Result<ProveedorResponseDto>.Ok(Mapear(proveedor, conteo.GetValueOrDefault(id)));
    }

    public async Task<Result<ProveedorResponseDto>> CreateAsync(
        ProveedorRequestDto dto, string usuarioId, CancellationToken ct = default)
    {
        var nombre = dto.Nombre.Trim();

        if (await proveedores.ExistsAsync(p => p.Nombre.ToLower() == nombre.ToLower(), ct))
            return Result<ProveedorResponseDto>.Conflicto(
                $"Ya existe un proveedor llamado '{nombre}'.");

        var proveedor = new Proveedor
        {
            ProveedorId = await generadorId.SiguienteAsync<Proveedor>("PRO", ct),
            Nombre = nombre,
            Contacto = Limpiar(dto.Contacto),
            Telefono = Limpiar(dto.Telefono),
            Email = Limpiar(dto.Email)?.ToLowerInvariant(),
            Direccion = Limpiar(dto.Direccion)
        };

        await proveedores.AddAsync(proveedor, ct);

        await auditor.RegistrarAsync(
            usuarioId, AccionAuditoria.Crear, "Proveedor", proveedor.ProveedorId,
            $"Registró el proveedor '{proveedor.Nombre}'.", ct);

        await proveedores.SaveChangesAsync(ct);

        return Result<ProveedorResponseDto>.Ok(
            Mapear(proveedor, 0), "Proveedor registrado correctamente.");
    }

    public async Task<Result<ProveedorResponseDto>> UpdateAsync(
        string id, ProveedorRequestDto dto, string usuarioId, CancellationToken ct = default)
    {
        var proveedor = await proveedores.FirstOrDefaultAsync(p => p.ProveedorId == id, ct);

        if (proveedor is null)
            return Result<ProveedorResponseDto>.NoEncontrado($"No existe el proveedor {id}.");

        var nombre = dto.Nombre.Trim();

        if (await proveedores.ExistsAsync(
                p => p.Nombre.ToLower() == nombre.ToLower() && p.ProveedorId != id, ct))
            return Result<ProveedorResponseDto>.Conflicto(
                $"Ya existe otro proveedor llamado '{nombre}'.");

        proveedor.Nombre = nombre;
        proveedor.Contacto = Limpiar(dto.Contacto);
        proveedor.Telefono = Limpiar(dto.Telefono);
        proveedor.Email = Limpiar(dto.Email)?.ToLowerInvariant();
        proveedor.Direccion = Limpiar(dto.Direccion);

        await auditor.RegistrarAsync(
            usuarioId, AccionAuditoria.Editar, "Proveedor", id,
            $"Editó el proveedor '{proveedor.Nombre}'.", ct);

        await proveedores.SaveChangesAsync(ct);

        var conteo = await proveedores.ContarRepuestosPorProveedorAsync([id], ct);
        return Result<ProveedorResponseDto>.Ok(
            Mapear(proveedor, conteo.GetValueOrDefault(id)), "Proveedor actualizado correctamente.");
    }

    public async Task<Result<bool>> DeleteAsync(string id, string usuarioId, CancellationToken ct = default)
    {
        var proveedor = await proveedores.FirstOrDefaultAsync(p => p.ProveedorId == id, ct);

        if (proveedor is null)
            return Result<bool>.NoEncontrado($"No existe el proveedor {id}.");

        // Borrarlo rompería el histórico de compras y el origen de los repuestos.
        if (await proveedores.TieneReferenciasAsync(id, ct))
            return Result<bool>.Conflicto(
                "No se puede eliminar el proveedor: tiene repuestos o compras asociadas.");

        proveedores.Remove(proveedor);

        await auditor.RegistrarAsync(
            usuarioId, AccionAuditoria.Eliminar, "Proveedor", id,
            $"Eliminó el proveedor '{proveedor.Nombre}'.", ct);

        await proveedores.SaveChangesAsync(ct);

        return Result<bool>.Ok(true, "Proveedor eliminado correctamente.");
    }

    private static string? Limpiar(string? valor)
        => string.IsNullOrWhiteSpace(valor) ? null : valor.Trim();

    private static ProveedorResponseDto Mapear(Proveedor p, int cantidadRepuestos) => new()
    {
        ProveedorId = p.ProveedorId,
        Nombre = p.Nombre,
        Contacto = p.Contacto,
        Telefono = p.Telefono,
        Email = p.Email,
        Direccion = p.Direccion,
        CantidadRepuestos = cantidadRepuestos
    };
}
