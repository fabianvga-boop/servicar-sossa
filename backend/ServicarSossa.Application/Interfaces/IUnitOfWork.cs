namespace ServicarSossa.Application.Interfaces;

/// <summary>
/// Agrupa varias escrituras en una transacción atómica.
/// Lo necesita el cierre de orden, que descuenta stock, genera comisiones y
/// actualiza la orden: si algo falla a mitad, nada debe quedar aplicado.
/// </summary>
public interface IUnitOfWork
{
    Task<T> EjecutarEnTransaccionAsync<T>(
        Func<CancellationToken, Task<T>> operacion, CancellationToken ct = default);
}
