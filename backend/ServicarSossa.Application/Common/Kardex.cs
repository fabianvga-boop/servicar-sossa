using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Common;

/// <inheritdoc cref="IKardex"/>
public class Kardex(IRepository<MovimientoInventario> repo, IGeneradorId generadorId) : IKardex
{
    private const int LargoDetalle = 200;

    public async Task RegistrarAsync(
        Repuesto repuesto, TipoMovimientoInventario tipo, int cantidad, string? usuarioId,
        string? referencia = null, string? detalle = null, decimal? precioUnitario = null,
        CancellationToken ct = default)
    {
        if (cantidad == 0) return;

        await repo.AddAsync(new MovimientoInventario
        {
            MovimientoId = await generadorId.SiguienteAsync<MovimientoInventario>("MOV", ct),
            RepuestoId = repuesto.RepuestoId,
            Fecha = DateTime.UtcNow,
            Tipo = tipo,
            Cantidad = cantidad,
            Saldo = repuesto.StockActual,
            Referencia = referencia,
            Detalle = detalle is null || detalle.Length <= LargoDetalle
                ? detalle
                : detalle[..(LargoDetalle - 1)] + "…",
            PrecioUnitario = precioUnitario,
            UsuarioId = usuarioId
        }, ct);

        // Sin SaveChangesAsync propio: lo persiste el servicio que llamó.
    }
}
