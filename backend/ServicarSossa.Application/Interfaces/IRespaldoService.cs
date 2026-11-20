using ServicarSossa.Application.Common;

namespace ServicarSossa.Application.Interfaces;

/// <summary>Archivo de respaldo listo para descargar.</summary>
public record ArchivoRespaldo(byte[] Contenido, string NombreArchivo, int Tablas, int Filas);

/// <summary>Última vez que se descargó un respaldo (null si nunca se hizo).</summary>
public record UltimoRespaldoDto(DateTime? Fecha, string? Usuario);

/// <summary>
/// Respaldo de los datos del taller, pensado para que lo haga el Administrador
/// desde el sistema, sin conocimientos técnicos.
/// </summary>
public interface IRespaldoService
{
    /// <summary>Arma el archivo con los datos de todas las tablas y deja constancia en la auditoría.</summary>
    Task<Result<ArchivoRespaldo>> GenerarAsync(string usuarioId, CancellationToken ct = default);

    /// <summary>Fecha y autor del último respaldo descargado.</summary>
    Task<UltimoRespaldoDto> UltimoAsync(CancellationToken ct = default);
}
