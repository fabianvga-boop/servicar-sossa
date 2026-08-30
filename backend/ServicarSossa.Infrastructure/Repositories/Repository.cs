using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Infrastructure.Data;

namespace ServicarSossa.Infrastructure.Repositories;

/// <summary>Implementación EF Core del repositorio genérico.</summary>
public class Repository<T>(AppDbContext context) : IRepository<T> where T : class
{
    protected readonly AppDbContext Context = context;
    protected readonly DbSet<T> Set = context.Set<T>();

    public async Task<IEnumerable<T>> GetAllAsync(CancellationToken ct = default)
        => await Set.AsNoTracking().ToListAsync(ct);

    public async Task<T?> GetByIdAsync(string id, CancellationToken ct = default)
        => await Set.FindAsync([id], ct);

    public async Task<IEnumerable<T>> FindAsync(Expression<Func<T, bool>> predicado, CancellationToken ct = default)
        => await Set.AsNoTracking().Where(predicado).ToListAsync(ct);

    public async Task<T?> FirstOrDefaultAsync(Expression<Func<T, bool>> predicado, CancellationToken ct = default)
        => await Set.FirstOrDefaultAsync(predicado, ct);

    public async Task<bool> ExistsAsync(Expression<Func<T, bool>> predicado, CancellationToken ct = default)
        => await Set.AnyAsync(predicado, ct);

    public async Task AddAsync(T entidad, CancellationToken ct = default)
        => await Set.AddAsync(entidad, ct);

    public void Update(T entidad) => Set.Update(entidad);

    public void Remove(T entidad) => Set.Remove(entidad);

    public async Task<int> SaveChangesAsync(CancellationToken ct = default)
        => await Context.SaveChangesAsync(ct);
}
