using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.Comprobantes;
using ServicarSossa.Application.DTOs.Comunes;
using ServicarSossa.Application.DTOs.Diagnosticos;
using ServicarSossa.Application.DTOs.Ordenes;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Services;

/// <summary>USU012, USU014, USU015, USU016 — gestión de diagnósticos.</summary>
public class DiagnosticoService(
    IDiagnosticoRepository diagnosticos,
    IVehiculoRepository vehiculos,
    IOrdenRepository ordenRepo,
    IGeneradorId generadorId,
    IGeneradorComprobantes generadorComprobantes,
    IOrdenService ordenes,
    IAuditor auditor) : IDiagnosticoService
{
    /// <summary>
    /// Una orden cerrada ya movió stock, calculó comisiones y (si corresponde)
    /// se facturó: el diagnóstico que la originó queda sellado como evidencia
    /// histórica y no se puede editar ni anular.
    /// </summary>
    private async Task<bool> TieneOrdenCerradaAsync(string diagnosticoId, CancellationToken ct)
    {
        var orden = await ordenRepo.FirstOrDefaultAsync(o => o.DiagnosticoId == diagnosticoId, ct);
        return orden?.Estado == EstadoOrden.Cerrada;
    }
    public async Task<Result<ResultadoPaginadoDto<DiagnosticoResponseDto>>> GetAllAsync(
        string? vehiculoId, string? mecanicoId, EstadoDiag? estado, string? buscar,
        int pagina, int tamanoPagina, CancellationToken ct = default)
    {
        if (!string.IsNullOrWhiteSpace(vehiculoId)
            && !await vehiculos.ExistsAsync(v => v.VehiculoId == vehiculoId, ct))
            return Result<ResultadoPaginadoDto<DiagnosticoResponseDto>>.NoEncontrado(
                $"No existe el vehículo {vehiculoId}.");

        var (items, total) = await diagnosticos.BuscarPaginadoAsync(
            vehiculoId, mecanicoId, estado, buscar, pagina, tamanoPagina, ct);

        return Result<ResultadoPaginadoDto<DiagnosticoResponseDto>>.Ok(
            new ResultadoPaginadoDto<DiagnosticoResponseDto>
            {
                Items = items.Select(Mapear),
                TotalRegistros = total,
                Pagina = pagina,
                TamanoPagina = tamanoPagina
            });
    }

    public async Task<Result<DiagnosticoResponseDto>> GetByIdAsync(
        string id, CancellationToken ct = default)
    {
        var diagnostico = await diagnosticos.GetByIdCompletoAsync(id, ct);

        return diagnostico is null
            ? Result<DiagnosticoResponseDto>.NoEncontrado($"No existe el diagnóstico {id}.")
            : Result<DiagnosticoResponseDto>.Ok(Mapear(diagnostico));
    }

    public async Task<Result<DiagnosticoResponseDto>> CreateAsync(
        DiagnosticoRequestDto dto, string mecanicoId, CancellationToken ct = default)
    {
        // El presupuesto sale del diagnóstico del mecánico: sin diagnóstico no hay precio.
        if (dto.MontoEstimado is not null && string.IsNullOrWhiteSpace(dto.ObservacionesTecnicas))
            return Result<DiagnosticoResponseDto>.Fail(
                "Escriba el diagnóstico del mecánico antes de poner el presupuesto.");

        if (!await vehiculos.ExistsAsync(v => v.VehiculoId == dto.VehiculoId, ct))
            return Result<DiagnosticoResponseDto>.Fail($"El vehículo {dto.VehiculoId} no existe.");

        // Un vehículo con un diagnóstico sin resolver no necesita otro: evita
        // registrar la misma falla dos veces mientras la primera sigue abierta.
        // Un diagnóstico que el cliente rechazó ya está cerrado (retiró el
        // vehículo), así que no bloquea registrar uno nuevo si vuelve.
        var pendiente = await diagnosticos.FirstOrDefaultAsync(
            d => d.VehiculoId == dto.VehiculoId
                && d.Estado == EstadoDiag.Registrado
                && d.RespuestaCliente != RespuestaCliente.Rechazado, ct);

        if (pendiente is not null)
            return Result<DiagnosticoResponseDto>.Conflicto(
                $"El vehículo ya tiene el diagnóstico {pendiente.DiagnosticoId} sin resolver. " +
                "Espere la respuesta del cliente o anúlelo antes de registrar uno nuevo.");

        var diagnostico = new Diagnostico
        {
            DiagnosticoId = await generadorId.SiguienteAsync<Diagnostico>("DIA", ct),
            VehiculoId = dto.VehiculoId,
            MecanicoId = mecanicoId,
            Fecha = DateTime.UtcNow,
            DescripcionFalla = dto.DescripcionFalla.Trim(),
            ObservacionesTecnicas = string.IsNullOrWhiteSpace(dto.ObservacionesTecnicas)
                ? null
                : dto.ObservacionesTecnicas.Trim(),
            MontoEstimado = dto.MontoEstimado,
            RespuestaCliente = RespuestaCliente.Pendiente,
            Estado = EstadoDiag.Registrado
        };

        await diagnosticos.AddAsync(diagnostico, ct);

        await auditor.RegistrarAsync(
            mecanicoId, AccionAuditoria.Crear, "Diagnostico", diagnostico.DiagnosticoId,
            $"Registró el diagnóstico del vehículo {dto.VehiculoId}: '{diagnostico.DescripcionFalla}'.", ct);

        await diagnosticos.SaveChangesAsync(ct);

        var creado = await diagnosticos.GetByIdCompletoAsync(diagnostico.DiagnosticoId, ct);
        return Result<DiagnosticoResponseDto>.Ok(
            Mapear(creado!), "Diagnóstico registrado correctamente.");
    }

    public async Task<Result<DiagnosticoResponseDto>> UpdateAsync(
        string id, DiagnosticoUpdateDto dto,
        string usuarioId, bool esAdministrador, CancellationToken ct = default)
    {
        var diagnostico = await diagnosticos.FirstOrDefaultAsync(d => d.DiagnosticoId == id, ct);

        if (diagnostico is null)
            return Result<DiagnosticoResponseDto>.NoEncontrado($"No existe el diagnóstico {id}.");

        if (!esAdministrador && diagnostico.MecanicoId != usuarioId)
            return Result<DiagnosticoResponseDto>.NoAutorizado(
                "Solo puede editar los diagnósticos que usted registró.");

        // Un diagnóstico anulado queda como evidencia histórica: no se reescribe.
        if (diagnostico.Estado == EstadoDiag.Anulado)
            return Result<DiagnosticoResponseDto>.Fail(
                "No se puede editar un diagnóstico anulado.");

        // Una vez que el cliente respondió, el presupuesto queda sellado: cualquier
        // ajuste posterior va en la orden de trabajo, no en el diagnóstico.
        if (diagnostico.RespuestaCliente != RespuestaCliente.Pendiente)
            return Result<DiagnosticoResponseDto>.Fail(
                $"El cliente ya respondió el presupuesto ({diagnostico.RespuestaCliente}); " +
                "el diagnóstico no se puede editar.");

        if (await TieneOrdenCerradaAsync(id, ct))
            return Result<DiagnosticoResponseDto>.Fail(
                "No se puede editar: la orden de trabajo generada a partir de este diagnóstico ya está cerrada.");

        // El presupuesto sale del diagnóstico del mecánico: sin diagnóstico no hay precio.
        if (dto.MontoEstimado is not null && string.IsNullOrWhiteSpace(dto.ObservacionesTecnicas))
            return Result<DiagnosticoResponseDto>.Fail(
                "Escriba el diagnóstico del mecánico antes de poner el presupuesto.");

        diagnostico.DescripcionFalla = dto.DescripcionFalla.Trim();
        diagnostico.ObservacionesTecnicas = string.IsNullOrWhiteSpace(dto.ObservacionesTecnicas)
            ? null
            : dto.ObservacionesTecnicas.Trim();
        diagnostico.MontoEstimado = dto.MontoEstimado;
        diagnostico.FechaModificacion = DateTime.UtcNow;      // USU015

        await auditor.RegistrarAsync(
            usuarioId, AccionAuditoria.Editar, "Diagnostico", id,
            $"Editó el diagnóstico '{diagnostico.DiagnosticoId}'.", ct);

        await diagnosticos.SaveChangesAsync(ct);

        var actualizado = await diagnosticos.GetByIdCompletoAsync(id, ct);
        return Result<DiagnosticoResponseDto>.Ok(
            Mapear(actualizado!), "Diagnóstico actualizado correctamente.");
    }

    public async Task<Result<DiagnosticoResponseDto>> CambiarEstadoAsync(
        string id, CambiarEstadoDiagnosticoDto dto,
        string usuarioId, bool esAdministrador, CancellationToken ct = default)
    {
        var diagnostico = await diagnosticos.FirstOrDefaultAsync(d => d.DiagnosticoId == id, ct);

        if (diagnostico is null)
            return Result<DiagnosticoResponseDto>.NoEncontrado($"No existe el diagnóstico {id}.");

        if (!esAdministrador && diagnostico.MecanicoId != usuarioId)
            return Result<DiagnosticoResponseDto>.NoAutorizado(
                "Solo puede modificar los diagnósticos que usted registró.");

        if (diagnostico.Estado == dto.Estado)
            return Result<DiagnosticoResponseDto>.Fail($"El diagnóstico ya está {dto.Estado}.");

        // Anulado es terminal: reabrirlo falsearía el historial del vehículo.
        if (diagnostico.Estado == EstadoDiag.Anulado)
            return Result<DiagnosticoResponseDto>.Fail(
                "Un diagnóstico anulado no puede cambiar de estado.");

        if (dto.Estado == EstadoDiag.Anulado && await TieneOrdenCerradaAsync(id, ct))
            return Result<DiagnosticoResponseDto>.Fail(
                "No se puede anular: la orden de trabajo generada a partir de este diagnóstico ya está cerrada.");

        diagnostico.Estado = dto.Estado;
        diagnostico.FechaModificacion = DateTime.UtcNow;

        await auditor.RegistrarAsync(
            usuarioId, AccionAuditoria.CambiarEstado, "Diagnostico", id,
            $"Marcó el diagnóstico '{id}' como {dto.Estado}.", ct);

        await diagnosticos.SaveChangesAsync(ct);

        var actualizado = await diagnosticos.GetByIdCompletoAsync(id, ct);
        return Result<DiagnosticoResponseDto>.Ok(
            Mapear(actualizado!), $"Diagnóstico marcado como {dto.Estado}.");
    }

    public async Task<Result<DiagnosticoResponseDto>> ResponderAsync(
        string id, ResponderDiagnosticoDto dto,
        string usuarioId, bool esAdministrador, CancellationToken ct = default)
    {
        var diagnostico = await diagnosticos.FirstOrDefaultAsync(d => d.DiagnosticoId == id, ct);

        if (diagnostico is null)
            return Result<DiagnosticoResponseDto>.NoEncontrado($"No existe el diagnóstico {id}.");

        // La decisión del cliente la registra el Administrador (también cuando él mismo diagnosticó).
        if (!esAdministrador)
            return Result<DiagnosticoResponseDto>.Fail(
                "Solo el Administrador registra la respuesta del cliente al presupuesto.");

        if (diagnostico.Estado == EstadoDiag.Anulado)
            return Result<DiagnosticoResponseDto>.Fail(
                "El diagnóstico está anulado: no admite respuesta del cliente.");

        if (dto.Respuesta == RespuestaCliente.Pendiente)
            return Result<DiagnosticoResponseDto>.Fail(
                "La respuesta del cliente debe ser Aprobado o Rechazado.");

        // La respuesta se registra una sola vez: es la decisión del cliente.
        if (diagnostico.RespuestaCliente != RespuestaCliente.Pendiente)
            return Result<DiagnosticoResponseDto>.Conflicto(
                $"El cliente ya respondió este diagnóstico ({diagnostico.RespuestaCliente}).");

        // Sin monto no hay presupuesto que aprobar.
        if (diagnostico.MontoEstimado is null)
            return Result<DiagnosticoResponseDto>.Fail(
                "Cargue el monto estimado antes de registrar la respuesta del cliente.");

        diagnostico.RespuestaCliente = dto.Respuesta;
        diagnostico.FechaRespuestaCliente = DateTime.UtcNow;
        diagnostico.ComentarioCliente = string.IsNullOrWhiteSpace(dto.ComentarioCliente)
            ? null
            : dto.ComentarioCliente.Trim();
        diagnostico.FechaModificacion = DateTime.UtcNow;

        await auditor.RegistrarAsync(
            usuarioId, AccionAuditoria.CambiarEstado, "Diagnostico", id,
            $"Registró la respuesta del cliente al diagnóstico '{id}': {dto.Respuesta}.", ct);

        await diagnosticos.SaveChangesAsync(ct);

        if (dto.Respuesta != RespuestaCliente.Aprobado)
        {
            var actualizadoRechazo = await diagnosticos.GetByIdCompletoAsync(id, ct);
            return Result<DiagnosticoResponseDto>.Ok(
                Mapear(actualizadoRechazo!), "Presupuesto rechazado: el cliente retira el vehículo.");
        }

        // Aprobado: se abre la orden en el acto, sin pedir fecha estimada —
        // rara vez se conoce de antemano, porque suelen surgir imprevistos que
        // retrasan la entrega. Queda editable después si el taller la calcula.
        var ordenCreada = await ordenes.CreateAsync(
            new OrdenRequestDto { DiagnosticoId = id }, usuarioId, ct);

        var actualizado = await diagnosticos.GetByIdCompletoAsync(id, ct);

        var mensaje = ordenCreada.Success
            ? $"Presupuesto aprobado: se creó la orden {ordenCreada.Data!.OrdenId}."
            : $"Presupuesto aprobado, pero la orden no se pudo crear automáticamente: " +
              $"{ordenCreada.Message} Créela manualmente desde el diagnóstico.";

        return Result<DiagnosticoResponseDto>.Ok(Mapear(actualizado!), mensaje);
    }

    public async Task<Result<ArchivoComprobanteDto>> GetPdfAsync(
        string id, CancellationToken ct = default)
    {
        var d = await diagnosticos.GetByIdCompletoAsync(id, ct);

        if (d is null)
            return Result<ArchivoComprobanteDto>.NoEncontrado($"No existe el diagnóstico {id}.");

        if (d.MontoEstimado is null)
            return Result<ArchivoComprobanteDto>.Fail(
                "Cargue el monto estimado antes de generar el presupuesto.");

        var cliente = d.Vehiculo?.Cliente;

        var presupuesto = new PresupuestoDiagnosticoDto
        {
            Numero = d.DiagnosticoId,
            Fecha = d.Fecha,
            NombreCliente = cliente is null
                ? string.Empty
                : (!string.IsNullOrWhiteSpace(cliente.RazonSocial)
                    ? cliente.RazonSocial.Trim()
                    : $"{cliente.Nombre} {cliente.Apellido}".Trim()),
            CiNit = cliente?.CiNit ?? string.Empty,
            TelefonoCliente = cliente?.Telefono,
            Placa = d.Vehiculo?.Placa ?? string.Empty,
            DescripcionVehiculo = d.Vehiculo is null
                ? string.Empty
                : $"{d.Vehiculo.Marca} {d.Vehiculo.Modelo}".Trim(),
            NombreMecanico = d.Mecanico is null
                ? string.Empty
                : $"{d.Mecanico.Nombre} {d.Mecanico.Apellido}".Trim(),
            DescripcionFalla = d.DescripcionFalla,
            ObservacionesTecnicas = d.ObservacionesTecnicas,
            MontoEstimado = d.MontoEstimado.Value,
            RespuestaCliente = d.RespuestaCliente.ToString(),
            FechaRespuestaCliente = d.FechaRespuestaCliente
        };

        return Result<ArchivoComprobanteDto>.Ok(
            generadorComprobantes.GenerarPresupuestoDiagnostico(presupuesto));
    }

    private static DiagnosticoResponseDto Mapear(Diagnostico d) => new()
    {
        DiagnosticoId = d.DiagnosticoId,
        VehiculoId = d.VehiculoId,
        PlacaVehiculo = d.Vehiculo?.Placa ?? string.Empty,
        DescripcionVehiculo = d.Vehiculo is null
            ? string.Empty
            : $"{d.Vehiculo.Marca} {d.Vehiculo.Modelo}".Trim(),
        ClienteId = d.Vehiculo?.ClienteId ?? string.Empty,
        NombreCliente = d.Vehiculo?.Cliente is null
            ? string.Empty
            : $"{d.Vehiculo.Cliente.Nombre} {d.Vehiculo.Cliente.Apellido}".Trim(),
        MecanicoId = d.MecanicoId,
        NombreMecanico = d.Mecanico is null
            ? string.Empty
            : $"{d.Mecanico.Nombre} {d.Mecanico.Apellido}".Trim(),
        Fecha = d.Fecha,
        DescripcionFalla = d.DescripcionFalla,
        ObservacionesTecnicas = d.ObservacionesTecnicas,
        Estado = d.Estado,
        FechaModificacion = d.FechaModificacion,
        MontoEstimado = d.MontoEstimado,
        RespuestaCliente = d.RespuestaCliente,
        FechaRespuestaCliente = d.FechaRespuestaCliente,
        ComentarioCliente = d.ComentarioCliente,
        OrdenId = d.Orden?.OrdenId
    };
}
