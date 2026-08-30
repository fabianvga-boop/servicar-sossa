using ServicarSossa.Application.Interfaces;

namespace ServicarSossa.Infrastructure.Data;

/// <inheritdoc cref="IUnitOfWork"/>
public class UnitOfWork(AppDbContext context) : IUnitOfWork
{
    public async Task<T> EjecutarEnTransaccionAsync<T>(
        Func<CancellationToken, Task<T>> operacion, CancellationToken ct = default)
    {
        // Si ya hay una transacción abierta (llamada anidada), reusamos la actual
        // en vez de abrir otra: PostgreSQL no soporta transacciones anidadas reales.
        if (context.Database.CurrentTransaction is not null)
            return await operacion(ct);

        await using var transaccion = await context.Database.BeginTransactionAsync(ct);

        try
        {
            var resultado = await operacion(ct);
            await transaccion.CommitAsync(ct);
            return resultado;
        }
        catch
        {
            await transaccion.RollbackAsync(ct);
            throw;
        }
    }
}
