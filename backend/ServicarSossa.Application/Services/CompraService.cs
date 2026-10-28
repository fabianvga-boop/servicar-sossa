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
    ICategoriaRepuestoRepository categorias,
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

        // Un mismo repuesto repetido en dos líneas haría ambiguo el detalle; un
        // repuesto nuevo se reconoce por su nombre.
        var duplicados = dto.Detalles
            .GroupBy(d => d.RepuestoNuevo is { } n ? n.Nombre.Trim().ToLowerInvariant() : d.RepuestoId)
            .Where(g => g.Count() > 1)
            .Select(g => g.First().RepuestoNuevo?.Nombre.Trim() ?? g.First().RepuestoId)
            .ToList();

        if (duplicados.Count > 0)
            return Result<CompraDetalleResponseDto>.Fail(
                $"El repuesto {string.Join(", ", duplicados)} aparece más de una vez. " +
                "Consolide las cantidades en una sola línea.");

        // Validación previa: que todos los repuestos existan (y que los nuevos no
        // existan todavía) antes de tocar nada.
        foreach (var linea in dto.Detalles)
        {
            if (linea.RepuestoNuevo is { } nuevo)
            {
                var nombre = nuevo.Nombre.Trim();
                var existente = await repuestos.FirstOrDefaultAsync(r => r.Nombre.ToLower() == nombre.ToLower(), ct);
                if (existente is not null)
                    return Result<CompraDetalleResponseDto>.Conflicto(
                        $"Ya existe el repuesto '{existente.Nombre}' ({existente.RepuestoId}). Elíjalo de la lista en vez de crearlo.");

                if (!string.IsNullOrWhiteSpace(nuevo.CategoriaId)
                    && !await categorias.ExistsAsync(c => c.CategoriaId == nuevo.CategoriaId, ct))
                    return Result<CompraDetalleResponseDto>.Fail(
                        $"La categoría {nuevo.CategoriaId} no existe (puede que la hayan borrado). Elija otra.");
            }
            else if (!await repuestos.ExistsAsync(r => r.RepuestoId == linea.RepuestoId, ct))
                return Result<CompraDetalleResponseDto>.Fail(
                    $"El repuesto {linea.RepuestoId} no existe.");
        }

        var repuestosNuevos = new List<string>();

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
                // El repuesto nuevo nace acá con stock 0: el stock lo pone la
                // compra, unas líneas más abajo, y queda en su kárdex como tal.
                Repuesto repuesto;
                if (linea.RepuestoNuevo is { } nuevo)
                {
                    repuesto = new Repuesto
                    {
                        RepuestoId = await generadorId.SiguienteAsync<Repuesto>("REP", token),
                        Nombre = nuevo.Nombre.Trim(),
                        StockActual = 0,
                        StockMinimo = 1,
                        PrecioCompra = linea.PrecioUnitario,
                        PrecioVenta = linea.PrecioVenta!.Value,
                        CategoriaId = string.IsNullOrWhiteSpace(nuevo.CategoriaId) ? null : nuevo.CategoriaId,
                        TipoAplicacion = TipoAplicacionRepuesto.Universal
                    };
                    await repuestos.AddAsync(repuesto, token);
                    await repuestos.SaveChangesAsync(token);

                    repuestosNuevos.Add(repuesto.Nombre);
                    await auditor.RegistrarAsync(
                        usuarioId, AccionAuditoria.Crear, "Repuesto", repuesto.RepuestoId,
                        $"Registró el repuesto '{repuesto.Nombre}' (Uso general) desde la compra {compra.CompraId}.",
                        token);
                }
                else
                {
                    repuesto = (await repuestos.GetByIdAsync(linea.RepuestoId!, token))!;
                }

                await compras.AgregarDetalleAsync(new CompraDetalle
                {
                    DetalleId = await generadorId.SiguienteAsync<CompraDetalle>("DET", token),
                    CompraId = compra.CompraId,
                    RepuestoId = repuesto.RepuestoId,
                    Cantidad = linea.Cantidad,
                    PrecioUnitario = linea.PrecioUnitario
                }, token);

                // Se guarda por línea para que el generador de IDs vea el detalle
                // recién insertado y no repita el código en la siguiente vuelta.
                await compras.SaveChangesAsync(token);

                // Regla 2: la compra ingresa mercadería al inventario.
                repuesto.StockActual += linea.Cantidad;

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
                (repuestosNuevos.Count == 0
                    ? string.Empty
                    : $" Repuestos nuevos: {string.Join(", ", repuestosNuevos)}.") +
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
