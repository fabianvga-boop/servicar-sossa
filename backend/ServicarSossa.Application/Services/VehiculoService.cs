using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.Comunes;
using ServicarSossa.Application.DTOs.Vehiculos;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Catalogos;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Services;

/// <summary>USU009, USU010, USU011 — gestión de vehículos.</summary>
public class VehiculoService(
    IVehiculoRepository vehiculos,
    IClienteRepository clientes,
    IDiagnosticoRepository diagnosticos,
    IOrdenRepository ordenes,
    IRepository<VehiculoFoto> fotos,
    IRepository<VehiculoZonaObservacion> zonas,
    IRepository<PlantillaVehiculo> plantillas,
    IAlmacenArchivos archivos,
    IGeneradorId generadorId,
    IAuditor auditor) : IVehiculoService
{
    private const string SubcarpetaFotos = "vehiculos";
    private const string SubcarpetaPlantillas = "plantillas-vehiculo";
    public async Task<Result<ResultadoPaginadoDto<VehiculoResponseDto>>> GetAllAsync(
        string? buscar, string? clienteId, int pagina, int tamanoPagina, CancellationToken ct = default)
    {
        if (!string.IsNullOrWhiteSpace(clienteId)
            && !await clientes.ExistsAsync(c => c.ClienteId == clienteId, ct))
            return Result<ResultadoPaginadoDto<VehiculoResponseDto>>.NoEncontrado(
                $"No existe el cliente {clienteId}.");

        var (items, total) = await vehiculos.BuscarAsync(buscar, clienteId, pagina, tamanoPagina, ct);
        var mapaPlantillas = await CargarPlantillasAsync(ct);
        return Result<ResultadoPaginadoDto<VehiculoResponseDto>>.Ok(new ResultadoPaginadoDto<VehiculoResponseDto>
        {
            Items = items.Select(v => Mapear(v, mapaPlantillas)),
            TotalRegistros = total,
            Pagina = pagina,
            TamanoPagina = tamanoPagina
        });
    }

    public async Task<Result<VehiculoResponseDto>> GetByIdAsync(
        string id, CancellationToken ct = default)
    {
        var vehiculo = await vehiculos.GetByIdConClienteAsync(id, ct);

        return vehiculo is null
            ? Result<VehiculoResponseDto>.NoEncontrado($"No existe el vehículo {id}.")
            : Result<VehiculoResponseDto>.Ok(Mapear(vehiculo, await CargarPlantillasAsync(ct)));
    }

    public async Task<Result<VehiculoResponseDto>> CreateAsync(
        VehiculoRequestDto dto, string usuarioId, CancellationToken ct = default)
    {
        if (!await clientes.ExistsAsync(c => c.ClienteId == dto.ClienteId, ct))
            return Result<VehiculoResponseDto>.Fail($"El cliente {dto.ClienteId} no existe.");

        var placa = dto.Placa.Trim().ToUpperInvariant();

        if (await vehiculos.ExistsAsync(v => v.Placa == placa, ct))
            return Result<VehiculoResponseDto>.Conflicto(
                $"Ya existe un vehículo registrado con la placa '{placa}'.");

        var vehiculo = new Vehiculo
        {
            VehiculoId = await generadorId.SiguienteAsync<Vehiculo>("VEH", ct),
            ClienteId = dto.ClienteId,
            Placa = placa,
            Marca = dto.Marca.Trim(),
            Modelo = dto.Modelo.Trim(),
            Anio = dto.Anio,
            Color = string.IsNullOrWhiteSpace(dto.Color) ? null : dto.Color.Trim(),
            NumMotor = string.IsNullOrWhiteSpace(dto.NumMotor) ? null : dto.NumMotor.Trim(),
            NumChasis = string.IsNullOrWhiteSpace(dto.NumChasis) ? null : dto.NumChasis.Trim(),
            Kilometraje = dto.Kilometraje ?? 0,
            FechaRegistro = DateTime.UtcNow
        };

        await vehiculos.AddAsync(vehiculo, ct);

        await auditor.RegistrarAsync(
            usuarioId, AccionAuditoria.Crear, "Vehiculo", vehiculo.VehiculoId,
            $"Registró el vehículo '{vehiculo.Placa}'.", ct);

        await vehiculos.SaveChangesAsync(ct);

        var creado = await vehiculos.GetByIdConClienteAsync(vehiculo.VehiculoId, ct);
        return Result<VehiculoResponseDto>.Ok(
            Mapear(creado!, await CargarPlantillasAsync(ct)), "Vehículo registrado correctamente.");
    }

    public async Task<Result<VehiculoResponseDto>> UpdateAsync(
        string id, VehiculoUpdateDto dto, string usuarioId, CancellationToken ct = default)
    {
        var vehiculo = await vehiculos.FirstOrDefaultAsync(v => v.VehiculoId == id, ct);

        if (vehiculo is null)
            return Result<VehiculoResponseDto>.NoEncontrado($"No existe el vehículo {id}.");

        var placa = dto.Placa.Trim().ToUpperInvariant();

        if (await vehiculos.ExistsAsync(v => v.Placa == placa && v.VehiculoId != id, ct))
            return Result<VehiculoResponseDto>.Conflicto(
                $"Ya existe otro vehículo registrado con la placa '{placa}'.");

        vehiculo.Placa = placa;
        vehiculo.Marca = dto.Marca.Trim();
        vehiculo.Modelo = dto.Modelo.Trim();
        vehiculo.Anio = dto.Anio;
        vehiculo.Color = string.IsNullOrWhiteSpace(dto.Color) ? null : dto.Color.Trim();
        vehiculo.NumMotor = string.IsNullOrWhiteSpace(dto.NumMotor) ? null : dto.NumMotor.Trim();
        vehiculo.NumChasis = string.IsNullOrWhiteSpace(dto.NumChasis) ? null : dto.NumChasis.Trim();
        if (dto.Kilometraje.HasValue) vehiculo.Kilometraje = dto.Kilometraje;

        await auditor.RegistrarAsync(
            usuarioId, AccionAuditoria.Editar, "Vehiculo", id,
            $"Editó el vehículo '{vehiculo.Placa}'.", ct);

        await vehiculos.SaveChangesAsync(ct);

        var actualizado = await vehiculos.GetByIdConClienteAsync(id, ct);
        return Result<VehiculoResponseDto>.Ok(
            Mapear(actualizado!, await CargarPlantillasAsync(ct)), "Vehículo actualizado correctamente.");
    }

    /// <summary>
    /// Trazabilidad del vehículo (sugerencia 1): cruza diagnósticos y órdenes
    /// para que un mecánico no tenga que adivinar qué se le hizo antes. Sin
    /// esto, evitar trabajo duplicado depende de la memoria de quien atiende.
    /// </summary>
    public async Task<Result<HistorialVehiculoResponseDto>> GetHistorialAsync(
        string id, CancellationToken ct = default)
    {
        if (!await vehiculos.ExistsAsync(v => v.VehiculoId == id, ct))
            return Result<HistorialVehiculoResponseDto>.NoEncontrado($"No existe el vehículo {id}.");

        var listaDiagnosticos = (await diagnosticos.BuscarAsync(id, null, null, ct)).ToList();
        var listaOrdenes = (await ordenes.BuscarAsync(null, id, null, null, ct)).ToList();

        var eventos = new List<EventoHistorialDto>();

        eventos.AddRange(listaDiagnosticos.Select(d => new EventoHistorialDto
        {
            Tipo = "Diagnostico",
            Id = d.DiagnosticoId,
            Fecha = d.Fecha,
            Estado = d.Estado.ToString(),
            Detalle = d.DescripcionFalla
        }));

        eventos.AddRange(listaOrdenes.Select(o => new EventoHistorialDto
        {
            Tipo = "Orden",
            Id = o.OrdenId,
            Fecha = o.FechaCreacion,
            Estado = o.Estado.ToString(),
            Detalle = $"Bs {Total(o):N2}"
        }));

        var serviciosFrecuentes = listaOrdenes
            .SelectMany(o => o.Servicios)
            .GroupBy(s => s.Servicio?.Nombre ?? s.NombreLibre ?? s.ServicioId ?? string.Empty)
            .Select(g => new ServicioFrecuenteDto { Nombre = g.Key, Cantidad = g.Count() })
            .OrderByDescending(s => s.Cantidad)
            .Take(5)
            .ToList();

        var historial = new HistorialVehiculoResponseDto
        {
            Resumen = new ResumenHistorialDto
            {
                TotalVisitas = listaOrdenes.Count,
                GastoAcumulado = listaOrdenes.Sum(Total),
                UltimaVisita = eventos.Count == 0 ? null : eventos.Max(e => e.Fecha)
            },
            Eventos = [.. eventos.OrderByDescending(e => e.Fecha)],
            ServiciosFrecuentes = serviciosFrecuentes
        };

        return Result<HistorialVehiculoResponseDto>.Ok(historial);
    }

    // --- Fotos (galería opcional) ---------------------------------------------

    public async Task<Result<IEnumerable<VehiculoFotoResponseDto>>> GetFotosAsync(
        string vehiculoId, CancellationToken ct = default)
    {
        if (!await vehiculos.ExistsAsync(v => v.VehiculoId == vehiculoId, ct))
            return Result<IEnumerable<VehiculoFotoResponseDto>>.NoEncontrado(
                $"No existe el vehículo {vehiculoId}.");

        var lista = await fotos.FindAsync(f => f.VehiculoId == vehiculoId, ct);
        return Result<IEnumerable<VehiculoFotoResponseDto>>.Ok(
            lista.OrderByDescending(f => f.FechaSubida).Select(MapearFoto));
    }

    public async Task<Result<VehiculoFotoResponseDto>> SubirFotoAsync(
        string vehiculoId, SubirFotoDto dto, CancellationToken ct = default)
    {
        if (!await vehiculos.ExistsAsync(v => v.VehiculoId == vehiculoId, ct))
            return Result<VehiculoFotoResponseDto>.NoEncontrado($"No existe el vehículo {vehiculoId}.");

        var invalida = ValidadorFotos.Validar(dto);
        if (invalida is not null) return Result<VehiculoFotoResponseDto>.Fail(invalida);

        var fotoId = await generadorId.SiguienteAsync<VehiculoFoto>("FOT", ct);
        var nombreArchivo = await archivos.GuardarAsync(
            SubcarpetaFotos, fotoId, dto.Contenido, ValidadorFotos.Extension(dto), ct);

        var foto = new VehiculoFoto
        {
            FotoId = fotoId,
            VehiculoId = vehiculoId,
            NombreArchivo = nombreArchivo,
            FechaSubida = DateTime.UtcNow
        };

        await fotos.AddAsync(foto, ct);
        await fotos.SaveChangesAsync(ct);

        return Result<VehiculoFotoResponseDto>.Ok(MapearFoto(foto), "Foto subida correctamente.");
    }

    public async Task<Result<bool>> EliminarFotoAsync(
        string vehiculoId, string fotoId, CancellationToken ct = default)
    {
        var foto = await fotos.FirstOrDefaultAsync(
            f => f.FotoId == fotoId && f.VehiculoId == vehiculoId, ct);

        if (foto is null)
            return Result<bool>.NoEncontrado($"La foto {fotoId} no pertenece al vehículo {vehiculoId}.");

        // Primero la fila; si el archivo ya no está en disco, no es motivo para fallar.
        fotos.Remove(foto);
        await fotos.SaveChangesAsync(ct);
        archivos.Eliminar(SubcarpetaFotos, foto.NombreArchivo);

        return Result<bool>.Ok(true, "Foto eliminada correctamente.");
    }

    // --- Zonas (diagrama vectorial) ---------------------------------------------

    public async Task<Result<IEnumerable<VehiculoZonaResponseDto>>> GetZonasAsync(
        string vehiculoId, CancellationToken ct = default)
    {
        if (!await vehiculos.ExistsAsync(v => v.VehiculoId == vehiculoId, ct))
            return Result<IEnumerable<VehiculoZonaResponseDto>>.NoEncontrado(
                $"No existe el vehículo {vehiculoId}.");

        var lista = await zonas.FindAsync(z => z.VehiculoId == vehiculoId, ct);
        return Result<IEnumerable<VehiculoZonaResponseDto>>.Ok(
            lista.OrderByDescending(z => z.FechaRegistro).Select(MapearZona));
    }

    public async Task<Result<VehiculoZonaResponseDto>> RegistrarZonaAsync(
        string vehiculoId, RegistrarZonaDto dto, string usuarioId, CancellationToken ct = default)
    {
        if (!await vehiculos.ExistsAsync(v => v.VehiculoId == vehiculoId, ct))
            return Result<VehiculoZonaResponseDto>.NoEncontrado($"No existe el vehículo {vehiculoId}.");

        var zona = new VehiculoZonaObservacion
        {
            ZonaObsId = await generadorId.SiguienteAsync<VehiculoZonaObservacion>("ZNA", ct),
            VehiculoId = vehiculoId,
            OrdenId = string.IsNullOrWhiteSpace(dto.OrdenId) ? null : dto.OrdenId,
            Zona = dto.Zona.Trim(),
            Estado = dto.Estado,
            Detalle = string.IsNullOrWhiteSpace(dto.Detalle) ? null : dto.Detalle.Trim(),
            FechaRegistro = DateTime.UtcNow
        };

        await zonas.AddAsync(zona, ct);

        await auditor.RegistrarAsync(
            usuarioId, AccionAuditoria.Editar, "Vehiculo", vehiculoId,
            $"Marcó la zona '{zona.Zona}' como {zona.Estado} en el diagrama del vehículo.", ct);

        await zonas.SaveChangesAsync(ct);

        return Result<VehiculoZonaResponseDto>.Ok(MapearZona(zona), "Zona registrada correctamente.");
    }

    private static VehiculoZonaResponseDto MapearZona(VehiculoZonaObservacion z) => new()
    {
        ZonaObsId = z.ZonaObsId,
        VehiculoId = z.VehiculoId,
        OrdenId = z.OrdenId,
        Zona = z.Zona,
        Estado = z.Estado.ToString(),
        Detalle = z.Detalle,
        FechaRegistro = z.FechaRegistro
    };

    private VehiculoFotoResponseDto MapearFoto(VehiculoFoto f) => new()
    {
        FotoId = f.FotoId,
        VehiculoId = f.VehiculoId,
        Url = archivos.RutaPublica(SubcarpetaFotos, f.NombreArchivo),
        FechaSubida = f.FechaSubida
    };

    private static decimal Total(OrdenTrabajo o)
        => o.Servicios.Sum(s => s.Precio) + o.Repuestos.Sum(r => r.Cantidad * r.PrecioUnitario);

    /// <summary>
    /// Biblioteca de plantillas completa (pensada para ser chica: unas pocas
    /// decenas de modelos reales del taller), como diccionario Marca|Modelo en
    /// minúsculas para resolver el SVG específico de cada vehículo sin una
    /// consulta por fila.
    /// </summary>
    private async Task<Dictionary<string, string>> CargarPlantillasAsync(CancellationToken ct)
    {
        var lista = await plantillas.GetAllAsync(ct);
        return lista.ToDictionary(
            p => $"{p.Marca}|{p.Modelo}".ToLowerInvariant(),
            p => archivos.RutaPublica(SubcarpetaPlantillas, p.NombreArchivo));
    }

    private static VehiculoResponseDto Mapear(Vehiculo v, Dictionary<string, string> mapaPlantillas) => new()
    {
        VehiculoId = v.VehiculoId,
        ClienteId = v.ClienteId,
        NombreCliente = v.Cliente is null
            ? string.Empty
            : $"{v.Cliente.Nombre} {v.Cliente.Apellido}".Trim(),
        Placa = v.Placa,
        Marca = v.Marca,
        Modelo = v.Modelo,
        Anio = v.Anio,
        Color = v.Color,
        NumMotor = v.NumMotor,
        NumChasis = v.NumChasis,
        Kilometraje = v.Kilometraje,
        FechaRegistro = v.FechaRegistro,
        TipoCarroceria = CatalogoCarrocerias.Resolver(v.Marca, v.Modelo).ToString(),
        DiagramaSvgUrl = mapaPlantillas.GetValueOrDefault($"{v.Marca}|{v.Modelo}".ToLowerInvariant())
    };
}
