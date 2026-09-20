using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.Comunes;
using ServicarSossa.Application.DTOs.Facturas;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Interfaces;

/// <summary>
/// Facturación electrónica: emisión y anulación del comprobante FISCAL ante el
/// SIN. Distinto de <see cref="IProformaService"/>, que documenta el cobro del
/// taller sin valor fiscal.
///
/// Con <c>Facturacion:Modo = INTERNAL</c> el módulo existe pero no emite: el
/// taller no tiene NIT habilitado y se cobra con proformas.
/// </summary>
public interface IFacturaService
{
    Task<Result<ResultadoPaginadoDto<FacturaResponseDto>>> GetAllAsync(
        string? ordenId, string? ventaId, EstadoFactura? estado, EstadoSiat? estadoSiat,
        DateTime? desde, DateTime? hasta, int pagina, int tamanoPagina, CancellationToken ct = default);

    Task<Result<FacturaResponseDto>> GetByIdAsync(string id, CancellationToken ct = default);

    /// <summary>Emite la factura fiscal de una orden de trabajo o de una venta.</summary>
    Task<Result<FacturaResponseDto>> EmitirAsync(
        FacturaRequestDto dto, string usuarioId, CancellationToken ct = default);

    /// <summary>Anula la factura ante el SIN.</summary>
    Task<Result<FacturaResponseDto>> AnularAsync(
        string id, string? motivo, string usuarioId, CancellationToken ct = default);

    /// <summary>
    /// XML del comprobante, tal como se generó (o se envió) al SIN. Es el
    /// respaldo que pide el contribuyente para su archivo.
    /// </summary>
    Task<Result<string>> GetXmlAsync(string id, bool firmado, CancellationToken ct = default);

    /// <summary>Modo de facturación activo, para que la interfaz sepa qué mostrar.</summary>
    Result<EstadoFacturacionDto> GetEstadoFacturacion();
}

/// <summary>Situación del módulo de facturación, para la interfaz.</summary>
public class EstadoFacturacionDto
{
    public ModoFacturacion Modo { get; set; }

    /// <summary>false en modo interno: el taller no puede emitir facturas todavía.</summary>
    public bool EmisionHabilitada { get; set; }

    /// <summary>Explicación para mostrarle al usuario cuando no está habilitada.</summary>
    public string? Motivo { get; set; }
}
