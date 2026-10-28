using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.Compras;
using ServicarSossa.Application.DTOs.Comunes;
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
    IAuditor auditor,
    IKardex kardex) : ICompraService
{
    public async Task<Result<ResultadoPaginadoDto<CompraResponseDto>>> GetAllAsync(
        string? proveedorId, DateTime? desde, DateTime? hasta,
        int pagina, int tamanoPagina, CancellationToken ct = default)
    {
        if (desde.HasValue && hasta.HasValue && desde > hasta)
            return Result<ResultadoPaginadoDto<CompraResponseDto>>.Fail(
                "La fecha inicial no puede ser posterior a la final.");

        if (!string.IsNullOrWhiteSpace(proveedorId) && proveedorId != ICompraRepository.Ocasionales
            && !await proveedores.ExistsAsync(p => p.ProveedorId == proveedorId, ct))
            return Result<ResultadoPaginadoDto<CompraResponseDto>>.NoEncontrado(
                $"No existe el proveedor {proveedorId}.");

        var (items, total) = await compras.BuscarAsync(proveedorId, desde, hasta, pagina, tamanoPagina, ct);
        return Result<ResultadoPaginadoDto<CompraResponseDto>>.Ok(new ResultadoPaginadoDto<CompraResponseDto>
        {
            Items = items.Select(MapearResumen),
            TotalRegistros = total,
            Pagina = pagina,
            TamanoPagina = tamanoPagina
        });
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
        var proveedor = dto.Ocasional
            ? null
            : await proveedores.FirstOrDefaultAsync(p => p.ProveedorId == dto.ProveedorId, ct);

        if (!dto.Ocasional && proveedor is null)
            return Result<CompraDetalleResponseDto>.Fail(
                $"El proveedor {dto.ProveedorId} no existe.");

        var referencia = string.IsNullOrWhiteSpace(dto.Referencia) ? null : dto.Referencia.Trim();

        // Cómo se nombra el origen en el kárdex de cada repuesto.
        var origen = proveedor?.Nombre
            ?? (referencia is null ? "Compra ocasional" : $"Compra ocasional ({referencia})");
        var cambiosDePrecio = new List<string>();

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
                ProveedorId = dto.Ocasional ? null : dto.ProveedorId,
                Referencia = referencia,
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

                await kardex.RegistrarAsync(
                    repuesto, TipoMovimientoInventario.Compra, linea.Cantidad, usuarioId,
                    compra.CompraId, origen, linea.PrecioUnitario, token);

                // El último precio pagado pasa a ser el costo de referencia del repuesto.
                repuesto.PrecioCompra = linea.PrecioUnitario;

                // El precio de venta lo fija el taller: solo cambia si en la compra
                // se indicó uno distinto (suele decidirse al comprar).
                if (linea.PrecioVenta is { } venta && venta != repuesto.PrecioVenta)
                {
                    cambiosDePrecio.Add($"{repuesto.Nombre}: Bs {repuesto.PrecioVenta:N2} → Bs {venta:N2}");
                    repuesto.PrecioVenta = venta;
                }

                // Si el repuesto todavía no tiene proveedor habitual, la primera
                // compra lo adopta como tal. No se pisa uno ya definido: una compra
                // puntual a otro proveedor no debe cambiar al habitual (eso se
                // hace a mano desde la ficha del repuesto). La ocasional no tiene.
                if (!dto.Ocasional && string.IsNullOrWhiteSpace(repuesto.ProveedorId))
                    repuesto.ProveedorId = dto.ProveedorId;
            }

            await repuestos.SaveChangesAsync(token);

            await auditor.RegistrarAsync(
                usuarioId, AccionAuditoria.Crear, "Compra", compra.CompraId,
                (dto.Ocasional
                    ? $"Registró la compra ocasional {compra.CompraId}" +
                      (referencia is null ? string.Empty : $" (“{referencia}”)")
                    : $"Registró la compra {compra.CompraId}") +
                $" por Bs {compra.Total:N2}." +
                (cambiosDePrecio.Count == 0
                    ? string.Empty
                    : $" Precio de venta: {string.Join("; ", cambiosDePrecio)}."), token);
            await compras.SaveChangesAsync(token);

            return compra.CompraId;
        }, ct);

        var creada = await compras.GetDetalleAsync(compraId, ct);
        return Result<CompraDetalleResponseDto>.Ok(
            MapearDetalle(creada!), "Compra registrada y stock actualizado correctamente.");
    }

    /// <summary>Nombre a mostrar del proveedor; las ocasionales no tienen.</summary>
    public static string NombreDeOrigen(Compra c) => c.Proveedor?.Nombre ?? "Compra ocasional";

    private static CompraResponseDto MapearResumen(Compra c) => new()
    {
        CompraId = c.CompraId,
        ProveedorId = c.ProveedorId,
        NombreProveedor = NombreDeOrigen(c),
        Ocasional = c.EsOcasional,
        Referencia = c.Referencia,
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
        NombreProveedor = NombreDeOrigen(c),
        Ocasional = c.EsOcasional,
        Referencia = c.Referencia,
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
