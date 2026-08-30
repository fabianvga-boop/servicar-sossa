using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.Comisiones;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Services;

/// <summary>USU031-USU034 — configuración, consulta y pago de comisiones.</summary>
public class ComisionService(
    IComisionRepository comisiones,
    IComisionConfigRepository configuraciones,
    IUsuarioRepository usuarios,
    IGeneradorId generadorId,
    IUnitOfWork unitOfWork) : IComisionService
{
    private const string RolMecanico = "Mecanico";
    private const string RolAdministrador = "Administrador";

    // ============================================================ CONFIGURACIÓN

    public async Task<Result<IEnumerable<ComisionConfigResponseDto>>> GetConfiguracionesAsync(
        CancellationToken ct = default)
    {
        var lista = await configuraciones.GetTodasConMecanicoAsync(ct);
        return Result<IEnumerable<ComisionConfigResponseDto>>.Ok(lista.Select(MapearConfig));
    }

    public async Task<Result<ComisionConfigResponseDto>> GetConfiguracionAsync(
        string mecanicoId, CancellationToken ct = default)
    {
        var mecanico = await usuarios.GetByIdConRolAsync(mecanicoId, ct);

        if (mecanico is null)
            return Result<ComisionConfigResponseDto>.NoEncontrado(
                $"No existe el usuario {mecanicoId}.");

        var config = await configuraciones.GetPorMecanicoAsync(mecanicoId, ct);

        if (config is null)
            return Result<ComisionConfigResponseDto>.NoEncontrado(
                $"El mecánico {mecanicoId} no tiene porcentaje de comisión configurado.");

        config.Mecanico = mecanico;
        return Result<ComisionConfigResponseDto>.Ok(MapearConfig(config));
    }

    public async Task<Result<ComisionConfigResponseDto>> EstablecerConfiguracionAsync(
        string mecanicoId, ComisionConfigRequestDto dto, CancellationToken ct = default)
    {
        var mecanico = await usuarios.GetByIdConRolAsync(mecanicoId, ct);

        if (mecanico is null)
            return Result<ComisionConfigResponseDto>.Fail($"El usuario {mecanicoId} no existe.");

        // El administrador (dueño) también genera comisión cuando trabaja un vehículo:
        // su porcentaje suele ser 100 (se queda con todo el servicio que ejecuta).
        if (mecanico.Rol.NombreRol is not (RolMecanico or RolAdministrador))
            return Result<ComisionConfigResponseDto>.Fail(
                $"{mecanico.Nombre} {mecanico.Apellido} no puede tener comisión: " +
                "solo mecánicos y el administrador generan comisiones.");

        var config = await configuraciones.GetPorMecanicoAsync(mecanicoId, ct);
        var mensaje = config is null
            ? "Porcentaje de comisión configurado correctamente."
            : "Porcentaje de comisión actualizado correctamente.";

        if (config is null)
        {
            config = new ComisionConfig
            {
                ConfigId = await generadorId.SiguienteAsync<ComisionConfig>("CCF", ct),
                MecanicoId = mecanicoId,
                Porcentaje = dto.Porcentaje,
                FechaActualizacion = DateTime.UtcNow
            };

            await configuraciones.AddAsync(config, ct);
        }
        else
        {
            config.Porcentaje = dto.Porcentaje;
            config.FechaActualizacion = DateTime.UtcNow;
        }

        await configuraciones.SaveChangesAsync(ct);

        config.Mecanico = mecanico;
        return Result<ComisionConfigResponseDto>.Ok(MapearConfig(config), mensaje);
    }

    // ================================================================= CONSULTA

    public async Task<Result<IEnumerable<ComisionResponseDto>>> GetAllAsync(
        string? mecanicoId, string? ordenId, EstadoPago? estadoPago,
        DateTime? desde, DateTime? hasta, CancellationToken ct = default)
    {
        if (desde.HasValue && hasta.HasValue && desde > hasta)
            return Result<IEnumerable<ComisionResponseDto>>.Fail(
                "La fecha inicial no puede ser posterior a la final.");

        if (!string.IsNullOrWhiteSpace(mecanicoId)
            && !await usuarios.ExistsAsync(u => u.UsuarioId == mecanicoId, ct))
            return Result<IEnumerable<ComisionResponseDto>>.NoEncontrado(
                $"No existe el usuario {mecanicoId}.");

        var lista = await comisiones.BuscarAsync(mecanicoId, ordenId, estadoPago, desde, hasta, ct);
        return Result<IEnumerable<ComisionResponseDto>>.Ok(lista.Select(Mapear));
    }

    public async Task<Result<ComisionResponseDto>> GetByIdAsync(
        string id, CancellationToken ct = default)
    {
        var comision = await comisiones.GetByIdCompletaAsync(id, ct);

        return comision is null
            ? Result<ComisionResponseDto>.NoEncontrado($"No existe la comisión {id}.")
            : Result<ComisionResponseDto>.Ok(Mapear(comision));
    }

    public async Task<Result<IEnumerable<ResumenComisionesDto>>> GetResumenAsync(
        DateTime? desde, DateTime? hasta, CancellationToken ct = default)
    {
        if (desde.HasValue && hasta.HasValue && desde > hasta)
            return Result<IEnumerable<ResumenComisionesDto>>.Fail(
                "La fecha inicial no puede ser posterior a la final.");

        var lista = await comisiones.BuscarAsync(null, null, null, desde, hasta, ct);
        var configs = (await configuraciones.GetTodasConMecanicoAsync(ct))
            .ToDictionary(c => c.MecanicoId, c => c.Porcentaje);

        var resumen = lista
            .GroupBy(c => c.MecanicoId)
            .Select(g => new ResumenComisionesDto
            {
                MecanicoId = g.Key,
                NombreMecanico = g.First().Mecanico is null
                    ? string.Empty
                    : $"{g.First().Mecanico.Nombre} {g.First().Mecanico.Apellido}".Trim(),
                PorcentajeConfigurado = configs.TryGetValue(g.Key, out var p) ? p : null,
                CantidadComisiones = g.Count(),
                TotalPendiente = g.Where(c => c.EstadoPago == EstadoPago.Pendiente).Sum(c => c.Monto),
                TotalPagado = g.Where(c => c.EstadoPago == EstadoPago.Pagado).Sum(c => c.Monto)
            })
            .OrderByDescending(r => r.TotalPendiente)
            .ToList();

        return Result<IEnumerable<ResumenComisionesDto>>.Ok(resumen);
    }

    // ===================================================================== PAGO

    public async Task<Result<ComisionResponseDto>> PagarAsync(
        string id, CancellationToken ct = default)
    {
        var comision = await comisiones.FirstOrDefaultAsync(c => c.ComisionId == id, ct);

        if (comision is null)
            return Result<ComisionResponseDto>.NoEncontrado($"No existe la comisión {id}.");

        // El pago es irreversible: revertirlo falsearía el registro contable.
        if (comision.EstadoPago == EstadoPago.Pagado)
            return Result<ComisionResponseDto>.Conflicto(
                $"La comisión {id} ya fue pagada el " +
                $"{comision.FechaPago:dd/MM/yyyy} y no se puede revertir.");

        comision.EstadoPago = EstadoPago.Pagado;
        comision.FechaPago = DateTime.UtcNow;

        await comisiones.SaveChangesAsync(ct);

        var actualizada = await comisiones.GetByIdCompletaAsync(id, ct);
        return Result<ComisionResponseDto>.Ok(
            Mapear(actualizada!), $"Comisión pagada por Bs {comision.Monto:N2}.");
    }

    public async Task<Result<LiquidacionResultadoDto>> PagarLoteAsync(
        PagarComisionesLoteDto dto, CancellationToken ct = default)
    {
        var ids = dto.ComisionIds.Distinct().ToList();
        var encontradas = await comisiones.GetParaPagoAsync(ids, ct);

        var faltantes = ids.Except(encontradas.Select(c => c.ComisionId)).ToList();

        if (faltantes.Count > 0)
            return Result<LiquidacionResultadoDto>.NoEncontrado(
                $"No existen las comisiones: {string.Join(", ", faltantes)}.");

        // Si alguna ya está pagada, abortamos: una planilla se liquida completa o no se liquida.
        var yaPagadas = encontradas
            .Where(c => c.EstadoPago == EstadoPago.Pagado)
            .Select(c => c.ComisionId)
            .ToList();

        if (yaPagadas.Count > 0)
            return Result<LiquidacionResultadoDto>.Conflicto(
                $"Estas comisiones ya fueron pagadas: {string.Join(", ", yaPagadas)}. " +
                "Quítelas del lote e intente de nuevo.");

        var totalBruto = encontradas.Sum(c => c.Monto);
        var adelanto = dto.AdelantoDescontado;

        if (adelanto > 0)
        {
            // El adelanto se resta del pago de un mecánico puntual: mezclar varios
            // en la misma planilla haría ambiguo a quién corresponde el descuento.
            if (encontradas.Select(c => c.MecanicoId).Distinct().Count() > 1)
                return Result<LiquidacionResultadoDto>.Conflicto(
                    "El adelanto solo puede descontarse cuando la planilla es de un único mecánico.");

            if (adelanto > totalBruto)
                return Result<LiquidacionResultadoDto>.Conflicto(
                    $"El adelanto (Bs {adelanto:N2}) supera el total de comisiones " +
                    $"(Bs {totalBruto:N2}). Ajuste el monto e intente de nuevo.");
        }

        await unitOfWork.EjecutarEnTransaccionAsync(async token =>
        {
            var momento = DateTime.UtcNow;

            foreach (var comision in encontradas)
            {
                comision.EstadoPago = EstadoPago.Pagado;
                comision.FechaPago = momento;
            }

            await comisiones.SaveChangesAsync(token);
            return true;
        }, ct);

        var pagadas = await comisiones.GetPorIdsAsync(ids, ct);
        var neto = totalBruto - adelanto;

        var resultado = new LiquidacionResultadoDto
        {
            CantidadComisiones = encontradas.Count,
            TotalBruto = totalBruto,
            AdelantoDescontado = adelanto,
            NetoPagado = neto,
            Comisiones = pagadas.Select(Mapear).ToList()
        };

        var mensaje = adelanto > 0
            ? $"{encontradas.Count} comisión(es) liquidadas: bruto Bs {totalBruto:N2}, " +
              $"adelanto Bs {adelanto:N2}, neto pagado Bs {neto:N2}."
            : $"{encontradas.Count} comisión(es) pagadas por un total de Bs {totalBruto:N2}.";

        return Result<LiquidacionResultadoDto>.Ok(resultado, mensaje);
    }

    // ==================================================================== MAPEO

    private static ComisionConfigResponseDto MapearConfig(ComisionConfig c) => new()
    {
        ConfigId = c.ConfigId,
        MecanicoId = c.MecanicoId,
        NombreMecanico = c.Mecanico is null
            ? string.Empty
            : $"{c.Mecanico.Nombre} {c.Mecanico.Apellido}".Trim(),
        Porcentaje = c.Porcentaje,
        FechaActualizacion = c.FechaActualizacion
    };

    private static ComisionResponseDto Mapear(Comision c) => new()
    {
        ComisionId = c.ComisionId,
        OrdenId = c.OrdenId,
        PlacaVehiculo = c.Orden?.Vehiculo?.Placa ?? string.Empty,
        MecanicoId = c.MecanicoId,
        NombreMecanico = c.Mecanico is null
            ? string.Empty
            : $"{c.Mecanico.Nombre} {c.Mecanico.Apellido}".Trim(),
        Monto = c.Monto,
        FechaCalculo = c.FechaCalculo,
        EstadoPago = c.EstadoPago,
        FechaPago = c.FechaPago,
        // Los servicios de ESE mecánico en la orden son los que componen el monto:
        // la comisión se calcula sobre su suma, no sobre toda la orden.
        Detalle = c.Orden?.Servicios is null
            ? []
            : [.. c.Orden.Servicios
                .Where(s => s.MecanicoId == c.MecanicoId)
                .Select(s => new ComisionDetalleServicioDto
                {
                    OrdenServicioId = s.OrdenServicioId,
                    NombreServicio = s.Servicio?.Nombre ?? s.NombreLibre ?? string.Empty,
                    Descripcion = s.Descripcion,
                    Precio = s.Precio
                })]
    };
}
