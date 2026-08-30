using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.Ventas;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Services;

/// <summary>
/// Punto de venta — venta de repuestos en mostrador.
///
/// Se diferencia de la facturación del taller en tres cosas: no nace de una
/// orden de trabajo, se cobra completa en el acto (sin saldo pendiente), y el
/// stock se descuenta al confirmar la venta, no al cerrar nada.
/// </summary>
public class VentaService(
    IVentaRepository ventas,
    IRepuestoRepository repuestos,
    IClienteRepository clientes,
    IAlmacenArchivos archivos,
    IGeneradorId generadorId,
    IUnitOfWork unitOfWork,
    IAuditor auditor) : IVentaService
{
    private const string SubcarpetaFotos = "repuestos";

    public async Task<Result<IEnumerable<VentaResponseDto>>> GetAllAsync(
        string? clienteId, EstadoVenta? estado,
        DateTime? desde, DateTime? hasta, CancellationToken ct = default)
    {
        if (desde.HasValue && hasta.HasValue && desde > hasta)
            return Result<IEnumerable<VentaResponseDto>>.Fail(
                "La fecha inicial no puede ser posterior a la final.");

        var lista = await ventas.BuscarAsync(clienteId, estado, desde, hasta, ct);
        return Result<IEnumerable<VentaResponseDto>>.Ok(lista.Select(Mapear));
    }

    public async Task<Result<VentaResponseDto>> GetByIdAsync(
        string id, CancellationToken ct = default)
    {
        var venta = await ventas.GetByIdCompletaAsync(id, ct);

        return venta is null
            ? Result<VentaResponseDto>.NoEncontrado($"No existe la venta {id}.")
            : Result<VentaResponseDto>.Ok(Mapear(venta));
    }

    public async Task<Result<VentaResponseDto>> CreateAsync(
        VentaRequestDto dto, string usuarioId, CancellationToken ct = default)
    {
        if (!string.IsNullOrWhiteSpace(dto.ClienteId)
            && !await clientes.ExistsAsync(c => c.ClienteId == dto.ClienteId, ct))
            return Result<VentaResponseDto>.Fail($"El cliente {dto.ClienteId} no existe.");

        // Un repuesto repetido en el carrito se consolida: así la validación de
        // stock mira la cantidad total y no cada línea por separado.
        var lineas = dto.Detalles
            .GroupBy(d => d.RepuestoId)
            .Select(g => new
            {
                RepuestoId = g.Key,
                Cantidad = g.Sum(d => d.Cantidad),
                PrecioUnitario = g.Last().PrecioUnitario
            })
            .ToList();

        // Se valida todo antes de tocar nada: una venta se registra completa o no se registra.
        var preparadas = new List<(Repuesto Repuesto, int Cantidad, decimal Precio)>();

        foreach (var linea in lineas)
        {
            var repuesto = await repuestos.FirstOrDefaultAsync(
                r => r.RepuestoId == linea.RepuestoId, ct);

            if (repuesto is null)
                return Result<VentaResponseDto>.Fail($"El repuesto {linea.RepuestoId} no existe.");

            if (repuesto.StockActual < linea.Cantidad)
                return Result<VentaResponseDto>.Conflicto(
                    $"Stock insuficiente de '{repuesto.Nombre}': " +
                    $"disponibles {repuesto.StockActual}, solicitados {linea.Cantidad}.");

            preparadas.Add((repuesto, linea.Cantidad, linea.PrecioUnitario ?? repuesto.PrecioVenta));
        }

        var total = preparadas.Sum(p => p.Cantidad * p.Precio);

        if (total <= 0)
            return Result<VentaResponseDto>.Fail("El total de la venta es cero.");

        var ventaId = await generadorId.SiguienteAsync<Venta>("VTA", ct);

        await unitOfWork.EjecutarEnTransaccionAsync(async token =>
        {
            await ventas.AddAsync(new Venta
            {
                VentaId = ventaId,
                ClienteId = string.IsNullOrWhiteSpace(dto.ClienteId) ? null : dto.ClienteId,
                UsuarioId = usuarioId,
                FechaVenta = DateTime.UtcNow,
                MetodoPago = dto.MetodoPago,
                Total = total,
                Estado = EstadoVenta.Emitida,
                Observaciones = string.IsNullOrWhiteSpace(dto.Observaciones)
                    ? null
                    : dto.Observaciones.Trim()
            }, token);

            await ventas.SaveChangesAsync(token);

            foreach (var (repuesto, cantidad, precio) in preparadas)
            {
                // El detalle se guarda de a uno para que el generador de IDs vea
                // la fila anterior y no repita el código (igual que en órdenes).
                await ventas.AddDetalleAsync(new VentaDetalle
                {
                    VentaDetalleId = await generadorId.SiguienteAsync<VentaDetalle>("VDT", token),
                    VentaId = ventaId,
                    RepuestoId = repuesto.RepuestoId,
                    Cantidad = cantidad,
                    PrecioUnitario = precio
                }, token);

                // Regla del punto de venta: el stock baja al vender, en el acto.
                repuesto.StockActual -= cantidad;

                await ventas.SaveChangesAsync(token);
            }

            await auditor.RegistrarAsync(
                usuarioId, AccionAuditoria.Crear, "Venta", ventaId,
                $"Registró la venta {ventaId} por Bs {total:N2}.", token);
            await ventas.SaveChangesAsync(token);

            return true;
        }, ct);

        var creada = await ventas.GetByIdCompletaAsync(ventaId, ct);
        return Result<VentaResponseDto>.Ok(
            Mapear(creada!), $"Venta {ventaId} registrada por Bs {total:N2}.");
    }

    public async Task<Result<VentaResponseDto>> AnularAsync(
        string id, string usuarioId, CancellationToken ct = default)
    {
        var venta = await ventas.GetByIdCompletaAsync(id, ct);

        if (venta is null)
            return Result<VentaResponseDto>.NoEncontrado($"No existe la venta {id}.");

        if (venta.Estado == EstadoVenta.Anulada)
            return Result<VentaResponseDto>.Fail($"La venta {id} ya está anulada.");

        await unitOfWork.EjecutarEnTransaccionAsync(async token =>
        {
            // Anular devuelve la mercadería al inventario: es el inverso de vender.
            foreach (var detalle in venta.Detalles)
            {
                var repuesto = await repuestos.GetByIdAsync(detalle.RepuestoId, token);
                if (repuesto is not null) repuesto.StockActual += detalle.Cantidad;
            }

            venta.Estado = EstadoVenta.Anulada;

            await auditor.RegistrarAsync(
                usuarioId, AccionAuditoria.Anular, "Venta", id,
                $"Anuló la venta {id} por Bs {venta.Total:N2}.", token);

            await ventas.SaveChangesAsync(token);

            return true;
        }, ct);

        var anulada = await ventas.GetByIdCompletaAsync(id, ct);
        return Result<VentaResponseDto>.Ok(
            Mapear(anulada!), "Venta anulada: el stock volvió al inventario.");
    }

    public async Task<Result<ResumenVentasDto>> GetResumenAsync(
        DateTime? desde, DateTime? hasta, CancellationToken ct = default)
    {
        if (desde.HasValue && hasta.HasValue && desde > hasta)
            return Result<ResumenVentasDto>.Fail(
                "La fecha inicial no puede ser posterior a la final.");

        // Las anuladas no cuentan para la caja.
        var lista = (await ventas.BuscarAsync(null, EstadoVenta.Emitida, desde, hasta, ct)).ToList();

        return Result<ResumenVentasDto>.Ok(new ResumenVentasDto
        {
            CantidadVentas = lista.Count,
            TotalVendido = lista.Sum(v => v.Total),
            ArticulosVendidos = lista.Sum(v => v.Detalles.Sum(d => d.Cantidad))
        });
    }

    private VentaResponseDto Mapear(Venta v) => new()
    {
        VentaId = v.VentaId,
        ClienteId = v.ClienteId,
        NombreCliente = v.Cliente is null
            ? "Cliente de mostrador"
            : (!string.IsNullOrWhiteSpace(v.Cliente.RazonSocial)
                ? v.Cliente.RazonSocial.Trim()
                : $"{v.Cliente.Nombre} {v.Cliente.Apellido}".Trim()),
        UsuarioId = v.UsuarioId,
        NombreUsuario = v.Usuario is null
            ? string.Empty
            : $"{v.Usuario.Nombre} {v.Usuario.Apellido}".Trim(),
        FechaVenta = v.FechaVenta,
        MetodoPago = v.MetodoPago,
        Total = v.Total,
        Estado = v.Estado,
        Observaciones = v.Observaciones,
        Detalles = [.. v.Detalles.Select(d => new VentaLineaResponseDto
        {
            VentaDetalleId = d.VentaDetalleId,
            RepuestoId = d.RepuestoId,
            NombreRepuesto = d.Repuesto?.Nombre ?? d.RepuestoId,
            FotoUrl = d.Repuesto?.NombreArchivoFoto is null
                ? null
                : archivos.RutaPublica(SubcarpetaFotos, d.Repuesto.NombreArchivoFoto),
            Cantidad = d.Cantidad,
            PrecioUnitario = d.PrecioUnitario,
            Subtotal = d.Cantidad * d.PrecioUnitario
        })]
    };
}
