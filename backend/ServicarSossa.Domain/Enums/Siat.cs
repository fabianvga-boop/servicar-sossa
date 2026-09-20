namespace ServicarSossa.Domain.Enums;

/// <summary>
/// Ciclo de vida de un comprobante frente al SIAT. Se persiste como string en
/// <c>facturas_siat.estado_siat</c>, igual que el resto de los estados.
///
/// Mientras el taller opere con recibos internos la tabla queda vacía: este
/// estado recién existe cuando hay credenciales fiscales habilitadas.
/// </summary>
public enum EstadoSiat
{
    /// <summary>Armado localmente; todavía no se envió al servicio.</summary>
    Pendiente,

    /// <summary>Enviado, esperando respuesta del webservice.</summary>
    Enviada,

    /// <summary>Recibida y validada por el SIN (hay código de recepción).</summary>
    Validada,

    /// <summary>Rechazada: el motivo queda en <c>mensaje_servicio</c>.</summary>
    Rechazada,

    /// <summary>Emitida offline por caída del servicio; se envía al reconectar.</summary>
    Contingencia,

    /// <summary>Anulada ante el SIN.</summary>
    Anulada
}

/// <summary>
/// Tipo de documento de identidad del comprador. Los valores numéricos SON los
/// códigos que espera el webservice, por eso se declaran explícitos y la
/// columna se guarda como smallint y no como string.
///
/// Verificar contra el catálogo vigente (servicio de sincronización de
/// catálogos del SIAT) antes de emitir en producción: el SIN los actualiza sin
/// previo aviso y el valor correcto manda sobre el de acá.
/// </summary>
public enum TipoDocumentoIdentidad
{
    CI = 1,
    CarnetExtranjeria = 2,
    Pasaporte = 3,
    OtroDocumento = 4,
    Nit = 5
}

/// <summary>
/// Cómo emite comprobantes el sistema hoy. Se resuelve por configuración
/// (<c>Facturacion:Modo</c>) y decide qué implementación de
/// <c>IEmisorComprobante</c> se inyecta.
/// </summary>
public enum ModoFacturacion
{
    /// <summary>Nota de venta / recibo interno, sin valor fiscal. Modo actual.</summary>
    Interno,

    /// <summary>Factura electrónica en línea contra los webservices del SIAT.</summary>
    SiatEnLinea
}

/// <summary>De qué flujo del taller nace el comprobante que se va a emitir.</summary>
public enum OrigenComprobante
{
    /// <summary>Cobro de una orden de trabajo (servicios + repuestos).</summary>
    OrdenTrabajo,

    /// <summary>Venta de repuestos en mostrador (punto de venta).</summary>
    Mostrador
}
