using System.Globalization;
using Microsoft.Extensions.Options;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using ServicarSossa.Application.DTOs.Comprobantes;
using ServicarSossa.Application.Interfaces;

namespace ServicarSossa.Infrastructure.Comprobantes;

/// <summary>
/// Maqueta el documento "Proforma" del taller en PDF con QuestPDF: identidad
/// del taller arriba, partes involucradas, detalle de servicios y repuestos,
/// y totales al pie. También arma el presupuesto preliminar del diagnóstico
/// (documento distinto, más simple, sin detalle de servicios/repuestos).
/// </summary>
public class GeneradorComprobantes : IGeneradorComprobantes
{
    /// <summary>Formato boliviano para montos, igual que en los reportes.</summary>
    private static readonly CultureInfo Cultura = CultureInfo.GetCultureInfo("es-BO");

    // Paleta alineada con la del frontend (styles.css), para que el documento
    // impreso y la pantalla se reconozcan como el mismo sistema.
    private const string Tinta = "#14171C";
    private const string TintaSuave = "#3A414E";
    private const string Gris = "#6B7280";
    private const string GrisClaro = "#DDE1E6";
    private const string GrisFondo = "#F7F8F9";
    private const string Marca = "#E10600";
    private const string MarcaOscura = "#B00500";
    private const string Verde = "#1F6B39";
    private const string VerdeFondo = "#E3F5E9";
    private const string Naranja = "#8A6300";
    private const string NaranjaFondo = "#FBEFD2";

    private readonly TallerOptions _taller;

    /// <summary>
    /// Bytes del logotipo, leídos una sola vez. Si el archivo no está, queda
    /// en null y el encabezado cae al nombre del taller en texto: un logo
    /// faltante no debe impedir emitir un comprobante.
    /// </summary>
    private readonly byte[]? _logo;

    public GeneradorComprobantes(IOptions<TallerOptions> opciones)
    {
        _taller = opciones.Value;

        var ruta = Path.Combine(AppContext.BaseDirectory, _taller.RutaLogo);
        _logo = File.Exists(ruta) ? File.ReadAllBytes(ruta) : null;
    }

