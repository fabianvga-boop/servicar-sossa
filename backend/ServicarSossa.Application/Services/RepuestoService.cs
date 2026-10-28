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
    IVehiculoRepository vehiculos,
    IProveedorRepository proveedores,
    ICategoriaRepuestoRepository categorias,
    ICompraRepository compras,
    IAuditoriaRepository auditoria,
    IAlmacenArchivos archivos,
    IGeneradorId generadorId,
    IAuditor auditor,
    IKardex kardex) : IRepuestoService
{
    /// <summary>Etiqueta legible del motivo de un ajuste, para la auditoría.</summary>
    private static string EtiquetaTipoAjuste(TipoAjusteStock tipo) => tipo switch
    {
        TipoAjusteStock.ConteoFisico => "Conteo físico",
        TipoAjusteStock.MermaRotura => "Merma o rotura",
        TipoAjusteStock.Correccion => "Corrección",
        _ => "Otro",
    };

    private const string SubcarpetaFotos = "repuestos";
    public async Task<Result<ResultadoPaginadoDto<RepuestoResponseDto>>> GetAllAsync(
        string? buscar, string? proveedorId, bool soloStockBajo,
        int pagina, int tamanoPagina, CancellationToken ct = default, string? vehiculoId = null,
        string? categoriaId = null)
    {
        Vehiculo? vehiculo = null;
        if (!string.IsNullOrWhiteSpace(vehiculoId))
        {
            vehiculo = await vehiculos.FirstOrDefaultAsync(v => v.VehiculoId == vehiculoId, ct);
            if (vehiculo is null)
                return Result<ResultadoPaginadoDto<RepuestoResponseDto>>.NoEncontrado(
                    $"No existe el vehículo {vehiculoId}.");
        }

        if (!string.IsNullOrWhiteSpace(proveedorId)
            && !await proveedores.ExistsAsync(p => p.ProveedorId == proveedorId, ct))
            return Result<ResultadoPaginadoDto<RepuestoResponseDto>>.NoEncontrado(
                $"No existe el proveedor {proveedorId}.");

        var (items, total) = await repuestos.BuscarAsync(
            buscar, proveedorId, soloStockBajo, pagina, tamanoPagina, ct, vehiculo, categoriaId);

        return Result<ResultadoPaginadoDto<RepuestoResponseDto>>.Ok(
            new ResultadoPaginadoDto<RepuestoResponseDto>
            {
                Items = items.Select(Mapear),
                TotalRegistros = total,
                Pagina = pagina,
                TamanoPagina = tamanoPagina
            });
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

        var error = await ValidarProveedorAsync(dto.ProveedorId, ct)
            ?? await ValidarCategoriaAsync(dto.CategoriaId, ct);
        if (error is not null) return error;

        var (errorCompat, compatibilidades) = NormalizarCompatibilidad(dto.TipoAplicacion, dto.Compatibilidades);
        if (errorCompat is not null) return Result<RepuestoResponseDto>.Fail(errorCompat);
        await UnificarEscrituraAsync(compatibilidades, ct);

        var repuesto = new Repuesto
        {
            RepuestoId = await generadorId.SiguienteAsync<Repuesto>("REP", ct),
            Nombre = nombre,
            Descripcion = string.IsNullOrWhiteSpace(dto.Descripcion) ? null : dto.Descripcion.Trim(),
            StockActual = dto.StockActual,
            StockMinimo = dto.StockMinimo,
            PrecioCompra = dto.PrecioCompra,
            PrecioVenta = dto.PrecioVenta,
            ProveedorId = string.IsNullOrWhiteSpace(dto.ProveedorId) ? null : dto.ProveedorId,
            CategoriaId = string.IsNullOrWhiteSpace(dto.CategoriaId) ? null : dto.CategoriaId,
            TipoAplicacion = dto.TipoAplicacion
        };

        await AgregarCompatibilidadesAsync(repuesto, compatibilidades, ct);
        await repuestos.AddAsync(repuesto, ct);

        // Lo cargado al crear el repuesto entra al kárdex como stock inicial:
        // es mercadería que ya estaba en el taller, sin una compra que la respalde.
        await kardex.RegistrarAsync(
            repuesto, TipoMovimientoInventario.StockInicial, repuesto.StockActual, usuarioId,
            detalle: "Stock inicial al registrar el repuesto (sin compra)", ct: ct);

        await auditor.RegistrarAsync(
            usuarioId, AccionAuditoria.Crear, "Repuesto", repuesto.RepuestoId,
            $"Registró el repuesto '{repuesto.Nombre}' ({Resumen(repuesto)})" +
            (repuesto.StockActual > 0 ? $" con stock inicial {repuesto.StockActual}." : "."), ct);

        await repuestos.SaveChangesAsync(ct);

        var creado = await repuestos.GetByIdConProveedorAsync(repuesto.RepuestoId, ct);
        return Result<RepuestoResponseDto>.Ok(Mapear(creado!), "Repuesto registrado correctamente.");
    }

    public async Task<Result<RepuestoResponseDto>> UpdateAsync(
        string id, RepuestoUpdateDto dto, string usuarioId, CancellationToken ct = default)
    {
        var repuesto = await repuestos.GetParaEditarAsync(id, ct);

        if (repuesto is null)
            return Result<RepuestoResponseDto>.NoEncontrado($"No existe el repuesto {id}.");

        var nombre = dto.Nombre.Trim();

        if (await repuestos.ExistsAsync(
                r => r.Nombre.ToLower() == nombre.ToLower() && r.RepuestoId != id, ct))
            return Result<RepuestoResponseDto>.Conflicto(
                $"Ya existe otro repuesto llamado '{nombre}'.");

        var error = await ValidarProveedorAsync(dto.ProveedorId, ct)
            ?? await ValidarCategoriaAsync(dto.CategoriaId, ct);
        if (error is not null) return error;

        var (errorCompat, compatibilidades) = NormalizarCompatibilidad(dto.TipoAplicacion, dto.Compatibilidades);
        if (errorCompat is not null) return Result<RepuestoResponseDto>.Fail(errorCompat);
        await UnificarEscrituraAsync(compatibilidades, ct);

        repuesto.Nombre = nombre;
        repuesto.Descripcion = string.IsNullOrWhiteSpace(dto.Descripcion) ? null : dto.Descripcion.Trim();
        repuesto.StockMinimo = dto.StockMinimo;
        repuesto.PrecioCompra = dto.PrecioCompra;
        repuesto.PrecioVenta = dto.PrecioVenta;
        repuesto.ProveedorId = string.IsNullOrWhiteSpace(dto.ProveedorId) ? null : dto.ProveedorId;
        repuesto.TipoAplicacion = dto.TipoAplicacion;
        repuesto.CategoriaId = string.IsNullOrWhiteSpace(dto.CategoriaId) ? null : dto.CategoriaId;
        await ReemplazarCompatibilidadesAsync(repuesto, compatibilidades, ct);

        await auditor.RegistrarAsync(
            usuarioId, AccionAuditoria.Editar, "Repuesto", id,
            $"Editó el repuesto '{repuesto.Nombre}' ({Resumen(repuesto)}).", ct);

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

        // Una merma o rotura es pérdida: solo puede bajar el stock. Para subirlo
        // está el conteo físico o la corrección (y, si se compró, la compra).
        if (dto.Tipo == TipoAjusteStock.MermaRotura && dto.StockActual > anterior)
            return Result<RepuestoResponseDto>.Fail(
                "Una merma o rotura solo puede bajar el stock. Para subirlo use \"Conteo físico\" " +
                "o \"Corrección\"; si lo compró, regístrelo como compra.");

        repuesto.StockActual = dto.StockActual;

        // El motivo queda escrito en la bitácora: un aumento/baja de stock no
        // puede ser arbitrario, siempre dice por qué (conteo, merma, corrección…).
        var signo = dto.StockActual > anterior ? "+" : "";
        var motivo = dto.Motivo.Trim();
        await auditor.RegistrarAsync(
            usuarioId, AccionAuditoria.Ajustar, "Repuesto", id,
            $"Ajustó el stock de '{repuesto.Nombre}' de {anterior} a {dto.StockActual} " +
            $"({signo}{dto.StockActual - anterior}) — {EtiquetaTipoAjuste(dto.Tipo)}: {motivo}", ct);

        var diferencia = dto.StockActual - anterior;
        await kardex.RegistrarAsync(
            repuesto, TipoMovimientoInventario.Ajuste, diferencia, usuarioId,
            detalle: $"{EtiquetaTipoAjuste(dto.Tipo)}: {motivo}" +
                     (diferencia > 0 ? " · sin respaldo de compra" : string.Empty),
            ct: ct);

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

        if (foto is not null) await archivos.EliminarAsync(SubcarpetaFotos, foto, ct);

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

        // Cada subida genera un nombre nuevo: el archivo anterior quedaría huérfano.
        if (anterior is not null && anterior != repuesto.NombreArchivoFoto)
            await archivos.EliminarAsync(SubcarpetaFotos, anterior, ct);

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

        await archivos.EliminarAsync(SubcarpetaFotos, archivo, ct);

        var actualizado = await repuestos.GetByIdConProveedorAsync(id, ct);
        return Result<RepuestoResponseDto>.Ok(Mapear(actualizado!), "Foto eliminada correctamente.");
    }

    public async Task<Result<ProcedenciaRepuestoDto>> GetProcedenciaAsync(
        string id, CancellationToken ct = default)
    {
        var repuesto = await repuestos.GetByIdConProveedorAsync(id, ct);

        if (repuesto is null)
            return Result<ProcedenciaRepuestoDto>.NoEncontrado($"No existe el repuesto {id}.");

        var detalles = await compras.HistorialPorRepuestoAsync(id, ct);

        var lineas = detalles.Select(d => new CompraRepuestoLineaDto
        {
            CompraId = d.CompraId,
            Fecha = d.Compra.Fecha,
            ProveedorId = d.Compra.ProveedorId,
            NombreProveedor = d.Compra.Proveedor?.Nombre
                ?? (d.Compra.Referencia is { } referencia
                    ? $"Compra ocasional ({referencia})"
                    : "Compra ocasional"),
            Cantidad = d.Cantidad,
            PrecioUnitario = d.PrecioUnitario
        }).ToList();

        // Ajustes manuales del repuesto: se leen de la bitácora de auditoría.
        var registros = await auditoria.BuscarAsync(
            "Repuesto", id, null, AccionAuditoria.Ajustar, null, null, ct);

        var ajustes = registros.Select(a => new AjusteRepuestoDto
        {
            Fecha = a.Fecha,
            Descripcion = a.Descripcion,
            Usuario = a.Usuario is null
                ? string.Empty
                : $"{a.Usuario.Nombre} {a.Usuario.Apellido}".Trim()
        }).ToList();

        var movimientos = (await repuestos.GetMovimientosAsync(id, ct)).Select(m => new MovimientoKardexDto
        {
            MovimientoId = m.MovimientoId,
            Fecha = m.Fecha,
            Tipo = m.Tipo,
            Cantidad = m.Cantidad,
            Saldo = m.Saldo,
            Referencia = m.Referencia,
            Detalle = m.Detalle,
            PrecioUnitario = m.PrecioUnitario,
            Usuario = m.Usuario is null ? null : $"{m.Usuario.Nombre} {m.Usuario.Apellido}".Trim()
        }).ToList();

        return Result<ProcedenciaRepuestoDto>.Ok(new ProcedenciaRepuestoDto
        {
            RepuestoId = repuesto.RepuestoId,
            StockActual = repuesto.StockActual,
            Movimientos = movimientos,
            // El kárdex está completo si su último saldo es el stock de hoy.
            Cuadra = movimientos.Count == 0
                ? repuesto.StockActual == 0
                : movimientos[^1].Saldo == repuesto.StockActual,
            TotalComprado = lineas.Sum(l => l.Cantidad),
            CantidadCompras = lineas.Count,
            Compras = lineas,
            Ajustes = ajustes
        });
    }

    // --- Compatibilidad por vehículo -----------------------------------------

    /// <summary>Tope de filas por repuesto: más que eso es un error de carga.</summary>
    private const int MaximoCompatibilidades = 30;

    /// <summary>Primer año aceptado en un rango de compatibilidad.</summary>
    private const short AnioMinimo = 1950;

    /// <summary>
    /// Todos los repuestos evaluados contra un vehículo: primero los
    /// compatibles, después los universales y al final los que no están
    /// indicados para él. Alimenta el selector de repuestos de la orden.
    /// </summary>
    public async Task<Result<List<RepuestoParaVehiculoDto>>> GetParaVehiculoAsync(
        string vehiculoId, CancellationToken ct = default)
    {
        var vehiculo = await vehiculos.FirstOrDefaultAsync(v => v.VehiculoId == vehiculoId, ct);
        if (vehiculo is null)
            return Result<List<RepuestoParaVehiculoDto>>.NoEncontrado($"No existe el vehículo {vehiculoId}.");

        // 500 es el tope de una página; un taller tiene bastantes menos repuestos.
        var (items, _) = await repuestos.BuscarAsync(null, null, false, 1, 500, ct);

        var nombreVehiculo = $"{vehiculo.Marca} {vehiculo.Modelo}".Trim();
        var resultado = items
            .Select(r => Clasificar(r, vehiculo, nombreVehiculo))
            .OrderBy(x => x.Nivel)
            .ThenBy(x => x.Repuesto.Nombre)
            .ToList();

        return Result<List<RepuestoParaVehiculoDto>>.Ok(resultado);
    }

    private RepuestoParaVehiculoDto Clasificar(Repuesto r, Vehiculo vehiculo, string nombreVehiculo)
    {
        if (r.TipoAplicacion == TipoAplicacionRepuesto.Universal)
            return new RepuestoParaVehiculoDto
            {
                Repuesto = Mapear(r),
                Nivel = NivelCompatibilidad.Universal,
                Motivo = "Uso general: sirve en cualquier vehículo"
            };

        var coincidencia = r.Compatibilidades.FirstOrDefault(
            c => c.Admite(vehiculo.Marca, vehiculo.Modelo, vehiculo.Anio));

        if (coincidencia is not null)
        {
            var sinAnio = vehiculo.Anio is null && (coincidencia.AnioDesde is not null || coincidencia.AnioHasta is not null)
                ? " (el año del vehículo no está registrado)"
                : string.Empty;
            return new RepuestoParaVehiculoDto
            {
                Repuesto = Mapear(r),
                Nivel = NivelCompatibilidad.Compatible,
                Motivo = $"Compatible: {coincidencia.Descripcion()}{sinAnio}"
            };
        }

        return new RepuestoParaVehiculoDto
        {
            Repuesto = Mapear(r),
            Nivel = NivelCompatibilidad.NoIndicado,
            Motivo = $"No indicado para {nombreVehiculo}: es para {Resumen(r)}"
        };
    }

    /// <summary>
    /// Valida y limpia la compatibilidad recibida. Un Universal no lleva filas;
    /// un Específico necesita al menos una. Quita espacios y repetidos.
    /// </summary>
    private static (string? Error, List<RepuestoCompatibilidad> Filas) NormalizarCompatibilidad(
        TipoAplicacionRepuesto tipo, List<CompatibilidadRepuestoDto>? recibidas)
    {
        if (tipo == TipoAplicacionRepuesto.Universal) return (null, []);

        recibidas ??= [];
        if (recibidas.Count == 0)
            return ("Un repuesto específico necesita al menos un vehículo compatible (marca y, si corresponde, modelo y años).", []);
        if (recibidas.Count > MaximoCompatibilidades)
            return ($"Un repuesto admite como máximo {MaximoCompatibilidades} vehículos compatibles.", []);

        var anioMaximo = (short)(DateTime.UtcNow.Year + 1);
        var filas = new List<RepuestoCompatibilidad>();

        foreach (var c in recibidas)
        {
            var marca = c.Marca?.Trim() ?? string.Empty;
            var modelo = string.IsNullOrWhiteSpace(c.Modelo) ? null : c.Modelo.Trim();

            if (marca.Length == 0)
                return ("Cada vehículo compatible debe indicar la marca.", []);

            var vehiculo = modelo is null ? marca : $"{marca} {modelo}";

            foreach (var anio in new[] { c.AnioDesde, c.AnioHasta })
                if (anio is not null && (anio < AnioMinimo || anio > anioMaximo))
                    return ($"Los años deben estar entre {AnioMinimo} y {anioMaximo} ({vehiculo}).", []);

            if (c.AnioDesde is not null && c.AnioHasta is not null && c.AnioDesde > c.AnioHasta)
                return ($"En {vehiculo}, el año “desde” ({c.AnioDesde}) es mayor que “hasta” ({c.AnioHasta}).", []);

            var fila = new RepuestoCompatibilidad
            {
                Marca = marca,
                Modelo = modelo,
                AnioDesde = c.AnioDesde,
                AnioHasta = c.AnioHasta
            };

            if (!filas.Any(f => MismaFila(f, fila))) filas.Add(fila);
        }

        return (null, filas);
    }

    /// <summary>
    /// Adopta la escritura de las marcas y modelos ya registrados en Vehículos:
    /// " toyota " y "COROLLA" quedan como "Toyota" y "Corolla". Una marca o un
    /// modelo nuevos se guardan tal como se escribieron (sin espacios extra).
    /// </summary>
    private async Task UnificarEscrituraAsync(List<RepuestoCompatibilidad> filas, CancellationToken ct)
    {
        if (filas.Count == 0) return;

        var registrados = (await vehiculos.GetAllAsync(ct)).ToList();

        foreach (var fila in filas)
        {
            var marca = registrados
                .Select(v => v.Marca.Trim())
                .FirstOrDefault(m => m.Equals(fila.Marca, StringComparison.OrdinalIgnoreCase));
            if (marca is not null) fila.Marca = marca;

            if (fila.Modelo is null) continue;
            var modelo = registrados
                .Where(v => v.Marca.Trim().Equals(fila.Marca, StringComparison.OrdinalIgnoreCase))
                .Select(v => v.Modelo.Trim())
                .FirstOrDefault(m => m.Equals(fila.Modelo, StringComparison.OrdinalIgnoreCase));
            if (modelo is not null) fila.Modelo = modelo;
        }
    }

    private async Task AgregarCompatibilidadesAsync(
        Repuesto repuesto, List<RepuestoCompatibilidad> nuevas, CancellationToken ct)
    {
        if (nuevas.Count == 0) return;

        // GeneradorId devuelve el mismo código mientras no se guarde: con
        // varias filas a la vez, se numeran a partir del último existente.
        var numero = await repuestos.UltimoNumeroCompatibilidadAsync(ct);
        foreach (var fila in nuevas)
        {
            fila.CompatibilidadId = $"RCP-{++numero:D3}";
            fila.RepuestoId = repuesto.RepuestoId;
            repuesto.Compatibilidades.Add(fila);
        }
    }

    /// <summary>
    /// Deja la colección igual a <paramref name="deseadas"/>: conserva las filas
    /// que no cambiaron (mantienen su código), borra las que ya no están y
    /// agrega las nuevas.
    /// </summary>
    private async Task ReemplazarCompatibilidadesAsync(
        Repuesto repuesto, List<RepuestoCompatibilidad> deseadas, CancellationToken ct)
    {
        foreach (var actual in repuesto.Compatibilidades.ToList())
            if (!deseadas.Any(d => MismaFila(d, actual)))
                repuesto.Compatibilidades.Remove(actual);

        var nuevas = deseadas
            .Where(d => !repuesto.Compatibilidades.Any(a => MismaFila(a, d)))
            .ToList();

        await AgregarCompatibilidadesAsync(repuesto, nuevas, ct);
    }

    private static bool MismaFila(RepuestoCompatibilidad a, RepuestoCompatibilidad b)
        => string.Equals(a.Marca, b.Marca, StringComparison.OrdinalIgnoreCase)
        && string.Equals(a.Modelo ?? string.Empty, b.Modelo ?? string.Empty, StringComparison.OrdinalIgnoreCase)
        && a.AnioDesde == b.AnioDesde
        && a.AnioHasta == b.AnioHasta;

    /// <summary>"Uso general" o "Toyota Corolla 2015–2020 +1".</summary>
    private static string Resumen(Repuesto r)
    {
        if (r.TipoAplicacion == TipoAplicacionRepuesto.Universal) return "Uso general";

        var filas = r.Compatibilidades
            .OrderBy(c => c.Marca).ThenBy(c => c.Modelo).ThenBy(c => c.AnioDesde)
            .ToList();

        return filas.Count switch
        {
            0 => "Específico (sin vehículos cargados)",
            1 => filas[0].Descripcion(),
            _ => $"{filas[0].Descripcion()} +{filas.Count - 1}"
        };
    }

    private async Task<Result<RepuestoResponseDto>?> ValidarProveedorAsync(
        string? proveedorId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(proveedorId)) return null;

        return await proveedores.ExistsAsync(p => p.ProveedorId == proveedorId, ct)
            ? null
            : Result<RepuestoResponseDto>.Fail($"El proveedor {proveedorId} no existe.");
    }

    private async Task<Result<RepuestoResponseDto>?> ValidarCategoriaAsync(
        string? categoriaId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(categoriaId)) return null;

        return await categorias.ExistsAsync(c => c.CategoriaId == categoriaId, ct)
            ? null
            : Result<RepuestoResponseDto>.Fail(
                $"La categoría {categoriaId} no existe (puede que la hayan borrado). Elija otra.");
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
            : archivos.RutaPublica(SubcarpetaFotos, r.NombreArchivoFoto),
        TipoAplicacion = r.TipoAplicacion,
        CategoriaId = r.CategoriaId,
        NombreCategoria = r.Categoria?.Nombre,
        Compatibilidades = r.Compatibilidades
            .OrderBy(c => c.Marca).ThenBy(c => c.Modelo).ThenBy(c => c.AnioDesde)
            .Select(c => new CompatibilidadRepuestoDto
            {
                CompatibilidadId = c.CompatibilidadId,
                Marca = c.Marca,
                Modelo = c.Modelo,
                AnioDesde = c.AnioDesde,
                AnioHasta = c.AnioHasta,
                Descripcion = c.Descripcion()
            }).ToList(),
        ResumenCompatibilidad = Resumen(r)
    };
}
