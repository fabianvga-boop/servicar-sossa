using Microsoft.Extensions.Options;
using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.Facturacion;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Infrastructure.Facturacion;

/// <summary>
/// Emisor por defecto, para el taller que todavía no tiene NIT habilitado.
///
/// No emite facturas y no debe fingir que lo hace: una factura sin CUF no es
/// una factura, es un papel. Rechaza la emisión con un mensaje que explica qué
/// usar en su lugar (el módulo de Proformas, que es el cobro real del taller).
///
/// Que exista igual, en vez de dejar el servicio sin implementación, es lo que
/// permite que el módulo de Facturas esté completo y funcional desde ya: el día
/// que haya credenciales se cambia una línea de configuración y el mismo código
/// empieza a emitir de verdad.
/// </summary>
public class EmisorInterno(IOptions<FacturacionOptions> opciones) : IEmisorComprobante
{
    private readonly FacturacionOptions _opciones = opciones.Value;

    public ModoFacturacion Modo => ModoFacturacion.Interno;

    public Task<Result<ResultadoEmisionDto>> EmitirAsync(
        SolicitudEmisionDto solicitud, CancellationToken ct = default)
        => Task.FromResult(Result<ResultadoEmisionDto>.Conflicto(
            "La facturación electrónica no está habilitada: el taller no tiene NIT " +
            "activo ante el SIN. Use el módulo de Proformas para documentar este cobro. " +
            _opciones.LeyendaDocumentoInterno));

    public Task<Result<ResultadoEmisionDto>> AnularAsync(
        SolicitudAnulacionDto solicitud, CancellationToken ct = default)
        => Task.FromResult(Result<ResultadoEmisionDto>.Conflicto(
            "No hay facturación electrónica habilitada: no existen facturas fiscales que anular."));
}
