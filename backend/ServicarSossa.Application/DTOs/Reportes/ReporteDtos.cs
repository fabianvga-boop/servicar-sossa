using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.DTOs.Reportes;

/// <summary>Tipos de reporte que emite el sistema (USU017-USU020).</summary>
public enum TipoReporte
{
    Ventas,
    Comisiones,
    Inventario,
    Ordenes
}

/// <summary>
/// Envoltorio común de todos los reportes: encabezado, filas y totales.
/// Los exportadores (PDF/Excel/CSV) trabajan sobre esta forma genérica, así que
/// agregar un reporte nuevo no obliga a tocar los exportadores.
/// </summary>
public class ReporteDto
{
    public TipoReporte Tipo { get; set; }
    public string Titulo { get; set; } = string.Empty;
    public DateOnly FechaInicio { get; set; }
    public DateOnly FechaFin { get; set; }
    public DateTime FechaGeneracion { get; set; } = DateTime.UtcNow;
    public string GeneradoPor { get; set; } = string.Empty;

    /// <summary>Nombres de columna, en el orden en que deben mostrarse.</summary>
    public List<string> Columnas { get; set; } = [];

    /// <summary>Filas de datos, alineadas con <see cref="Columnas"/>.</summary>
    public List<List<string>> Filas { get; set; } = [];

    /// <summary>Totales o indicadores del pie del reporte.</summary>
    public Dictionary<string, string> Totales { get; set; } = [];

    public int CantidadFilas => Filas.Count;
}

/// <summary>USU017-USU020 — bitácora de reportes emitidos (tabla reportes_generados).</summary>
public class ReporteGeneradoResponseDto
{
    public string ReporteId { get; set; } = string.Empty;
    public string TipoReporte { get; set; } = string.Empty;
    public DateOnly FechaInicio { get; set; }
    public DateOnly FechaFin { get; set; }
    public string UsuarioId { get; set; } = string.Empty;
    public string NombreUsuario { get; set; } = string.Empty;
    public DateTime FechaGeneracion { get; set; }
    public FormatoReporte Formato { get; set; }
}

/// <summary>Archivo listo para descargar.</summary>
public class ArchivoReporteDto
{
    public byte[] Contenido { get; set; } = [];
    public string NombreArchivo { get; set; } = string.Empty;
    public string TipoContenido { get; set; } = string.Empty;
}
