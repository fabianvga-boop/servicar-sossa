using System.Linq.Expressions;

namespace ServicarSossa.Application.Interfaces;

/// <summary>Repositorio genérico. La implementación vive en Infrastructure/Repositories.</summary>
public interface IRepository<T> where T : class
{
    Task<IEnumerable<T>> GetAllAsync(CancellationToken ct = default);
    Task<T?> GetByIdAsync(string id, CancellationToken ct = default);
    Task<IEnumerable<T>> FindAsync(Expression<Func<T, bool>> predicado, CancellationToken ct = default);
    Task<T?> FirstOrDefaultAsync(Expression<Func<T, bool>> predicado, CancellationToken ct = default);
    Task<bool> ExistsAsync(Expression<Func<T, bool>> predicado, CancellationToken ct = default);
    Task AddAsync(T entidad, CancellationToken ct = default);
    void Update(T entidad);
    void Remove(T entidad);
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
