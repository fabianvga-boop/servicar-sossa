using ServicarSossa.Application.DTOs.Comprobantes;

namespace ServicarSossa.Application.Interfaces;

/// <summary>
/// Maqueta un comprobante (factura o proforma) como documento imprimible.
///
/// Es distinto de <see cref="IExportadorReportes"/>: aquél vuelca tablas
/// genéricas de columnas y filas, mientras que aquí el formato es el de un
/// comprobante — encabezado con la identidad del taller, partes involucradas,
/// detalle y totales.
/// </summary>
public interface IGeneradorComprobantes
{
    ArchivoComprobanteDto Generar(ComprobanteDto comprobante);

    /// <summary>
    /// Maqueta el presupuesto preliminar de un diagnóstico (monto aproximado que
    /// se le entrega al cliente para que apruebe o rechace la reparación).
    /// </summary>
    ArchivoComprobanteDto GenerarPresupuestoDiagnostico(PresupuestoDiagnosticoDto presupuesto);
}
