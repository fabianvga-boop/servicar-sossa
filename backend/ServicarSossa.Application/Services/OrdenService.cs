using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.Ordenes;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Services;

/// <summary>
/// USU021-USU025 — órdenes de trabajo. La orden es la raíz de agregado: sus
/// mecánicos, servicios y repuestos se manipulan siempre a través de este servicio,
/// que es quien hace valer las reglas de estado y de stock.
/// </summary>
public class OrdenService(
    IOrdenRepository ordenes,
    IVehiculoRepository vehiculos,
    IUsuarioRepository usuarios,
    ITipoServicioRepository tiposServicio,
    IRepository<Repuesto> repuestos,
    IDiagnosticoRepository diagnosticos,
    IRepository<ComisionConfig> comisionesConfig,
    IRepository<Comision> comisiones,
    IGeneradorId generadorId,
    IUnitOfWork unitOfWork,
    IAuditor auditor) : IOrdenService
{
    /// <summary>
    /// Transiciones permitidas. Cerrada y Cancelada son terminales: una orden
    /// facturada o anulada no puede reabrirse sin falsear el histórico.
    /// </summary>
    private static readonly Dictionary<EstadoOrden, EstadoOrden[]> TransicionesValidas = new()
    {
        [EstadoOrden.Abierta] = [EstadoOrden.EnProceso, EstadoOrden.Cancelada],
        [EstadoOrden.EnProceso] = [EstadoOrden.Finalizada, EstadoOrden.Cancelada],
        [EstadoOrden.Finalizada] = [EstadoOrden.Cerrada, EstadoOrden.Cancelada],
        [EstadoOrden.Cerrada] = [],
        [EstadoOrden.Cancelada] = []
    };

    /// <summary>
    /// Estados en los que la orden todavía admite cambios en mecánicos asignados
    /// y en sus datos generales (fecha estimada, observaciones).
    /// </summary>
    private static bool EsEditable(EstadoOrden estado)
        => estado is EstadoOrden.Abierta or EstadoOrden.EnProceso;

    /// <summary>
    /// Servicios y repuestos solo se cargan una vez que el trabajo arrancó
    /// físicamente (orden En Proceso). Mientras la orden está Abierta el
    /// administrador solo arma el equipo de mecánicos; recién al Iniciar el
    /// trabajo tiene sentido registrar qué se hizo y qué se consumió.
    /// </summary>
    private static bool EsEditableParaTrabajo(EstadoOrden estado)
        => estado is EstadoOrden.EnProceso;

    /// <summary>
    /// Estados en los que aún se puede registrar el avance de un servicio.
    ///
    /// Incluye Finalizada a propósito: marcar un servicio como completado es
    /// registrar trabajo hecho, no alterar el contenido de la orden. Sin esto,
    /// una orden finalizada con un servicio pendiente quedaría atrapada — no se
    /// podría completar el servicio ni cerrar la orden.
    /// </summary>
    private static bool AdmiteAvanceDeServicios(EstadoOrden estado)
        => estado is EstadoOrden.Abierta or EstadoOrden.EnProceso or EstadoOrden.Finalizada;

    // ====================================================================== ORDEN

    public async Task<Result<IEnumerable<OrdenResponseDto>>> GetAllAsync(
        string? clienteId, string? vehiculoId, string? mecanicoId,
        EstadoOrden? estado, CancellationToken ct = default)
    {
        var lista = await ordenes.BuscarAsync(clienteId, vehiculoId, mecanicoId, estado, ct);
        return Result<IEnumerable<OrdenResponseDto>>.Ok(lista.Select(MapearResumen));
    }

    public async Task<Result<OrdenDetalleResponseDto>> GetByIdAsync(
        string id, CancellationToken ct = default)
    {
        var orden = await ordenes.GetDetalleAsync(id, ct);

        return orden is null
            ? Result<OrdenDetalleResponseDto>.NoEncontrado($"No existe la orden {id}.")
            : Result<OrdenDetalleResponseDto>.Ok(MapearDetalle(orden));
    }

    /// <summary>
    /// Toda orden nace de un diagnóstico (regla de negocio): vehículo y
    /// cliente se deducen de él, así ninguna orden queda sin un motivo de
    /// ingreso registrado. Al crearla, el diagnóstico pasa a Revisado.
    /// </summary>
    public async Task<Result<OrdenDetalleResponseDto>> CreateAsync(
        OrdenRequestDto dto, string administradorId, CancellationToken ct = default)
    {
        var diagnostico = await diagnosticos.FirstOrDefaultAsync(
            d => d.DiagnosticoId == dto.DiagnosticoId, ct);

        if (diagnostico is null)
            return Result<OrdenDetalleResponseDto>.Fail(
                $"El diagnóstico {dto.DiagnosticoId} no existe.");

        if (diagnostico.Estado == EstadoDiag.Anulado)
            return Result<OrdenDetalleResponseDto>.Fail(
                "El diagnóstico está anulado: no puede generar una orden de trabajo.");

        // El cliente debe haber aprobado el presupuesto aproximado antes de abrir la orden.
        if (diagnostico.RespuestaCliente != RespuestaCliente.Aprobado)
            return Result<OrdenDetalleResponseDto>.Conflicto(
                diagnostico.RespuestaCliente == RespuestaCliente.Rechazado
                    ? "El cliente rechazó el presupuesto del diagnóstico: no se puede crear la orden."
                    : "El cliente aún no aprobó el presupuesto del diagnóstico. " +
                      "Registre la aprobación antes de crear la orden.");

        // Un diagnóstico genera como máximo una orden: evita duplicar el mismo motivo.
        var yaConvertido = await ordenes.ExistsAsync(
            o => o.DiagnosticoId == dto.DiagnosticoId, ct);

        if (yaConvertido)
            return Result<OrdenDetalleResponseDto>.Conflicto(
                $"El diagnóstico {dto.DiagnosticoId} ya generó una orden de trabajo.");

        var vehiculo = await vehiculos.FirstOrDefaultAsync(
            v => v.VehiculoId == diagnostico.VehiculoId, ct);

        if (vehiculo is null)
            return Result<OrdenDetalleResponseDto>.Fail(
                $"El vehículo {diagnostico.VehiculoId} del diagnóstico ya no existe.");

        // Una orden abierta por vehículo evita duplicar trabajo sobre el mismo auto.
        var abierta = await ordenes.FirstOrDefaultAsync(
            o => o.VehiculoId == vehiculo.VehiculoId &&
                 (o.Estado == EstadoOrden.Abierta || o.Estado == EstadoOrden.EnProceso), ct);

        if (abierta is not null)
            return Result<OrdenDetalleResponseDto>.Conflicto(
                $"El vehículo {vehiculo.Placa} ya tiene la orden {abierta.OrdenId} en curso.");

        var orden = new OrdenTrabajo
        {
            OrdenId = await generadorId.SiguienteAsync<OrdenTrabajo>("ORD", ct),
            VehiculoId = vehiculo.VehiculoId,
            ClienteId = vehiculo.ClienteId,          // se deduce del vehículo
            AdministradorId = administradorId,
            DiagnosticoId = diagnostico.DiagnosticoId,
            FechaCreacion = DateTime.UtcNow,
            FechaEstimada = dto.FechaEstimada,
            Estado = EstadoOrden.Abierta,
            Observaciones = string.IsNullOrWhiteSpace(dto.Observaciones)
                ? null
                : dto.Observaciones.Trim()
        };

        await ordenes.AddAsync(orden, ct);
        await ordenes.SaveChangesAsync(ct);

        // El diagnóstico ya fue atendido: pasa de Registrado a Revisado.
        if (diagnostico.Estado == EstadoDiag.Registrado)
        {
            diagnostico.Estado = EstadoDiag.Revisado;
            diagnostico.FechaModificacion = DateTime.UtcNow;
            await diagnosticos.SaveChangesAsync(ct);
        }

        return await RecargarAsync(orden.OrdenId, "Orden de trabajo creada a partir del diagnóstico.", ct);
    }

    public async Task<Result<OrdenDetalleResponseDto>> UpdateAsync(
        string id, OrdenUpdateDto dto, CancellationToken ct = default)
    {
        var orden = await ordenes.FirstOrDefaultAsync(o => o.OrdenId == id, ct);

        if (orden is null)
            return Result<OrdenDetalleResponseDto>.NoEncontrado($"No existe la orden {id}.");

        if (!EsEditable(orden.Estado))
            return Result<OrdenDetalleResponseDto>.Fail(
                $"No se puede modificar una orden en estado {orden.Estado}.");

        orden.FechaEstimada = dto.FechaEstimada;
        orden.Observaciones = string.IsNullOrWhiteSpace(dto.Observaciones)
            ? null
            : dto.Observaciones.Trim();

        await ordenes.SaveChangesAsync(ct);

        return await RecargarAsync(id, "Orden actualizada correctamente.", ct);
    }

    public async Task<Result<OrdenDetalleResponseDto>> CambiarEstadoAsync(
        string id, CambiarEstadoOrdenDto dto, string usuarioId, CancellationToken ct = default)
    {
        var orden = await ordenes.FirstOrDefaultAsync(o => o.OrdenId == id, ct);

        if (orden is null)
            return Result<OrdenDetalleResponseDto>.NoEncontrado($"No existe la orden {id}.");

        if (orden.Estado == dto.Estado)
            return Result<OrdenDetalleResponseDto>.Fail($"La orden ya está {dto.Estado}.");

        var permitidos = TransicionesValidas[orden.Estado];

        if (!permitidos.Contains(dto.Estado))
            return Result<OrdenDetalleResponseDto>.Fail(
                permitidos.Length == 0
                    ? $"La orden está {orden.Estado}: es un estado final y no admite cambios."
                    : $"No se puede pasar de {orden.Estado} a {dto.Estado}. " +
                      $"Estados válidos: {string.Join(", ", permitidos)}.");

        // Finalizar declara que el trabajo terminó. Permitirlo con servicios a
        // medias dejaría la orden sin salida: el cierre los exige completos y
        // los estados anteriores ya no son alcanzables.
        if (dto.Estado == EstadoOrden.Finalizada)
        {
            var hayPendientes = await ordenes.ExistsAsync(
                o => o.OrdenId == id &&
                     o.Servicios.Any(s => s.Estado != EstadoServicioOrden.Completado), ct);

            if (hayPendientes)
                return Result<OrdenDetalleResponseDto>.Fail(
                    "La orden tiene servicios sin completar. " +
                    "Márquelos como Completado antes de finalizar el trabajo.");
        }

        // El cierre no es un simple cambio de estado: mueve stock y genera comisiones.
        if (dto.Estado == EstadoOrden.Cerrada)
            return await CerrarOrdenAsync(id, usuarioId, ct);

        orden.Estado = dto.Estado;

        await auditor.RegistrarAsync(
            usuarioId,
            dto.Estado == EstadoOrden.Cancelada ? AccionAuditoria.Anular : AccionAuditoria.CambiarEstado,
            "Orden", id, $"Marcó la orden {id} como {dto.Estado}.", ct);

        await ordenes.SaveChangesAsync(ct);

        return await RecargarAsync(id, $"Orden marcada como {dto.Estado}.", ct);
    }

    /// <summary>
    /// Regla de negocio 1 del CLAUDE.md. En una sola transacción:
    /// descuenta el stock de cada repuesto consumido, calcula la comisión de cada
    /// mecánico sobre los servicios que ejecutó, y sella la fecha de cierre.
    /// </summary>
    private async Task<Result<OrdenDetalleResponseDto>> CerrarOrdenAsync(
        string ordenId, string usuarioId, CancellationToken ct)
    {
        var orden = await ordenes.GetParaCierreAsync(ordenId, ct);

        if (orden is null)
            return Result<OrdenDetalleResponseDto>.NoEncontrado($"No existe la orden {ordenId}.");

        // Cerrar con trabajo a medias dejaría comisiones mal calculadas.
        var pendientes = orden.Servicios
            .Where(s => s.Estado != EstadoServicioOrden.Completado)
            .ToList();

        if (pendientes.Count > 0)
            return Result<OrdenDetalleResponseDto>.Fail(
                $"La orden tiene {pendientes.Count} servicio(s) sin completar. " +
                "Complételos antes de cerrar la orden.");

        // Validación previa de stock: si falta, abortamos antes de tocar nada.
        // Solo los repuestos de inventario descuentan stock; el que trae el cliente
        // y la compra externa no salen del almacén del taller.
        var consumosInventario = orden.Repuestos
            .Where(r => r.Origen == OrigenRepuesto.Inventario && r.RepuestoId is not null)
            .ToList();

        foreach (var consumo in consumosInventario)
        {
            var repuesto = await repuestos.GetByIdAsync(consumo.RepuestoId!, ct);

            if (repuesto is null)
                return Result<OrdenDetalleResponseDto>.Fail(
                    $"El repuesto {consumo.RepuestoId} de la orden ya no existe.");

            if (repuesto.StockActual < consumo.Cantidad)
                return Result<OrdenDetalleResponseDto>.Conflicto(
                    $"Stock insuficiente de '{repuesto.Nombre}': " +
                    $"quedan {repuesto.StockActual} y la orden consume {consumo.Cantidad}.");
        }

        var resultado = await unitOfWork.EjecutarEnTransaccionAsync(async token =>
        {
            // 1. Descontar stock de cada repuesto de inventario consumido.
            foreach (var consumo in consumosInventario)
            {
                var repuesto = await repuestos.GetByIdAsync(consumo.RepuestoId!, token);
                repuesto!.StockActual -= consumo.Cantidad;
            }

            // 2. Comisión por mecánico sobre los servicios que ejecutó.
            var porMecanico = orden.Servicios
                .GroupBy(s => s.MecanicoId)
                .Select(g => new { MecanicoId = g.Key, Suma = g.Sum(s => s.Precio) })
                .Where(x => x.Suma > 0);

            foreach (var item in porMecanico)
            {
                var config = await comisionesConfig.FirstOrDefaultAsync(
                    c => c.MecanicoId == item.MecanicoId, token);

                // Sin porcentaje configurado no hay comisión que calcular.
                if (config is null || config.Porcentaje <= 0) continue;

                await comisiones.AddAsync(new Comision
                {
                    ComisionId = await generadorId.SiguienteAsync<Comision>("COM", token),
                    OrdenId = orden.OrdenId,
                    MecanicoId = item.MecanicoId,
                    Monto = Math.Round(item.Suma * config.Porcentaje / 100m, 2),
                    FechaCalculo = DateTime.UtcNow,
                    EstadoPago = EstadoPago.Pendiente
                }, token);

                // Se guarda dentro del bucle para que el generador de IDs vea la
                // comisión recién insertada y no repita el código en la siguiente vuelta.
                await comisiones.SaveChangesAsync(token);
            }

            // 3. Sellar el cierre.
            orden.Estado = EstadoOrden.Cerrada;
            orden.FechaCierre = DateTime.UtcNow;

            await auditor.RegistrarAsync(
                usuarioId, AccionAuditoria.CambiarEstado, "Orden", ordenId,
                $"Cerró la orden {ordenId}: stock descontado y comisiones calculadas.", token);

            await ordenes.SaveChangesAsync(token);

            return true;
        }, ct);

        return resultado
            ? await RecargarAsync(ordenId,
                "Orden cerrada: stock descontado y comisiones calculadas.", ct)
            : Result<OrdenDetalleResponseDto>.Fail("No se pudo cerrar la orden.");
    }

    // ================================================================== MECÁNICOS

    public async Task<Result<OrdenDetalleResponseDto>> AsignarMecanicoAsync(
        string ordenId, AsignarMecanicoDto dto, CancellationToken ct = default)
    {
        var validacion = await ValidarOrdenEditableAsync(ordenId, ct);
        if (validacion is not null) return validacion;

        var mecanico = await usuarios.GetByIdConRolAsync(dto.MecanicoId, ct);

        if (mecanico is null)
            return Result<OrdenDetalleResponseDto>.Fail($"El usuario {dto.MecanicoId} no existe.");

        // El administrador (dueño) también trabaja vehículos cuando el taller se satura,
        // así que ambos roles pueden asignarse como trabajadores de una orden.
        if (mecanico.Rol.NombreRol is not ("Mecanico" or "Administrador"))
            return Result<OrdenDetalleResponseDto>.Fail(
                $"{mecanico.Nombre} {mecanico.Apellido} no puede asignarse a una orden.");

        if (mecanico.Estado == EstadoUsuario.Inactivo)
            return Result<OrdenDetalleResponseDto>.Fail(
                $"{mecanico.Nombre} {mecanico.Apellido} está inactivo.");

        var yaAsignado = await ordenes.GetMecanicoAsignadoAsync(ordenId, dto.MecanicoId, ct);

        if (yaAsignado is not null)
            return Result<OrdenDetalleResponseDto>.Conflicto(
                "El mecánico ya está asignado a esta orden.");

        // Aviso blando: no se bloquea trabajar dos vehículos, pero se advierte.
        var enOtraOrden = await ordenes.ExistsAsync(
            o => o.OrdenId != ordenId
                && (o.Estado == EstadoOrden.Abierta || o.Estado == EstadoOrden.EnProceso)
                && o.Mecanicos.Any(m => m.MecanicoId == dto.MecanicoId), ct);

        ordenes.AgregarMecanico(new OrdenMecanico
        {
            OrdenId = ordenId,
            MecanicoId = dto.MecanicoId,
            FechaAsignacion = DateTime.UtcNow
        });

        await ordenes.SaveChangesAsync(ct);

        var mensaje = enOtraOrden
            ? $"Mecánico asignado. Aviso: {mecanico.Nombre} ya está trabajando en otra orden activa."
            : "Mecánico asignado correctamente.";

        return await RecargarAsync(ordenId, mensaje, ct);
    }

    public async Task<Result<OrdenDetalleResponseDto>> QuitarMecanicoAsync(
        string ordenId, string mecanicoId, CancellationToken ct = default)
    {
        var validacion = await ValidarOrdenEditableAsync(ordenId, ct);
        if (validacion is not null) return validacion;

        var asignacion = await ordenes.GetMecanicoAsignadoAsync(ordenId, mecanicoId, ct);

        if (asignacion is null)
            return Result<OrdenDetalleResponseDto>.NoEncontrado(
                $"El mecánico {mecanicoId} no está asignado a la orden {ordenId}.");

        // Quitarlo dejaría sus servicios huérfanos y falsearía el cálculo de comisiones.
        var tieneServicios = await ordenes.ExistsAsync(
            o => o.OrdenId == ordenId && o.Servicios.Any(s => s.MecanicoId == mecanicoId), ct);

        if (tieneServicios)
            return Result<OrdenDetalleResponseDto>.Conflicto(
                "No se puede desasignar al mecánico: tiene servicios registrados en la orden. " +
                "Quite primero esos servicios.");

        ordenes.QuitarMecanico(asignacion);
        await ordenes.SaveChangesAsync(ct);

        return await RecargarAsync(ordenId, "Mecánico desasignado correctamente.", ct);
    }

    // ================================================================== SERVICIOS

    public async Task<Result<OrdenDetalleResponseDto>> AgregarServicioAsync(
        string ordenId, OrdenServicioRequestDto dto, CancellationToken ct = default)
    {
        var validacion = await ValidarOrdenParaTrabajoAsync(ordenId, ct);
        if (validacion is not null) return validacion;

        // El mecánico debe estar asignado: así la orden refleja quién trabajó en ella.
        var asignado = await ordenes.GetMecanicoAsignadoAsync(ordenId, dto.MecanicoId, ct);

        if (asignado is null)
            return Result<OrdenDetalleResponseDto>.Fail(
                $"El mecánico {dto.MecanicoId} no está asignado a esta orden. " +
                "Asígnelo antes de registrarle servicios.");

        if (!string.IsNullOrWhiteSpace(dto.DiagnosticoId)
            && !await diagnosticos.ExistsAsync(d => d.DiagnosticoId == dto.DiagnosticoId, ct))
            return Result<OrdenDetalleResponseDto>.Fail(
                $"El diagnóstico {dto.DiagnosticoId} no existe.");

        var servicio = new OrdenServicio
        {
            OrdenServicioId = await generadorId.SiguienteAsync<OrdenServicio>("OSR", ct),
            OrdenId = ordenId,
            DiagnosticoId = string.IsNullOrWhiteSpace(dto.DiagnosticoId) ? null : dto.DiagnosticoId,
            MecanicoId = dto.MecanicoId,
            Descripcion = string.IsNullOrWhiteSpace(dto.Descripcion) ? null : dto.Descripcion.Trim(),
            Estado = EstadoServicioOrden.Pendiente
        };

        if (!string.IsNullOrWhiteSpace(dto.ServicioId))
        {
            var tipoServicio = await tiposServicio.FirstOrDefaultAsync(
                s => s.ServicioId == dto.ServicioId, ct);

            if (tipoServicio is null)
                return Result<OrdenDetalleResponseDto>.Fail($"El servicio {dto.ServicioId} no existe.");

            if (tipoServicio.Estado == EstadoServicio.Inactivo)
                return Result<OrdenDetalleResponseDto>.Fail(
                    $"El servicio '{tipoServicio.Nombre}' está dado de baja del catálogo.");

            servicio.ServicioId = tipoServicio.ServicioId;
            // Congela el precio: si el catálogo cambia después, la orden no se altera.
            servicio.Precio = dto.Precio ?? tipoServicio.PrecioBase;
        }
        else
        {
            // Servicio fuera de catálogo: nombre y precio se registran sueltos.
            servicio.NombreLibre = dto.NombreLibre!.Trim();
            servicio.Precio = dto.Precio!.Value;
        }

        await ordenes.AgregarServicioAsync(servicio, ct);
        await ordenes.SaveChangesAsync(ct);

        return await RecargarAsync(ordenId, "Servicio agregado a la orden.", ct);
    }

    public async Task<Result<OrdenDetalleResponseDto>> CambiarEstadoServicioAsync(
        string ordenId, string ordenServicioId,
        CambiarEstadoOrdenServicioDto dto, CancellationToken ct = default)
    {
        var validacion = await ValidarAvanceServiciosAsync(ordenId, ct);
        if (validacion is not null) return validacion;

        var servicio = await ordenes.GetServicioAsync(ordenServicioId, ct);

        if (servicio is null || servicio.OrdenId != ordenId)
            return Result<OrdenDetalleResponseDto>.NoEncontrado(
                $"El servicio {ordenServicioId} no pertenece a la orden {ordenId}.");

        if (servicio.Estado == dto.Estado)
            return Result<OrdenDetalleResponseDto>.Fail($"El servicio ya está {dto.Estado}.");

        servicio.Estado = dto.Estado;
        await ordenes.SaveChangesAsync(ct);

        return await RecargarAsync(ordenId, $"Servicio marcado como {dto.Estado}.", ct);
    }

    public async Task<Result<OrdenDetalleResponseDto>> QuitarServicioAsync(
        string ordenId, string ordenServicioId, CancellationToken ct = default)
    {
        var validacion = await ValidarOrdenParaTrabajoAsync(ordenId, ct);
        if (validacion is not null) return validacion;

        var servicio = await ordenes.GetServicioAsync(ordenServicioId, ct);

        if (servicio is null || servicio.OrdenId != ordenId)
            return Result<OrdenDetalleResponseDto>.NoEncontrado(
                $"El servicio {ordenServicioId} no pertenece a la orden {ordenId}.");

        ordenes.QuitarServicio(servicio);
        await ordenes.SaveChangesAsync(ct);

        return await RecargarAsync(ordenId, "Servicio quitado de la orden.", ct);
    }

    // ================================================================== REPUESTOS

    public async Task<Result<OrdenDetalleResponseDto>> AgregarRepuestoAsync(
        string ordenId, OrdenRepuestoRequestDto dto, CancellationToken ct = default)
    {
        var validacion = await ValidarOrdenParaTrabajoAsync(ordenId, ct);
        if (validacion is not null) return validacion;

        var linea = new OrdenRepuesto
        {
            OrdenRepuestoId = await generadorId.SiguienteAsync<OrdenRepuesto>("ORE", ct),
            OrdenId = ordenId,
            Origen = dto.Origen,
            Cantidad = dto.Cantidad
        };

        if (dto.Origen == OrigenRepuesto.Inventario)
        {
            var repuesto = await repuestos.FirstOrDefaultAsync(r => r.RepuestoId == dto.RepuestoId, ct);

            if (repuesto is null)
                return Result<OrdenDetalleResponseDto>.Fail($"El repuesto {dto.RepuestoId} no existe.");

            // Regla de negocio 3: verificar disponibilidad antes de permitir el registro.
            if (repuesto.StockActual < dto.Cantidad)
                return Result<OrdenDetalleResponseDto>.Conflicto(
                    $"Stock insuficiente de '{repuesto.Nombre}': " +
                    $"disponibles {repuesto.StockActual}, solicitados {dto.Cantidad}.");

            linea.RepuestoId = repuesto.RepuestoId;
            // Congela el precio de venta vigente al momento del consumo.
            linea.PrecioUnitario = dto.PrecioUnitario ?? repuesto.PrecioVenta;
        }
        else
        {
            // Cliente trae / compra externa: no toca inventario y lleva descripción libre.
            linea.Descripcion = dto.Descripcion!.Trim();
            // El que trae el cliente no se cobra; la compra externa va a su costo.
            linea.PrecioUnitario = dto.Origen == OrigenRepuesto.ClienteTrae
                ? 0m
                : dto.PrecioUnitario ?? 0m;
        }

        await ordenes.AgregarRepuestoAsync(linea, ct);
        await ordenes.SaveChangesAsync(ct);

        return await RecargarAsync(ordenId, "Repuesto agregado a la orden.", ct);
    }

    public async Task<Result<OrdenDetalleResponseDto>> QuitarRepuestoAsync(
        string ordenId, string ordenRepuestoId, CancellationToken ct = default)
    {
        var validacion = await ValidarOrdenParaTrabajoAsync(ordenId, ct);
        if (validacion is not null) return validacion;

        var consumo = await ordenes.GetRepuestoAsync(ordenRepuestoId, ct);

        if (consumo is null || consumo.OrdenId != ordenId)
            return Result<OrdenDetalleResponseDto>.NoEncontrado(
                $"El repuesto {ordenRepuestoId} no pertenece a la orden {ordenId}.");

        // El stock aún no se descontó (eso ocurre al cerrar), así que no hay que devolverlo.
        ordenes.QuitarRepuesto(consumo);
        await ordenes.SaveChangesAsync(ct);

        return await RecargarAsync(ordenId, "Repuesto quitado de la orden.", ct);
    }

    // ==================================================================== APOYO

    /// <summary>
    /// Devuelve null si la orden existe y admite cambios; si no, el error a retornar.
    /// </summary>
    private async Task<Result<OrdenDetalleResponseDto>?> ValidarOrdenEditableAsync(
        string ordenId, CancellationToken ct)
    {
        var orden = await ordenes.FirstOrDefaultAsync(o => o.OrdenId == ordenId, ct);

        if (orden is null)
            return Result<OrdenDetalleResponseDto>.NoEncontrado($"No existe la orden {ordenId}.");

        return EsEditable(orden.Estado)
            ? null
            : Result<OrdenDetalleResponseDto>.Fail(
                $"No se puede modificar el detalle de una orden en estado {orden.Estado}.");
    }

    /// <summary>
    /// Devuelve null si la orden existe y está En Proceso (única etapa en que se
    /// admite cargar o quitar servicios y repuestos); si no, el error a retornar.
    /// </summary>
    private async Task<Result<OrdenDetalleResponseDto>?> ValidarOrdenParaTrabajoAsync(
        string ordenId, CancellationToken ct)
    {
        var orden = await ordenes.FirstOrDefaultAsync(o => o.OrdenId == ordenId, ct);

        if (orden is null)
            return Result<OrdenDetalleResponseDto>.NoEncontrado($"No existe la orden {ordenId}.");

        return EsEditableParaTrabajo(orden.Estado)
            ? null
            : Result<OrdenDetalleResponseDto>.Fail(
                orden.Estado == EstadoOrden.Abierta
                    ? "Primero debe iniciar el trabajo (pasar la orden a En Proceso) " +
                      "para poder cargar servicios y repuestos."
                    : $"No se puede modificar el detalle de una orden en estado {orden.Estado}.");
    }

    /// <summary>
    /// Igual que <see cref="ValidarOrdenEditableAsync"/> pero admitiendo también
    /// Finalizada, para poder registrar el avance de servicios ya cargados.
    /// </summary>
    private async Task<Result<OrdenDetalleResponseDto>?> ValidarAvanceServiciosAsync(
        string ordenId, CancellationToken ct)
    {
        var orden = await ordenes.FirstOrDefaultAsync(o => o.OrdenId == ordenId, ct);

        if (orden is null)
            return Result<OrdenDetalleResponseDto>.NoEncontrado($"No existe la orden {ordenId}.");

        return AdmiteAvanceDeServicios(orden.Estado)
            ? null
            : Result<OrdenDetalleResponseDto>.Fail(
                $"La orden está {orden.Estado}: ya no admite cambios en sus servicios.");
    }

    private async Task<Result<OrdenDetalleResponseDto>> RecargarAsync(
        string ordenId, string mensaje, CancellationToken ct)
    {
        var orden = await ordenes.GetDetalleAsync(ordenId, ct);
        return Result<OrdenDetalleResponseDto>.Ok(MapearDetalle(orden!), mensaje);
    }

    private static OrdenResponseDto MapearResumen(OrdenTrabajo o) => Rellenar(new OrdenResponseDto(), o);

    private static OrdenDetalleResponseDto MapearDetalle(OrdenTrabajo o)
    {
        var dto = Rellenar(new OrdenDetalleResponseDto(), o);

        dto.Mecanicos = [.. o.Mecanicos.Select(m => new OrdenMecanicoResponseDto
        {
            MecanicoId = m.MecanicoId,
            NombreMecanico = m.Mecanico is null
                ? string.Empty
                : $"{m.Mecanico.Nombre} {m.Mecanico.Apellido}".Trim(),
            FechaAsignacion = m.FechaAsignacion
        })];

        dto.Servicios = [.. o.Servicios.Select(s => new OrdenServicioResponseDto
        {
            OrdenServicioId = s.OrdenServicioId,
            ServicioId = s.ServicioId,
            // Del catálogo muestra el nombre del catálogo; suelto, su nombre libre.
            NombreServicio = s.Servicio?.Nombre ?? s.NombreLibre ?? string.Empty,
            MecanicoId = s.MecanicoId,
            NombreMecanico = s.Mecanico is null
                ? string.Empty
                : $"{s.Mecanico.Nombre} {s.Mecanico.Apellido}".Trim(),
            DiagnosticoId = s.DiagnosticoId,
            Descripcion = s.Descripcion,
            Precio = s.Precio,
            Estado = s.Estado
        })];

        dto.Repuestos = [.. o.Repuestos.Select(r => new OrdenRepuestoResponseDto
        {
            OrdenRepuestoId = r.OrdenRepuestoId,
            RepuestoId = r.RepuestoId,
            Origen = r.Origen,
            // Inventario muestra el nombre del catálogo; los demás, su descripción libre.
            NombreRepuesto = r.Repuesto?.Nombre ?? r.Descripcion ?? string.Empty,
            Cantidad = r.Cantidad,
            PrecioUnitario = r.PrecioUnitario,
            Subtotal = r.Cantidad * r.PrecioUnitario
        })];

        return dto;
    }

    private static T Rellenar<T>(T dto, OrdenTrabajo o) where T : OrdenResponseDto
    {
        dto.OrdenId = o.OrdenId;
        dto.VehiculoId = o.VehiculoId;
        dto.PlacaVehiculo = o.Vehiculo?.Placa ?? string.Empty;
        dto.DescripcionVehiculo = o.Vehiculo is null
            ? string.Empty
            : $"{o.Vehiculo.Marca} {o.Vehiculo.Modelo}".Trim();
        dto.ClienteId = o.ClienteId;
        dto.NombreCliente = o.Cliente is null
            ? string.Empty
            : $"{o.Cliente.Nombre} {o.Cliente.Apellido}".Trim();
        dto.AdministradorId = o.AdministradorId;
        dto.NombreAdministrador = o.Administrador is null
            ? string.Empty
            : $"{o.Administrador.Nombre} {o.Administrador.Apellido}".Trim();
        dto.DiagnosticoId = o.DiagnosticoId;
        dto.DescripcionFalla = o.Diagnostico?.DescripcionFalla;
        dto.ObservacionesTecnicasDiagnostico = o.Diagnostico?.ObservacionesTecnicas;
        dto.FechaCreacion = o.FechaCreacion;
        dto.FechaEstimada = o.FechaEstimada;
        dto.FechaCierre = o.FechaCierre;
        dto.Estado = o.Estado;
        dto.Observaciones = o.Observaciones;
        dto.TotalServicios = o.Servicios.Sum(s => s.Precio);
        dto.TotalRepuestos = o.Repuestos.Sum(r => r.Cantidad * r.PrecioUnitario);
        dto.CantidadMecanicos = o.Mecanicos.Count;
        return dto;
    }
}
