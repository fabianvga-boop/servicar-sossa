using ServicarSossa.Application.DTOs.Comprobantes;
using ServicarSossa.Application.DTOs.Facturacion;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Common;

/// <summary>
/// Vuelca la parte del comprobante (documento "Proforma") que sale de la
/// orden: cliente, vehículo, líneas de servicios y repuestos, y sus subtotales.
///
/// También arma la <see cref="SolicitudEmisionDto"/> que reciben los emisores:
/// es el mismo contenido, visto como "qué se cobró" en vez de "cómo se imprime".
/// </summary>
internal static class ArmadorComprobantes
{
    public static ComprobanteDto DesdeOrden(OrdenTrabajo orden)
    {
        var cliente = orden.Cliente;
        var vehiculo = orden.Vehiculo;

        var servicios = orden.Servicios.Select(s => new LineaServicioComprobanteDto
        {
            Nombre = s.Servicio?.Nombre ?? s.NombreLibre ?? s.ServicioId ?? string.Empty,
            Descripcion = s.Descripcion,
            NombreMecanico = s.Mecanico is null
                ? string.Empty
                : $"{s.Mecanico.Nombre} {s.Mecanico.Apellido}".Trim(),
            Precio = s.Precio
        }).ToList();

        var repuestos = orden.Repuestos.Select(r => new LineaRepuestoComprobanteDto
        {
            // Inventario muestra el nombre del catálogo; los demás, su descripción libre.
            Nombre = r.Repuesto?.Nombre ?? r.Descripcion ?? r.RepuestoId ?? string.Empty,
            Cantidad = r.Cantidad,
            PrecioUnitario = r.PrecioUnitario,
            Subtotal = r.Cantidad * r.PrecioUnitario,
            SinCargo = r.Origen == OrigenRepuesto.ClienteTrae
        }).ToList();

        return new ComprobanteDto
        {
            OrdenId = orden.OrdenId,

            // La razón social manda cuando el cliente es una empresa.
            NombreCliente = cliente is null
                ? string.Empty
                : (!string.IsNullOrWhiteSpace(cliente.RazonSocial)
                    ? cliente.RazonSocial.Trim()
                    : $"{cliente.Nombre} {cliente.Apellido}".Trim()),
            CiNit = cliente?.CiNit ?? string.Empty,
            TelefonoCliente = cliente?.Telefono,

            Placa = vehiculo?.Placa ?? string.Empty,
            DescripcionVehiculo = vehiculo is null
                ? string.Empty
                : $"{vehiculo.Marca} {vehiculo.Modelo}".Trim(),
            Kilometraje = vehiculo?.Kilometraje,

            Servicios = servicios,
            Repuestos = repuestos,
            SubtotalServicios = servicios.Sum(s => s.Precio),
            SubtotalRepuestos = repuestos.Sum(r => r.Subtotal)
        };
    }

    /// <summary>
    /// Cobro de una orden visto como solicitud de emisión: cada servicio y cada
    /// repuesto es una línea. Los repuestos que trae el cliente se omiten: no se
    /// cobran, así que no forman parte del comprobante.
    /// </summary>
    public static SolicitudEmisionDto SolicitudDesdeOrden(
        OrdenTrabajo orden, string? nitRazonSocialPedido = null)
    {
        var cliente = orden.Cliente;

        var lineas = orden.Servicios
            .Select(s => new LineaEmisionDto
            {
                Descripcion = s.Servicio?.Nombre ?? s.NombreLibre ?? string.Empty,
                Cantidad = 1,
                PrecioUnitario = s.Precio,
                Subtotal = s.Precio,
                CodigoInterno = s.ServicioId,
                CodigoSin = s.Servicio?.CodigoSin,
                UnidadMedidaSin = s.Servicio?.UnidadMedidaSin
            })
            .Concat(orden.Repuestos
                .Where(r => r.Origen != OrigenRepuesto.ClienteTrae)
                .Select(r => new LineaEmisionDto
                {
                    Descripcion = r.Repuesto?.Nombre ?? r.Descripcion ?? string.Empty,
                    Cantidad = r.Cantidad,
                    PrecioUnitario = r.PrecioUnitario,
                    Subtotal = r.Cantidad * r.PrecioUnitario,
                    CodigoInterno = r.RepuestoId,
                    CodigoSin = r.Repuesto?.CodigoSin,
                    UnidadMedidaSin = r.Repuesto?.UnidadMedidaSin
                }))
            .ToList();

        return new SolicitudEmisionDto
        {
            Origen = OrigenComprobante.OrdenTrabajo,
            DocumentoId = orden.OrdenId,
            Fecha = DateTime.UtcNow,
            Total = lineas.Sum(l => l.Subtotal),
            Lineas = lineas,
            Comprador = DesdeCliente(cliente, nitRazonSocialPedido)
        };
    }

    /// <summary>Cobro de mostrador visto como solicitud de emisión.</summary>
    public static SolicitudEmisionDto SolicitudDesdeVenta(Venta venta)
        => new()
        {
            Origen = OrigenComprobante.Mostrador,
            DocumentoId = venta.VentaId,
            Fecha = venta.FechaVenta,
            Total = venta.Total,
            MetodoPago = venta.MetodoPago,
            CodigoMetodoPagoSin = venta.MetodoPagoId,
            Comprador = DesdeCliente(venta.Cliente, null),
            Lineas = [.. venta.Detalles.Select(d => new LineaEmisionDto
            {
                Descripcion = d.Repuesto?.Nombre ?? d.RepuestoId,
                Cantidad = d.Cantidad,
                PrecioUnitario = d.PrecioUnitario,
                Subtotal = d.Cantidad * d.PrecioUnitario,
                CodigoInterno = d.RepuestoId,
                CodigoSin = d.Repuesto?.CodigoSin,
                UnidadMedidaSin = d.Repuesto?.UnidadMedidaSin
            })]
        };

    /// <summary>
    /// En mostrador el comprador puede no estar registrado: el SIAT admite
    /// venta sin nombre bajo los códigos genéricos del catálogo, y el recibo
    /// interno se conforma con "Cliente de mostrador".
    /// </summary>
    private static CompradorDto DesdeCliente(Cliente? cliente, string? nitRazonSocialPedido)
    {
        if (cliente is null)
            return new CompradorDto { Nombre = "Cliente de mostrador" };

        return new CompradorDto
        {
            ClienteId = cliente.ClienteId,
            Nombre = !string.IsNullOrWhiteSpace(nitRazonSocialPedido)
                ? nitRazonSocialPedido.Trim()
                : (!string.IsNullOrWhiteSpace(cliente.RazonSocial)
                    ? cliente.RazonSocial.Trim()
                    : $"{cliente.Nombre} {cliente.Apellido}".Trim()),
            CiNit = cliente.CiNit,
            TipoDocumentoId = cliente.TipoDocumentoId,
            NumeroDocumento = cliente.NumeroDocumento,
            Complemento = cliente.Complemento,
            Correo = cliente.Email
        };
    }
}
