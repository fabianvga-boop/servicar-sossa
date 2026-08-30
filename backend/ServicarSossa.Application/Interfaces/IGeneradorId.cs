namespace ServicarSossa.Application.Interfaces;

/// <summary>
/// Genera las PKs alfanuméricas del sistema (CLI-001, USU-001, ...).
/// Los IDs NO son autoincrementales: se calculan aquí y se verifica que no
/// existan antes de insertarlos, según la convención del CLAUDE.md.
/// </summary>
public interface IGeneradorId
{
    /// <summary>
    /// Devuelve el siguiente código disponible para la entidad indicada.
    /// </summary>
    /// <param name="prefijo">Prefijo de 3 letras sin guion, p. ej. "CLI".</param>
    Task<string> SiguienteAsync<T>(string prefijo, CancellationToken ct = default) where T : class;
}
