using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Interfaces;

/// <summary>
/// Repositorio de comisiones. Las comisiones no se crean desde aquí: las genera
/// el cierre de orden (ver OrdenService). Este repositorio es de consulta y pago.
/// </summary>
public interface IComisionRepository : IRepository<Comision>
{
    Task<Comision?> GetByIdCompletaAsync(string comisionId, CancellationToken ct = default);

    Task<IEnumerable<Comision>> BuscarAsync(
        string? mecanicoId, string? ordenId, EstadoPago? estadoPago,
        DateTime? desde, DateTime? hasta, CancellationToken ct = default);

    /// <summary>Carga con seguimiento de cambios, para el pago por lote.</summary>
    Task<List<Comision>> GetParaPagoAsync(
        IEnumerable<string> comisionIds, CancellationToken ct = default);

    /// <summary>Relee un conjunto puntual de comisiones con sus datos asociados.</summary>
    Task<IEnumerable<Comision>> GetPorIdsAsync(
        IEnumerable<string> comisionIds, CancellationToken ct = default);
}

/// <summary>Repositorio de la configuración de porcentajes por mecánico.</summary>
public interface IComisionConfigRepository : IRepository<ComisionConfig>
{
    Task<ComisionConfig?> GetPorMecanicoAsync(string mecanicoId, CancellationToken ct = default);

    Task<IEnumerable<ComisionConfig>> GetTodasConMecanicoAsync(CancellationToken ct = default);
}
