using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.Compras;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Services;

/// <summary>USU029 — registro de compras a proveedores.</summary>
public class CompraService(
    ICompraRepository compras,
    IProveedorRepository proveedores,
    IRepuestoRepository repuestos,
    IGeneradorId generadorId,
    IUnitOfWork unitOfWork,
    IAuditor auditor) : ICompraService
{
    public async Task<Result<IEnumerable<CompraResponseDto>>> GetAllAsync(
        string? proveedorId, DateTime? desde, DateTime? hasta, CancellationToken ct = default)
    {
        if (desde.HasValue && hasta.HasValue && desde > hasta)
            return Result<IEnumerable<CompraResponseDto>>.Fail(
                "La fecha inicial no puede ser posterior a la final.");

        if (!string.IsNullOrWhiteSpace(proveedorId)
            && !await proveedores.ExistsAsync(p => p.ProveedorId == proveedorId, ct))
            return Result<IEnumerable<CompraResponseDto>>.NoEncontrado(
                $"No existe el proveedor {proveedorId}.");

        var lista = await compras.BuscarAsync(proveedorId, desde, hasta, ct);
        return Result<IEnumerable<CompraResponseDto>>.Ok(lista.Select(MapearResumen));
    }

    public async Task<Result<CompraDetalleResponseDto>> GetByIdAsync(
        string id, CancellationToken ct = default)
    {
        var compra = await compras.GetDetalleAsync(id, ct);

        return compra is null
            ? Result<CompraDetalleResponseDto>.NoEncontrado($"No existe la compra {id}.")
            : Result<CompraDetalleResponseDto>.Ok(MapearDetalle(compra));
    }

    /// <summary>
    /// Regla de negocio 2 del CLAUDE.md: al registrar una compra se incrementa el
    /// <c>stock_actual</c> de cada repuesto del detalle. Todo ocurre en una
    /// transacción: si una línea falla, no queda ni la compra ni el stock alterado.
    /// </summary>
    public async Task<Result<CompraDetalleResponseDto>> CreateAsync(
        CompraRequestDto dto, string usuarioId, CancellationToken ct = default)
    {
        if (!await proveedores.ExistsAsync(p => p.ProveedorId == dto.ProveedorId, ct))
            return Result<CompraDetalleResponseDto>.Fail(
                $"El proveedor {dto.ProveedorId} no existe.");

        // Un mismo repuesto repetido en dos líneas haría ambiguo el detalle.
        var duplicados = dto.Detalles
            .GroupBy(d => d.RepuestoId)
            .Where(g => g.Count() > 1)
            .Select(g => g.Key)
            .ToList();

        if (duplicados.Count > 0)
            return Result<CompraDetalleResponseDto>.Fail(
                $"El repuesto {string.Join(", ", duplicados)} aparece más de una vez. " +
                "Consolide las cantidades en una sola línea.");

        // Validación previa: que todos los repuestos existan antes de tocar nada.
        foreach (var linea in dto.Detalles)
        {
            if (!await repuestos.ExistsAsync(r => r.RepuestoId == linea.RepuestoId, ct))
                return Result<CompraDetalleResponseDto>.Fail(
                    $"El repuesto {linea.RepuestoId} no existe.");
        }

        var compraId = await unitOfWork.EjecutarEnTransaccionAsync(async token =>
        {
            var compra = new Compra
            {
                CompraId = await generadorId.SiguienteAsync<Compra>("CMP", token),
                ProveedorId = dto.ProveedorId,
                UsuarioId = usuarioId,
                Fecha = DateTime.UtcNow,
                Total = dto.Detalles.Sum(d => d.Cantidad * d.PrecioUnitario)
            };

            await compras.AddAsync(compra, token);
            await compras.SaveChangesAsync(token);

            foreach (var linea in dto.Detalles)
            {
                await compras.AgregarDetalleAsync(new CompraDetalle
                {
                    DetalleId = await generadorId.SiguienteAsync<CompraDetalle>("DET", token),
                    CompraId = compra.CompraId,
                    RepuestoId = linea.RepuestoId,
                    Cantidad = linea.Cantidad,
                    PrecioUnitario = linea.PrecioUnitario
                }, token);

                // Se guarda por línea para que el generador de IDs vea el detalle
                // recién insertado y no repita el código en la siguiente vuelta.
                await compras.SaveChangesAsync(token);

                // Regla 2: la compra ingresa mercadería al inventario.
                var repuesto = await repuestos.GetByIdAsync(linea.RepuestoId, token);
                repuesto!.StockActual += linea.Cantidad;

                // El último precio pagado pasa a ser el costo de referencia del repuesto.
                // El precio de venta no se toca: lo fija el taller, no el proveedor.
                repuesto.PrecioCompra = linea.PrecioUnitario;
            }

            await repuestos.SaveChangesAsync(token);

            await auditor.RegistrarAsync(
                usuarioId, AccionAuditoria.Crear, "Compra", compra.CompraId,
                $"Registró la compra {compra.CompraId} por Bs {compra.Total:N2}.", token);
            await compras.SaveChangesAsync(token);

            return compra.CompraId;
        }, ct);

        var creada = await compras.GetDetalleAsync(compraId, ct);
        return Result<CompraDetalleResponseDto>.Ok(
            MapearDetalle(creada!), "Compra registrada y stock actualizado correctamente.");
    }

    private static CompraResponseDto MapearResumen(Compra c) => new()
    {
        CompraId = c.CompraId,
        ProveedorId = c.ProveedorId,
        NombreProveedor = c.Proveedor?.Nombre ?? string.Empty,
        UsuarioId = c.UsuarioId,
        NombreUsuario = c.Usuario is null
            ? string.Empty
            : $"{c.Usuario.Nombre} {c.Usuario.Apellido}".Trim(),
        Fecha = c.Fecha,
        Total = c.Total,
        CantidadLineas = c.Detalles.Count
    };

    private static CompraDetalleResponseDto MapearDetalle(Compra c) => new()
    {
        CompraId = c.CompraId,
        ProveedorId = c.ProveedorId,
        NombreProveedor = c.Proveedor?.Nombre ?? string.Empty,
        UsuarioId = c.UsuarioId,
        NombreUsuario = c.Usuario is null
            ? string.Empty
            : $"{c.Usuario.Nombre} {c.Usuario.Apellido}".Trim(),
        Fecha = c.Fecha,
        Total = c.Total,
        CantidadLineas = c.Detalles.Count,
        Detalles = [.. c.Detalles.Select(d => new CompraLineaResponseDto
        {
            DetalleId = d.DetalleId,
            RepuestoId = d.RepuestoId,
            NombreRepuesto = d.Repuesto?.Nombre ?? string.Empty,
            Cantidad = d.Cantidad,
            PrecioUnitario = d.PrecioUnitario,
            Subtotal = d.Cantidad * d.PrecioUnitario
        })]
    };
}
