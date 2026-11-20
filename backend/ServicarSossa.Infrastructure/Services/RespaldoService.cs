using System.Text;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using ServicarSossa.Application.Common;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Enums;
using ServicarSossa.Infrastructure.Data;

namespace ServicarSossa.Infrastructure.Services;

/// <summary>
/// Respaldo de datos en un archivo .sql: un bloque <c>COPY … FROM stdin</c> por tabla, en el
/// orden en que se pueden volver a cargar (primero las tablas de las que otras dependen).
/// Usa la misma conexión que la API, así que funciona igual en local y en producción y no
/// necesita herramientas externas. No incluye la estructura de las tablas (está en
/// <c>taller_automotriz_bd.sql</c>) ni las fotos (están en el almacén de archivos).
/// </summary>
public class RespaldoService(AppDbContext db, IAuditor auditor) : IRespaldoService
{
    // Un respaldo a la vez: evita que dos clics seguidos saturen la conexión.
    private static readonly SemaphoreSlim Turno = new(1, 1);

    public async Task<Result<ArchivoRespaldo>> GenerarAsync(string usuarioId, CancellationToken ct = default)
    {
        if (!await Turno.WaitAsync(0, ct))
            return Result<ArchivoRespaldo>.Conflicto("Ya hay un respaldo en curso. Espere unos segundos e intente de nuevo.");

        try
        {
            var conexionTexto = db.Database.GetConnectionString()
                ?? throw new InvalidOperationException("No hay cadena de conexión.");
            await using var cx = new NpgsqlConnection(conexionTexto);
            await cx.OpenAsync(ct);

            var tablas = await OrdenarTablasAsync(cx, ct);
            var ahora = DateTime.UtcNow;
            var salida = new MemoryStream();
            await using (var w = new StreamWriter(salida, new UTF8Encoding(false), 64 * 1024, leaveOpen: true) { NewLine = "\n" })
            {
                await w.WriteLineAsync("-- Respaldo de datos del sistema Servicar SOSSA");
                await w.WriteLineAsync($"-- Generado el {ahora:yyyy-MM-dd HH:mm} UTC");
                await w.WriteLineAsync($"-- Contiene los datos de {tablas.Count} tablas del esquema public.");
                await w.WriteLineAsync("-- No incluye las fotos (están en el almacén de archivos) ni la estructura de las tablas.");
                await w.WriteLineAsync("-- Para restaurar (lo hace un técnico): crear una base vacía con taller_automotriz_bd.sql");
                await w.WriteLineAsync("-- y ejecutar este archivo con:  psql -f <este archivo>");
                await w.WriteLineAsync("SET client_encoding = 'UTF8';");
                await w.WriteLineAsync("BEGIN;");
                // Restaurar REEMPLAZA los datos: se vacían las tablas (incluidos los datos iniciales que trae
                // taller_automotriz_bd.sql) y se cargan las del respaldo, todo en una sola transacción.
                await w.WriteLineAsync("-- ATENCIÓN: al ejecutarlo se borran los datos actuales de estas tablas y se cargan los del respaldo.");
                await w.WriteLineAsync("TRUNCATE TABLE " + string.Join(", ", tablas.Select(t => "public." + Comillas(t))) + ";");

                var filas = 0;
                foreach (var tabla in tablas)
                {
                    var columnas = await ColumnasAsync(cx, tabla, ct);
                    if (columnas.Count == 0) continue;
                    var lista = string.Join(", ", columnas.Select(Comillas));
                    await w.WriteLineAsync();
                    await w.WriteLineAsync($"COPY public.{Comillas(tabla)} ({lista}) FROM stdin;");
                    using var lector = await cx.BeginTextExportAsync($"COPY public.{Comillas(tabla)} ({lista}) TO STDOUT", ct);
                    string? linea;
                    while ((linea = await lector.ReadLineAsync(ct)) is not null)
                    {
                        await w.WriteLineAsync(linea);
                        filas++;
                    }
                    await w.WriteLineAsync("\\.");
                }
                await w.WriteLineAsync();
                await w.WriteLineAsync("COMMIT;");
                await w.FlushAsync(ct);

                var nombre = $"respaldo_servicar_{DateTime.Now:yyyyMMdd_HHmm}.sql";
                await auditor.RegistrarAsync(
                    usuarioId, AccionAuditoria.Crear, "Respaldo", usuarioId,
                    $"Descargó un respaldo de los datos ({tablas.Count} tablas, {filas} filas).", ct);
                await db.SaveChangesAsync(ct);

                return Result<ArchivoRespaldo>.Ok(new ArchivoRespaldo(salida.ToArray(), nombre, tablas.Count, filas));
            }
        }
        finally
        {
            Turno.Release();
        }
    }

