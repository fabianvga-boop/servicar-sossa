namespace ServicarSossa.Application.DTOs.Comprobantes;

/// <summary>
/// Datos ya resueltos del comprobante (documento "Proforma" del taller, sin
/// valor fiscal SIAT), listos para maquetar. La capa de aplicación arma este
/// objeto desde la orden; el generador solo lo dibuja y no vuelve a consultar
/// la base de datos.
/// </summary>
public class ComprobanteDto
{
    /// <summary>Código del documento: FAC-014.</summary>
    public string Numero { get; set; } = string.Empty;
    public DateTime FechaEmision { get; set; }

    /// <summary>Estado del documento (Emitida, Anulada).</summary>
    public string Estado { get; set; } = string.Empty;

    public string OrdenId { get; set; } = string.Empty;

    // --- Partes ---------------------------------------------------------------

    public string NombreCliente { get; set; } = string.Empty;
    public string CiNit { get; set; } = string.Empty;
    public string? TelefonoCliente { get; set; }

    /// <summary>NIT o razón social que el cliente pidió en el documento, si difiere.</summary>
    public string? NitRazonSocial { get; set; }

    public string Placa { get; set; } = string.Empty;
    public string DescripcionVehiculo { get; set; } = string.Empty;
    public int? Kilometraje { get; set; }

    // --- Detalle --------------------------------------------------------------

    public List<LineaServicioComprobanteDto> Servicios { get; set; } = [];
    public List<LineaRepuestoComprobanteDto> Repuestos { get; set; } = [];

    // --- Totales --------------------------------------------------------------

    public decimal SubtotalServicios { get; set; }
    public decimal SubtotalRepuestos { get; set; }
    public decimal Total { get; set; }

    // --- Cobranza ---------------------------------------------------------------

    public decimal TotalPagado { get; set; }
    public decimal SaldoPendiente { get; set; }
}

public class LineaServicioComprobanteDto
{
    public string Nombre { get; set; } = string.Empty;
    public string? Descripcion { get; set; }
    public string NombreMecanico { get; set; } = string.Empty;
    public decimal Precio { get; set; }
}

public class LineaRepuestoComprobanteDto
{
    public string Nombre { get; set; } = string.Empty;
    public int Cantidad { get; set; }
    public decimal PrecioUnitario { get; set; }
    public decimal Subtotal { get; set; }

    /// <summary>El cliente trajo el repuesto: se lista sin cargo (no suma al total).</summary>
    public bool SinCargo { get; set; }
}

/// <summary>
/// Presupuesto preliminar que sale del diagnóstico: el monto es aproximado y se
/// le entrega al cliente para que decida si aprueba la reparación. No lleva
/// detalle de servicios ni repuestos (todavía no existe la orden).
/// </summary>
public class PresupuestoDiagnosticoDto
{
    public string Numero { get; set; } = string.Empty;   // DIA-000
    public DateTime Fecha { get; set; }

    public string NombreCliente { get; set; } = string.Empty;
    public string CiNit { get; set; } = string.Empty;
    public string? TelefonoCliente { get; set; }

    public string Placa { get; set; } = string.Empty;
    public string DescripcionVehiculo { get; set; } = string.Empty;

    public string NombreMecanico { get; set; } = string.Empty;
    public string DescripcionFalla { get; set; } = string.Empty;
    public string? ObservacionesTecnicas { get; set; }

    public decimal MontoEstimado { get; set; }

    /// <summary>Pendiente / Aprobado / Rechazado, para sellar el estado en el documento.</summary>
    public string RespuestaCliente { get; set; } = string.Empty;
    public DateTime? FechaRespuestaCliente { get; set; }
}

/// <summary>Archivo listo para devolver por HTTP.</summary>
public class ArchivoComprobanteDto
{
    public byte[] Contenido { get; set; } = [];
    public string NombreArchivo { get; set; } = string.Empty;
    public string TipoContenido { get; set; } = "application/pdf";
}
