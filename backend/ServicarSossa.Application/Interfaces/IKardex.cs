using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Interfaces;

/// <summary>
/// Deja un movimiento en el kárdex del repuesto. Se llama justo después de
/// cambiarle el stock (el saldo se toma del stock ya actualizado) y se guarda
/// con el mismo <c>SaveChangesAsync</c> del servicio que llama, igual que la
/// auditoría.
/// </summary>
public interface IKardex
{
    /// <param name="cantidad">Positiva si entra al inventario, negativa si sale.</param>
    Task RegistrarAsync(
        Repuesto repuesto, TipoMovimientoInventario tipo, int cantidad, string? usuarioId,
        string? referencia = null, string? detalle = null, decimal? precioUnitario = null,
        CancellationToken ct = default);
}