    public ArchivoComprobanteDto Generar(ComprobanteDto c)
    {
        var documento = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(1.4f, Unit.Centimetre);
                page.DefaultTextStyle(t => t.FontSize(9).FontFamily(Fonts.Calibri).FontColor(Tinta));

                page.Header().Element(e => Encabezado(e, c));
                page.Content().PaddingTop(14).Element(e => Cuerpo(e, c));
                page.Footer().Element(e => Pie(e, c));
            });
        });

        return new ArchivoComprobanteDto
        {
            Contenido = documento.GeneratePdf(),
            NombreArchivo = $"{c.Numero}.pdf",
            TipoContenido = "application/pdf"
        };
    }

    // ==================================================== PRESUPUESTO DIAGNÓSTICO

    public ArchivoComprobanteDto GenerarPresupuestoDiagnostico(PresupuestoDiagnosticoDto p)
    {
        var documento = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(1.4f, Unit.Centimetre);
                page.DefaultTextStyle(t => t.FontSize(9).FontFamily(Fonts.Calibri).FontColor(Tinta));

                page.Header().Element(e => EncabezadoPresupuesto(e, p));
                page.Content().PaddingTop(14).Element(e => CuerpoPresupuesto(e, p));
                page.Footer().Element(e => PiePresupuesto(e, p));
            });
        });

        return new ArchivoComprobanteDto
        {
            Contenido = documento.GeneratePdf(),
            NombreArchivo = $"{p.Numero}-presupuesto.pdf",
            TipoContenido = "application/pdf"
        };
    }

    private void EncabezadoPresupuesto(IContainer container, PresupuestoDiagnosticoDto p)
    {
        container.Column(col =>
        {
            col.Item().Row(row =>
            {
                row.RelativeItem().Column(izq =>
                {
                    if (_logo is not null)
                        izq.Item().Height(46).AlignLeft().Image(_logo).FitHeight();
                    else
                        izq.Item().Text(_taller.Nombre).FontSize(17).Bold();

                    izq.Item().PaddingTop(6).Text(
                            $"{_taller.Rubro} · {_taller.Direccion}, {_taller.Ciudad}")
                        .FontSize(8).FontColor(Gris);

                    izq.Item().Text($"Tel. {_taller.Telefono} · NIT {_taller.Nit}")
                        .FontSize(8).FontColor(Gris);
                });

                row.ConstantItem(190).Column(der =>
                {
                    der.Item().AlignRight().Text("PRESUPUESTO PRELIMINAR")
                        .FontSize(11).Bold().LetterSpacing(0.1f).FontColor(Marca);

                    der.Item().AlignRight().PaddingTop(2).Text(p.Numero).FontSize(19).Bold();

                    der.Item().AlignRight()
                        .Text($"Diagnóstico del {p.Fecha:dd/MM/yyyy}")
                        .FontSize(8).FontColor(Gris);

                    // El estado de la decisión del cliente se sella arriba a la derecha.
                    if (p.RespuestaCliente.Equals("Aprobado", StringComparison.OrdinalIgnoreCase))
                        der.Item().AlignRight().PaddingTop(4)
                            .Background(VerdeFondo).PaddingVertical(2).PaddingHorizontal(6)
                            .Text("APROBADO POR EL CLIENTE").FontSize(8).Bold().FontColor(Verde);
                    else if (p.RespuestaCliente.Equals("Rechazado", StringComparison.OrdinalIgnoreCase))
                        der.Item().AlignRight().PaddingTop(4)
                            .Background(MarcaOscura).PaddingVertical(2).PaddingHorizontal(6)
                            .Text("RECHAZADO").FontSize(9).Bold().FontColor(Colors.White);
                });
            });

            col.Item().PaddingTop(10).LineHorizontal(2).LineColor(Tinta);
        });
    }

    private static void CuerpoPresupuesto(IContainer container, PresupuestoDiagnosticoDto p)
    {
        container.Column(col =>
        {
            // Partes: cliente y vehículo.
            col.Item().Border(1).BorderColor(GrisClaro).Row(row =>
            {
                row.RelativeItem().Padding(10).Column(izq =>
                {
                    izq.Item().Text("CLIENTE").FontSize(7.5f).Bold()
                        .LetterSpacing(0.1f).FontColor(Gris);

                    izq.Item().PaddingTop(5).Element(e => Dato(e, "Nombre", p.NombreCliente));
                    izq.Item().Element(e => Dato(e, "CI / NIT", p.CiNit));

                    if (!string.IsNullOrWhiteSpace(p.TelefonoCliente))
                        izq.Item().Element(e => Dato(e, "Teléfono", p.TelefonoCliente));
                });

                row.ConstantItem(1).Background(GrisClaro);

                row.RelativeItem().Padding(10).Column(der =>
                {
                    der.Item().Text("VEHÍCULO").FontSize(7.5f).Bold()
                        .LetterSpacing(0.1f).FontColor(Gris);

                    der.Item().PaddingTop(5).Element(e => Dato(e, "Placa", p.Placa));
                    der.Item().Element(e => Dato(e, "Marca / Modelo", p.DescripcionVehiculo));

                    if (!string.IsNullOrWhiteSpace(p.NombreMecanico))
                        der.Item().Element(e => Dato(e, "Diagnosticó", p.NombreMecanico));
                });
            });

            // Diagnóstico del vehículo.
            col.Item().PaddingTop(16).Element(e => TituloSeccion(e, "DIAGNÓSTICO DEL VEHÍCULO"));

            col.Item().PaddingTop(6).Text("Falla reportada").FontSize(8).Bold().FontColor(TintaSuave);
            col.Item().PaddingTop(2).Text(p.DescripcionFalla).FontSize(9).LineHeight(1.4f);

            if (!string.IsNullOrWhiteSpace(p.ObservacionesTecnicas))
            {
                col.Item().PaddingTop(8).Text("Observaciones técnicas")
                    .FontSize(8).Bold().FontColor(TintaSuave);
                col.Item().PaddingTop(2).Text(p.ObservacionesTecnicas)
                    .FontSize(9).LineHeight(1.4f).FontColor(TintaSuave);
            }

            // Monto estimado, destacado.
            col.Item().PaddingTop(18).Background(GrisFondo).Border(1).BorderColor(GrisClaro)
                .Padding(14).Row(fila =>
                {
                    fila.RelativeItem().Column(izq =>
                    {
                        izq.Item().Text("MONTO ESTIMADO DE LA REPARACIÓN")
                            .FontSize(8).Bold().LetterSpacing(0.08f).FontColor(TintaSuave);
                        izq.Item().PaddingTop(3).Text("Presupuesto aproximado, sujeto a confirmación.")
                            .FontSize(7.5f).FontColor(Gris);
                    });

                    fila.ConstantItem(150).AlignRight().AlignMiddle()
                        .Text(Monto(p.MontoEstimado)).FontSize(20).Bold().FontColor(MarcaOscura);
                });

            // Aviso: el monto es aproximado.
            col.Item().PaddingTop(12).Element(e => TituloSeccion(e, "IMPORTANTE"));
            col.Item().PaddingTop(4).Text(
                    "Este monto es una estimación previa a la reparación. Durante el trabajo " +
                    "pueden detectarse fallas o tareas adicionales que modifiquen el presupuesto; " +
                    "en ese caso se le comunicará antes de continuar. El detalle definitivo de " +
                    "servicios y repuestos se refleja en la orden de trabajo y en la factura.")
                .FontSize(7.5f).FontColor(Gris).LineHeight(1.4f);

            // Estado de la decisión del cliente.
            if (p.RespuestaCliente.Equals("Aprobado", StringComparison.OrdinalIgnoreCase))
                col.Item().PaddingTop(10).Text(
                        $"Presupuesto aprobado por el cliente el {p.FechaRespuestaCliente:dd/MM/yyyy}.")
                    .FontSize(8).Bold().FontColor(Verde);
            else if (p.RespuestaCliente.Equals("Rechazado", StringComparison.OrdinalIgnoreCase))
                col.Item().PaddingTop(10).Text(
                        $"Presupuesto rechazado por el cliente el {p.FechaRespuestaCliente:dd/MM/yyyy}.")
                    .FontSize(8).Bold().FontColor(MarcaOscura);
            else
                col.Item().PaddingTop(14).Row(row =>
                {
                    row.RelativeItem().Column(c =>
                    {
                        c.Item().Height(28);
                        c.Item().LineHorizontal(0.8f).LineColor(Gris);
                        c.Item().PaddingTop(3).Text("Firma del cliente (conforme)")
                            .FontSize(7.5f).FontColor(Gris);
                    });
                    row.ConstantItem(30);
                    row.RelativeItem().Column(c =>
                    {
                        c.Item().Height(28);
                        c.Item().LineHorizontal(0.8f).LineColor(Gris);
                        c.Item().PaddingTop(3).Text("Fecha").FontSize(7.5f).FontColor(Gris);
                    });
                });
        });
    }

    private void PiePresupuesto(IContainer container, PresupuestoDiagnosticoDto p)
    {
        container.PaddingTop(8).BorderTop(1).BorderColor(GrisClaro).PaddingTop(6).Row(row =>
        {
            row.RelativeItem()
                .Text($"{_taller.Nombre} — Presupuesto preliminar {p.Numero}")
                .FontSize(7).FontColor(Gris);

            row.ConstantItem(110).AlignRight().Text(t =>
            {
                t.DefaultTextStyle(s => s.FontSize(7).FontColor(Gris));
                t.Span("Página ");
                t.CurrentPageNumber();
                t.Span(" de ");
                t.TotalPages();
            });
        });
    }

    // ================================================================ ENCABEZADO

    private void Encabezado(IContainer container, ComprobanteDto c)
    {
        container.Column(col =>
        {
            col.Item().Row(row =>
            {
                row.RelativeItem().Column(izq =>
                {
                    if (_logo is not null)
                        izq.Item().Height(46).AlignLeft().Image(_logo).FitHeight();
                    else
                        izq.Item().Text(_taller.Nombre).FontSize(17).Bold();

                    izq.Item().PaddingTop(6).Text(
                            $"{_taller.Rubro} · {_taller.Direccion}, {_taller.Ciudad}")
                        .FontSize(8).FontColor(Gris);

                    izq.Item().Text($"Tel. {_taller.Telefono} · NIT {_taller.Nit}")
                        .FontSize(8).FontColor(Gris);
                });

                row.ConstantItem(190).Column(der =>
                {
                    der.Item().AlignRight()
                        .Text("PROFORMA")
                        .FontSize(11).Bold().LetterSpacing(0.12f).FontColor(Marca);

                    der.Item().AlignRight().PaddingTop(2)
                        .Text(c.Numero).FontSize(19).Bold();

                    der.Item().AlignRight()
                        .Text($"Emitida el {c.FechaEmision:dd/MM/yyyy}")
                        .FontSize(8).FontColor(Gris);

                    der.Item().AlignRight().PaddingTop(4)
                        .Text($"Orden de trabajo: {c.OrdenId}")
                        .FontSize(8).FontColor(Gris);

                    // La anulación tiene que saltar a la vista: un comprobante
                    // anulado circulando como válido es un problema contable.
                    if (c.Estado.Equals("Anulada", StringComparison.OrdinalIgnoreCase))
                        der.Item().AlignRight().PaddingTop(4)
                            .Background(MarcaOscura).PaddingVertical(2).PaddingHorizontal(6)
                            .Text("ANULADA").FontSize(9).Bold().FontColor(Colors.White);
                });
            });

            col.Item().PaddingTop(10).LineHorizontal(2).LineColor(Tinta);
        });
    }

    // ===================================================================== CUERPO

    private void Cuerpo(IContainer container, ComprobanteDto c)
    {
        container.Column(col =>
        {
            col.Item().Element(e => Partes(e, c));

            col.Item().PaddingTop(16).Element(e => TablaServicios(e, c));
            col.Item().PaddingTop(12).Element(e => TablaRepuestos(e, c));

            col.Item().PaddingTop(16).Element(e => Cierre(e, c));
        });
    }

    /// <summary>Bloques de cliente y vehículo, uno al lado del otro.</summary>
    private static void Partes(IContainer container, ComprobanteDto c)
    {
        container.Border(1).BorderColor(GrisClaro).Row(row =>
        {
            row.RelativeItem().Padding(10).Column(izq =>
            {
                izq.Item().Text("FACTURAR A").FontSize(7.5f).Bold()
                    .LetterSpacing(0.1f).FontColor(Gris);

                izq.Item().PaddingTop(5).Element(e => Dato(e, "Cliente", c.NombreCliente));
                izq.Item().Element(e => Dato(e, "CI / NIT", c.CiNit));

                if (!string.IsNullOrWhiteSpace(c.TelefonoCliente))
                    izq.Item().Element(e => Dato(e, "Teléfono", c.TelefonoCliente));

                // Dato aparte, no sustituto del CI: es el nombre con el que el
                // cliente pidió la factura, y puede diferir del titular.
                if (!string.IsNullOrWhiteSpace(c.NitRazonSocial))
                    izq.Item().Element(e => Dato(e, "Facturar a nombre de", c.NitRazonSocial));
            });

            row.ConstantItem(1).Background(GrisClaro);

            row.RelativeItem().Padding(10).Column(der =>
            {
                der.Item().Text("VEHÍCULO ATENDIDO").FontSize(7.5f).Bold()
                    .LetterSpacing(0.1f).FontColor(Gris);

                der.Item().PaddingTop(5).Element(e => Dato(e, "Placa", c.Placa));
                der.Item().Element(e => Dato(e, "Marca / Modelo", c.DescripcionVehiculo));

                if (c.Kilometraje is > 0)
                    der.Item().Element(e => Dato(
                        e, "Kilometraje", $"{c.Kilometraje.Value.ToString("N0", Cultura)} km"));
            });
        });
    }

    private static void Dato(IContainer container, string etiqueta, string valor)
    {
        container.PaddingVertical(1.5f).Row(row =>
        {
            row.RelativeItem().Text(etiqueta).FontSize(8.5f).FontColor(Gris);
            row.ConstantItem(150).AlignRight().Text(valor).FontSize(8.5f).SemiBold();
        });
    }

    // ==================================================================== TABLAS

    private static void TablaServicios(IContainer container, ComprobanteDto c)
    {
        container.Column(col =>
        {
            col.Item().Element(e => TituloSeccion(e, "SERVICIOS EJECUTADOS"));

            if (c.Servicios.Count == 0)
            {
                col.Item().PaddingVertical(8)
                    .Text("La orden no registra servicios.").FontSize(8.5f).FontColor(Gris);
                return;
            }

            col.Item().Table(tabla =>
            {
                tabla.ColumnsDefinition(def =>
                {
                    def.RelativeColumn(5);   // servicio + detalle
                    def.RelativeColumn(3);   // mecánico
                    def.ConstantColumn(80);  // precio
                });

                tabla.Header(header =>
                {
                    header.Cell().Element(EstiloEncabezado).Text("Servicio");
                    header.Cell().Element(EstiloEncabezado).Text("Mecánico");
                    header.Cell().Element(EstiloEncabezado).AlignRight().Text("Precio");
                });

                foreach (var s in c.Servicios)
                {
                    tabla.Cell().Element(EstiloCelda).Column(celda =>
                    {
                        celda.Item().Text(s.Nombre).FontSize(8.5f);

                        if (!string.IsNullOrWhiteSpace(s.Descripcion))
                            celda.Item().Text(s.Descripcion).FontSize(7.5f).FontColor(Gris);
                    });

                    tabla.Cell().Element(EstiloCelda)
                        .Text(s.NombreMecanico).FontSize(8.5f);

                    tabla.Cell().Element(EstiloCelda).AlignRight()
                        .Text(Monto(s.Precio)).FontSize(8.5f);
                }
            });
        });
    }

    private static void TablaRepuestos(IContainer container, ComprobanteDto c)
    {
        container.Column(col =>
        {
            col.Item().Element(e => TituloSeccion(e, "REPUESTOS UTILIZADOS"));

            if (c.Repuestos.Count == 0)
            {
                col.Item().PaddingVertical(8)
                    .Text("La orden no consumió repuestos.")
                    .FontSize(8.5f).FontColor(Gris);
                return;
            }

            col.Item().Table(tabla =>
            {
                tabla.ColumnsDefinition(def =>
                {
                    def.RelativeColumn(5);   // repuesto
                    def.ConstantColumn(55);  // cantidad
                    def.ConstantColumn(80);  // precio unitario
                    def.ConstantColumn(80);  // subtotal
                });

                tabla.Header(header =>
                {
                    header.Cell().Element(EstiloEncabezado).Text("Repuesto");
                    header.Cell().Element(EstiloEncabezado).AlignRight().Text("Cant.");
                    header.Cell().Element(EstiloEncabezado).AlignRight().Text("P. Unit.");
                    header.Cell().Element(EstiloEncabezado).AlignRight().Text("Subtotal");
                });

                foreach (var r in c.Repuestos)
                {
                    tabla.Cell().Element(EstiloCelda).Text(t =>
                    {
                        t.Span(r.Nombre).FontSize(8.5f);
                        // El que trae el cliente se lista pero se marca sin cargo.
                        if (r.SinCargo)
                            t.Span("  (lo trae el cliente)").FontSize(7.5f).FontColor(Gris);
                    });

                    tabla.Cell().Element(EstiloCelda).AlignRight()
                        .Text(r.Cantidad.ToString(Cultura)).FontSize(8.5f);

                    if (r.SinCargo)
                    {
                        tabla.Cell().Element(EstiloCelda).AlignRight()
                            .Text("Sin cargo").FontSize(8.5f).FontColor(Gris);
                        tabla.Cell().Element(EstiloCelda).AlignRight()
                            .Text("—").FontSize(8.5f).FontColor(Gris);
                    }
                    else
                    {
                        tabla.Cell().Element(EstiloCelda).AlignRight()
                            .Text(Monto(r.PrecioUnitario)).FontSize(8.5f);
                        tabla.Cell().Element(EstiloCelda).AlignRight()
                            .Text(Monto(r.Subtotal)).FontSize(8.5f);
                    }
                }
            });
        });
    }

    private static void TituloSeccion(IContainer container, string texto)
    {
        container.PaddingBottom(4).BorderBottom(1.5f).BorderColor(Tinta)
            .PaddingBottom(4)
            .Text(texto).FontSize(8).Bold().LetterSpacing(0.09f).FontColor(TintaSuave);
    }

    private static IContainer EstiloEncabezado(IContainer container)
        => container.Background(GrisFondo).BorderBottom(1).BorderColor(GrisClaro)
            .PaddingVertical(5).PaddingHorizontal(6)
            .DefaultTextStyle(t => t.FontSize(7.5f).Bold().FontColor(Gris).LetterSpacing(0.05f));

    private static IContainer EstiloCelda(IContainer container)
        => container.BorderBottom(1).BorderColor(GrisFondo)
            .PaddingVertical(5).PaddingHorizontal(6);

    // ==================================================================== CIERRE

    private void Cierre(IContainer container, ComprobanteDto c)
    {
        container.Row(row =>
        {
            // Izquierda: condiciones del documento.
            row.RelativeItem().PaddingRight(20).Column(izq =>
            {
                if (!string.IsNullOrWhiteSpace(_taller.TextoGarantia))
                {
                    izq.Item().Text("Garantía").FontSize(8).Bold().FontColor(TintaSuave);

                    izq.Item().PaddingTop(2).Text(_taller.TextoGarantia)
                        .FontSize(7.5f).FontColor(Gris).LineHeight(1.4f);
                }

                izq.Item().PaddingTop(8).Text(
                        $"Documento generado por el sistema {_taller.Nombre} a partir de la " +
                        $"orden {c.OrdenId}.")
                    .FontSize(7).FontColor(Gris).LineHeight(1.4f);
            });

            // Derecha: totales.
            row.ConstantItem(215).Column(der =>
            {
                der.Item().Element(e => LineaTotal(e, "Subtotal servicios", c.SubtotalServicios));
                der.Item().Element(e => LineaTotal(e, "Subtotal repuestos", c.SubtotalRepuestos));

                der.Item().PaddingTop(6).BorderTop(2).BorderColor(Tinta).PaddingTop(6)
                    .Row(fila =>
                    {
                        fila.RelativeItem().Text("TOTAL").FontSize(11).Bold();
                        fila.ConstantItem(110).AlignRight()
                            .Text(Monto(c.Total)).FontSize(14).Bold();
                    });

                var saldado = c.SaldoPendiente <= 0;

                der.Item().PaddingTop(8)
                    .Background(saldado ? VerdeFondo : NaranjaFondo)
                    .PaddingVertical(6).PaddingHorizontal(9)
                    .Row(fila =>
                    {
                        fila.RelativeItem()
                            .Text(saldado ? "PAGADO" : "Saldo pendiente")
                            .FontSize(8.5f).Bold()
                            .FontColor(saldado ? Verde : Naranja);

                        fila.ConstantItem(90).AlignRight()
                            .Text(Monto(saldado ? c.Total : c.SaldoPendiente))
                            .FontSize(8.5f).Bold()
                            .FontColor(saldado ? Verde : Naranja);
                    });

                if (!saldado && c.TotalPagado > 0)
                    der.Item().PaddingTop(3).AlignRight()
                        .Text($"Pagado a la fecha: {Monto(c.TotalPagado)}")
                        .FontSize(7.5f).FontColor(Gris);
            });
        });
    }

    private static void LineaTotal(
        IContainer container, string etiqueta, decimal valor, string? color = null)
    {
        container.PaddingVertical(2).Row(row =>
        {
            row.RelativeItem().Text(etiqueta).FontSize(8.5f).FontColor(TintaSuave);

            var celda = row.ConstantItem(110).AlignRight()
                .Text(Monto(valor)).FontSize(8.5f);

            if (color is not null) celda.FontColor(color);
        });
    }

    // ======================================================================= PIE

    private void Pie(IContainer container, ComprobanteDto c)
    {
        container.PaddingTop(8).BorderTop(1).BorderColor(GrisClaro).PaddingTop(6).Row(row =>
        {
            row.RelativeItem()
                .Text($"{_taller.Nombre} — {c.Numero} / {c.OrdenId}")
                .FontSize(7).FontColor(Gris);

            row.ConstantItem(110).AlignRight().Text(t =>
            {
                t.DefaultTextStyle(s => s.FontSize(7).FontColor(Gris));
                t.Span("Página ");
                t.CurrentPageNumber();
                t.Span(" de ");
                t.TotalPages();
            });
        });
    }

    private static string Monto(decimal valor) => $"Bs {valor.ToString("N2", Cultura)}";
}
