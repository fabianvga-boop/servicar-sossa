using ServicarSossa.Domain.Entities;

namespace ServicarSossa.Application.Interfaces;

/// <summary>Repositorio de categorías de repuesto.</summary>
public interface ICategoriaRepuestoRepository : IRepository<CategoriaRepuesto>
{
    /// <summary>Todas, por nombre. La lista es corta: no se pagina.</summary>
    Task<List<CategoriaRepuesto>> ListarAsync(CancellationToken ct = default);

    /// <summary>Cuántos repuestos y cuántos servicios usan cada categoría.</summary>
    Task<Dictionary<string, (int Repuestos, int Servicios)>> ContarUsosAsync(CancellationToken ct = default);
}