    public async Task<UltimoRespaldoDto> UltimoAsync(CancellationToken ct = default)
    {
        var ultimo = await db.Auditorias.AsNoTracking()
            .Where(a => a.Entidad == "Respaldo")
            .OrderByDescending(a => a.Fecha)
            .Select(a => new { a.Fecha, Autor = a.Usuario.Nombre + " " + a.Usuario.Apellido })
            .FirstOrDefaultAsync(ct);
        return ultimo is null ? new UltimoRespaldoDto(null, null) : new UltimoRespaldoDto(ultimo.Fecha, ultimo.Autor);
    }

    private static string Comillas(string nombre) => "\"" + nombre.Replace("\"", "\"\"") + "\"";

    private static async Task<List<string>> ColumnasAsync(NpgsqlConnection cx, string tabla, CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand(
            "SELECT column_name FROM information_schema.columns " +
            "WHERE table_schema = 'public' AND table_name = @t AND is_generated = 'NEVER' ORDER BY ordinal_position", cx);
        cmd.Parameters.AddWithValue("t", tabla);
        var r = new List<string>();
        await using var lector = await cmd.ExecuteReaderAsync(ct);
        while (await lector.ReadAsync(ct)) r.Add(lector.GetString(0));
        return r;
    }

    /// <summary>Tablas del esquema public, con las referenciadas por otras primero.</summary>
    private static async Task<List<string>> OrdenarTablasAsync(NpgsqlConnection cx, CancellationToken ct)
    {
        var todas = new List<string>();
        await using (var cmd = new NpgsqlCommand(
            "SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace " +
            "WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY c.relname", cx))
        await using (var l = await cmd.ExecuteReaderAsync(ct))
            while (await l.ReadAsync(ct)) todas.Add(l.GetString(0));

        // tabla -> tablas de las que depende (llaves foráneas), sin contar las que apuntan a sí mismas
        var depende = todas.ToDictionary(t => t, _ => new HashSet<string>());
        await using (var cmd = new NpgsqlCommand(
            "SELECT hija.relname, padre.relname FROM pg_constraint k " +
            "JOIN pg_class hija ON hija.oid = k.conrelid JOIN pg_class padre ON padre.oid = k.confrelid " +
            "JOIN pg_namespace n ON n.oid = hija.relnamespace WHERE k.contype = 'f' AND n.nspname = 'public'", cx))
        await using (var l = await cmd.ExecuteReaderAsync(ct))
            while (await l.ReadAsync(ct))
            {
                var hija = l.GetString(0); var padre = l.GetString(1);
                if (hija != padre && depende.ContainsKey(hija) && depende.ContainsKey(padre)) depende[hija].Add(padre);
            }

        var orden = new List<string>();
        var pendientes = new List<string>(todas);
        while (pendientes.Count > 0)
        {
            var listas = pendientes.Where(t => depende[t].All(orden.Contains)).ToList();
            if (listas.Count == 0) listas = [pendientes[0]]; // ciclo: se rompe por el primero
            orden.AddRange(listas);
            pendientes.RemoveAll(listas.Contains);
        }
        return orden;
    }
}
