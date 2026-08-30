using ServicarSossa.Application.DTOs.Comprobantes;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Common;

/// <summary>
/// Vuelca la parte del comprobante (documento "Proforma") que sale de la
/// orden: cliente, vehículo, líneas de servicios y repuestos, y sus subtotales.
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
}
