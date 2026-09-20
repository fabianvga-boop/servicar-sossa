using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.Facturacion;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Interfaces;

/// <summary>
/// Qué se hace con una venta una vez registrada: emitirle un comprobante.
///
/// Existe para que el taller pueda pasar de nota de venta interna a factura
/// electrónica del SIAT cambiando una línea de configuración, sin tocar la
/// lógica de ventas. Los servicios de negocio (<c>FacturaService</c>,
/// <c>VentaService</c>) le pasan una <see cref="SolicitudEmisionDto"/> y no
/// saben —ni les importa— si detrás hay un correlativo interno o un webservice.
///
/// Contrato deliberadamente estrecho: emitir y anular. Todo lo específico del
/// SIAT (CUFD, CUF, XML, firma, contingencia) es asunto interno de la
/// implementación y no se filtra a la capa de negocio.
///
/// Es distinto de <see cref="IGeneradorComprobantes"/>: aquél dibuja el PDF
/// una vez que el comprobante existe; éste decide qué comprobante existe.
/// </summary>
public interface IEmisorComprobante
{
    /// <summary>Modo con el que está operando el sistema, para la UI y la bitácora.</summary>
    ModoFacturacion Modo { get; }

    /// <summary>
    /// Emite el comprobante de una venta ya registrada.
    ///
    /// Se llama DESPUÉS de confirmar la transacción: el cobro es un hecho del
    /// negocio y no puede perderse porque un servicio externo esté caído. Si la
    /// emisión falla, el resultado lo dice y la venta sigue en pie.
    /// </summary>
    Task<Result<ResultadoEmisionDto>> EmitirAsync(
        SolicitudEmisionDto solicitud, CancellationToken ct = default);

    /// <summary>Anula el comprobante emitido para ese documento, si lo hubo.</summary>
    Task<Result<ResultadoEmisionDto>> AnularAsync(
        SolicitudAnulacionDto solicitud, CancellationToken ct = default);
}
