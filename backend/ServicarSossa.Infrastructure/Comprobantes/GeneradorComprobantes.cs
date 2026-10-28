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

    // Texto en los tonos del frontend (styles.css), para que el documento
    // impreso y la pantalla se reconozcan como el mismo sistema.
    private const string Tinta = "#14171C";
    private const string TintaSuave = "#3A414E";
    private const string Gris = "#6B7280";
    private const string MarcaOscura = "#B00500";   // sello ANULADA
    private const string Verde = "#1F6B39";         // pagado / aprobado

    // Documentos para imprimir: fondo blanco y el color solo en líneas y
    // títulos, para gastar poca tinta.
    private const string Rojo = "#C00000";           // títulos y total a pagar
    private const string RojoTrazo = "#D10A0A";      // ondas y líneas de la tabla
    private const string RojoCabecera = "#A00000";   // texto del encabezado de tabla
    private const string GrisTrazo = "#B9BEC6";      // segunda línea de las ondas
    private const string GrisFila = "#C9CDD3";       // separación entre filas
    private const string AmarilloBorde = "#E0A800";  // marco del saldo / pendiente
    private const string AmarilloTexto = "#7A5700";  // su texto (legible impreso)

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
        => new()
        {
            Contenido = CrearProforma(c).GeneratePdf(),
            NombreArchivo = $"{c.Numero}.pdf",
            TipoContenido = "application/pdf"
        };

    /// <summary>
    /// El documento de la proforma sin generar: el PDF sale de acá, y también
    /// una vista previa en imagen si hiciera falta.
    /// </summary>
    public IDocument CrearProforma(ComprobanteDto c)
    {
        return Document.Create(container =>
        {
            container.Page(page =>
            {
                ConfigurarHoja(page);

                var anulada = c.Estado.Equals("Anulada", StringComparison.OrdinalIgnoreCase);

                page.Header().Element(e => Encabezado(e, "PROFORMA", c.Numero, anulada ? "ANULADA" : null));
                page.Content().PaddingTop(16).Element(e => Cuerpo(e, c));
                page.Footer().Element(e => Pie(e, $"{_taller.Nombre} — {c.Numero} / {c.OrdenId}"));

                // Una proforma anulada no puede pasar por válida al imprimirla:
                // además de la etiqueta de la cabecera, el sello cruza la hoja.
                if (anulada)
                    page.Foreground().AlignCenter().AlignMiddle().Rotate(-30)
                        .Text("ANULADA").FontSize(96).Bold().LetterSpacing(0.08f)
                        .FontColor(Colors.Red.Lighten3);
            });
        });
    }

    /// <summary>A4 con márgenes que dejan libres las ondas, que van de fondo en toda la hoja.</summary>
    private static void ConfigurarHoja(PageDescriptor page)
    {
        page.Size(PageSizes.A4);
        page.MarginTop(28);
        page.MarginHorizontal(42);
        page.MarginBottom(22);
        page.DefaultTextStyle(t => t.FontSize(9).FontFamily(Fonts.Calibri).FontColor(Tinta));

        // El fondo ocupa la hoja entera (sin márgenes): las ondas llegan a los bordes.
        page.Background().Svg(Ondas);
    }

    // ==================================================== PRESUPUESTO DIAGNÓSTICO
    // Mismo formato que la proforma (ondas, logo, datos enfrentados, tabla),
    // con el diagnóstico y el importe estimado en vez del detalle de servicios
    // y repuestos.

    public ArchivoComprobanteDto GenerarPresupuestoDiagnostico(PresupuestoDiagnosticoDto p)
        => new()
        {
            Contenido = CrearPresupuesto(p).GeneratePdf(),
            NombreArchivo = $"{p.Numero}-presupuesto.pdf",
            TipoContenido = "application/pdf"
        };

    /// <summary>El documento del presupuesto preliminar sin generar (PDF o vista previa).</summary>
    public IDocument CrearPresupuesto(PresupuestoDiagnosticoDto p)
    {
        return Document.Create(container =>
        {
            container.Page(page =>
            {
                ConfigurarHoja(page);

                page.Header().Element(e => Encabezado(e, "PRESUPUESTO", $"Preliminar · {p.Numero}"));
                page.Content().PaddingTop(16).Element(e => CuerpoPresupuesto(e, p));
                page.Footer().Element(e => Pie(e, $"{_taller.Nombre} — Presupuesto preliminar {p.Numero}"));
            });
        });
    }

    private void CuerpoPresupuesto(IContainer container, PresupuestoDiagnosticoDto p)
    {
        container.Column(col =>
        {
            col.Item().Element(e => Partes(e, p.NombreCliente, p.CiNit, p.TelefonoCliente, null));

            col.Item().PaddingTop(18).Row(row =>
            {
                row.RelativeItem().Text($"Fecha: {p.Fecha:dd/MM/yyyy}").FontSize(11).Bold();

                row.RelativeItem(2).AlignRight().AlignBottom().Text(t =>
                {
                    t.DefaultTextStyle(s => s.FontSize(9).FontColor(TintaSuave));
                    t.Span("Vehículo: ");
                    t.Span($"{p.Placa} · {p.DescripcionVehiculo}").FontColor(Tinta).SemiBold();

                    if (!string.IsNullOrWhiteSpace(p.NombreMecanico))
                    {
                        t.Span("   Diagnosticó: ");
                        t.Span(p.NombreMecanico).FontColor(Tinta).SemiBold();
                    }
                });
            });

            col.Item().PaddingTop(10).Element(e => TablaDiagnostico(e, p));
            col.Item().PaddingTop(12).Element(e => CierrePresupuesto(e, p));
            col.Item().PaddingTop(46).Element(e => FirmasPresupuesto(e, p));
        });
    }

    /// <summary>Lo diagnosticado a la izquierda y el importe estimado a la derecha.</summary>
    private static void TablaDiagnostico(IContainer container, PresupuestoDiagnosticoDto p)
    {
        container.Table(tabla =>
        {
            tabla.ColumnsDefinition(def =>
            {
                def.RelativeColumn(5);
                def.ConstantColumn(130);
            });

            tabla.Header(header =>
            {
                header.Cell().Element(e => CeldaCabecera(e, separar: true)).Text("Diagnóstico del vehículo");
                header.Cell().Element(e => CeldaCabecera(e, separar: false)).Text("Importe estimado");
            });

            tabla.Cell().Element(Fila).Column(celda =>
            {
                celda.Item().Text("FALLA REPORTADA").FontSize(7.5f).Bold().LetterSpacing(0.06f).FontColor(Gris);
                celda.Item().PaddingTop(2).Text(p.DescripcionFalla).FontSize(10).LineHeight(1.35f);

                if (!string.IsNullOrWhiteSpace(p.ObservacionesTecnicas))
                {
                    celda.Item().PaddingTop(8).Text("OBSERVACIONES TÉCNICAS")
                        .FontSize(7.5f).Bold().LetterSpacing(0.06f).FontColor(Gris);
                    celda.Item().PaddingTop(2).Text(p.ObservacionesTecnicas)
                        .FontSize(9.5f).LineHeight(1.35f).FontColor(TintaSuave);
                }
            });

            tabla.Cell().Element(Fila).AlignCenter().Text(Monto(p.MontoEstimado)).FontSize(11).Bold();
        });
    }

    /// <summary>Aviso de que es una estimación a la izquierda; total y decisión del cliente a la derecha.</summary>
    private static void CierrePresupuesto(IContainer container, PresupuestoDiagnosticoDto p)
    {
        container.Row(row =>
        {
            row.RelativeItem().PaddingRight(24).Text(t =>
            {
                t.DefaultTextStyle(s => s.FontSize(9).LineHeight(1.35f));
                t.Span("Importante: ").SemiBold();
                t.Span("este monto es una estimación previa a la reparación. Durante el trabajo pueden " +
                       "detectarse fallas o tareas adicionales que lo modifiquen; en ese caso se le " +
                       "consultará antes de continuar. El detalle definitivo de servicios y repuestos " +
                       "figura en la proforma.").FontColor(TintaSuave);
            });

            row.ConstantItem(240).Column(der =>
            {
                der.Item().Element(e => LineaTotalDestacada(e, "Total estimado", p.MontoEstimado));

                // La decisión del cliente, en un marco sin relleno: amarillo
                // mientras está pendiente, verde aprobada, rojo rechazada.
                var (texto, marco, tinta) = p.RespuestaCliente switch
                {
                    var r when r.Equals("Aprobado", StringComparison.OrdinalIgnoreCase)
                        => ($"APROBADO POR EL CLIENTE · {p.FechaRespuestaCliente:dd/MM/yyyy}", Verde, Verde),
                    var r when r.Equals("Rechazado", StringComparison.OrdinalIgnoreCase)
                        => ($"RECHAZADO POR EL CLIENTE · {p.FechaRespuestaCliente:dd/MM/yyyy}", Rojo, Rojo),
                    _ => ("Pendiente de aprobación del cliente", AmarilloBorde, AmarilloTexto),
                };

                der.Item().PaddingTop(8).Border(1.2f).BorderColor(marco).PaddingVertical(5).PaddingHorizontal(9)
                    .AlignCenter().Text(texto).FontSize(9.5f).Bold().FontColor(tinta);
            });
        });
    }

    /// <summary>
    /// Mientras el cliente no decidió, lleva su firma de conformidad además de
    /// la del taller; ya aprobado o rechazado, solo la del taller.
    /// </summary>
    private void FirmasPresupuesto(IContainer container, PresupuestoDiagnosticoDto p)
    {
        var pendiente = !p.RespuestaCliente.Equals("Aprobado", StringComparison.OrdinalIgnoreCase)
            && !p.RespuestaCliente.Equals("Rechazado", StringComparison.OrdinalIgnoreCase);

        container.Row(row =>
        {
            if (pendiente)
                row.ConstantItem(210).Element(e => LineaFirma(e, "Firma del cliente", "Conforme · Fecha: ____/____/______"));

            row.RelativeItem();
            row.ConstantItem(210).Element(e => LineaFirma(e, "Firma y sello", _taller.Nombre));
        });
    }

    // ================================================================= PROFORMA
    // Diseño para imprimir: hoja blanca con ondas de dos trazos finos (rojo y
    // gris) arriba y abajo, logo arriba a la derecha, datos del cliente y del
    // taller enfrentados, una tabla de conceptos y los totales a la derecha.

    /// <summary>
    /// Las ondas de arriba y de abajo sobre una hoja A4 (595 × 842 pt): solo
    /// líneas, sin relleno. Van de fondo, así que se repiten en cada hoja.
    /// </summary>
    private const string Ondas = $"""
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 595 842" width="595" height="842">
          <path d="M0 104C30 96 70 88 120 86C190 83 260 94 330 110C420 130 500 138 595 122" fill="none" stroke="{RojoTrazo}" stroke-width="2.6"/>
          <path d="M0 114C30 107 70 100 120 99C190 97 260 107 330 122C420 141 500 148 595 134" fill="none" stroke="{GrisTrazo}" stroke-width="1"/>
          <path d="M0 740C30 746 70 754 120 758C200 764 280 756 360 742C440 728 520 726 595 744" fill="none" stroke="{RojoTrazo}" stroke-width="2.6"/>
          <path d="M0 730C30 735 70 742 120 746C200 752 280 745 360 732C440 719 520 717 595 734" fill="none" stroke="{GrisTrazo}" stroke-width="1"/>
        </svg>
        """;

    /// <summary>Sobre la onda: tipo y número de documento a la izquierda, logo a la derecha.</summary>
    private void Encabezado(IContainer container, string titulo, string subtitulo, string? sello = null)
    {
        container.Height(112).Row(row =>
        {
            row.RelativeItem().PaddingTop(6).Column(izq =>
            {
                izq.Item().Text(titulo).FontSize(22).Bold().LetterSpacing(0.12f)
                    .FontColor(Rojo);
                izq.Item().Text(subtitulo).FontSize(12).SemiBold().LetterSpacing(0.05f)
                    .FontColor(TintaSuave);

                if (sello is not null)
                    izq.Item().PaddingTop(4).AlignLeft().Background(MarcaOscura)
                        .PaddingVertical(2).PaddingHorizontal(7)
                        .Text(sello).FontSize(9).Bold().FontColor(Colors.White);
            });

            if (_logo is not null)
                row.ConstantItem(185).AlignRight().Height(64).Image(_logo).FitArea();
            else
                row.ConstantItem(185).AlignRight().Text(_taller.Nombre)
                    .FontSize(17).Bold().FontColor(Tinta);
        });
    }

    private void Cuerpo(IContainer container, ComprobanteDto c)
    {
        container.Column(col =>
        {
            col.Item().Element(e => Partes(e, c.NombreCliente, c.CiNit, c.TelefonoCliente, c.NitRazonSocial));
            col.Item().PaddingTop(18).Element(e => DatosOrden(e, c));
            col.Item().PaddingTop(10).Element(e => TablaConceptos(e, c));
            col.Item().PaddingTop(12).Element(e => Cierre(e, c));
            col.Item().PaddingTop(46).Element(Firma);
        });
    }

    /// <summary>Datos del cliente a la izquierda y del taller a la derecha, como en una carta.</summary>
    private void Partes(
        IContainer container, string nombre, string ciNit, string? telefono, string? aNombreDe)
    {
        container.Row(row =>
        {
            row.RelativeItem().Column(izq =>
            {
                izq.Item().PaddingBottom(4).Text("DATOS DEL CLIENTE").FontSize(10.5f).Bold();
                izq.Item().Element(e => Linea(e, "Nombre", nombre));
                izq.Item().Element(e => Linea(e, "CI / NIT", ciNit));

                if (!string.IsNullOrWhiteSpace(telefono))
                    izq.Item().Element(e => Linea(e, "Teléfono", telefono));

                // Dato aparte, no sustituto del CI: es el nombre con el que el
                // cliente pidió la factura, y puede diferir del titular.
                if (!string.IsNullOrWhiteSpace(aNombreDe))
                    izq.Item().Element(e => Linea(e, "A nombre de", aNombreDe));
            });

            row.ConstantItem(20);

            row.RelativeItem().Column(der =>
            {
                der.Item().AlignRight().PaddingBottom(4).Text("DATOS DEL TALLER").FontSize(10.5f).Bold();
                der.Item().AlignRight().Element(e => Linea(e, "Nombre", _taller.Nombre));
                der.Item().AlignRight().Element(e => Linea(e, "Dirección", $"{_taller.Direccion}, {_taller.Ciudad}"));
                der.Item().AlignRight().Element(e => Linea(e, "Teléfono", _taller.Telefono));
                der.Item().AlignRight().Element(e => Linea(e, "NIT", _taller.Nit));
            });
        });
    }

    private static void Linea(IContainer container, string etiqueta, string valor)
    {
        container.PaddingVertical(1).Text(t =>
        {
            t.DefaultTextStyle(s => s.FontSize(9).LetterSpacing(0.03f).FontColor(TintaSuave));
            t.Span($"{etiqueta}: ");
            t.Span(valor).FontColor(Tinta);
        });
    }

    /// <summary>Fecha, vehículo y orden de trabajo, justo encima de la tabla.</summary>
    private static void DatosOrden(IContainer container, ComprobanteDto c)
    {
        container.Row(row =>
        {
            row.RelativeItem().Text(t =>
            {
                t.Span("Fecha: ").FontSize(11).Bold();
                t.Span($"{c.FechaEmision:dd/MM/yyyy}").FontSize(11).Bold();
            });

            row.RelativeItem(2).AlignRight().AlignBottom().Text(t =>
            {
                t.DefaultTextStyle(s => s.FontSize(9).FontColor(TintaSuave));
                t.Span("Vehículo: ");
                t.Span($"{c.Placa} · {c.DescripcionVehiculo}").FontColor(Tinta).SemiBold();
                if (c.Kilometraje is > 0)
                    t.Span($" · {c.Kilometraje.Value.ToString("N0", Cultura)} km").FontColor(Tinta);
                t.Span("   Orden: ");
                t.Span(c.OrdenId).FontColor(Tinta).SemiBold();
            });
        });
    }

    /// <summary>
    /// Servicios y repuestos en una sola tabla: Concepto, Cantidad, Precio e
    /// Importe (cantidad × precio de cada fila; la suma de todo es el total).
    /// </summary>
    private static void TablaConceptos(IContainer container, ComprobanteDto c)
    {
        container.Table(tabla =>
        {
            tabla.ColumnsDefinition(def =>
            {
                def.RelativeColumn(5);    // concepto
                def.ConstantColumn(70);   // cantidad
                def.ConstantColumn(85);   // precio
                def.ConstantColumn(85);   // importe
            });

            tabla.Header(header =>
            {
                header.Cell().Element(e => CeldaCabecera(e, separar: true)).Text("Concepto");
                header.Cell().Element(e => CeldaCabecera(e, separar: true)).Text("Cantidad");
                header.Cell().Element(e => CeldaCabecera(e, separar: true)).Text("Precio");
                header.Cell().Element(e => CeldaCabecera(e, separar: false)).Text("Importe");
            });

            if (c.Servicios.Count == 0 && c.Repuestos.Count == 0)
            {
                tabla.Cell().ColumnSpan(4).Element(Fila)
                    .Text("La orden no registra servicios ni repuestos.").FontColor(Gris);
                return;
            }

            foreach (var s in c.Servicios)
            {
                tabla.Cell().Element(Fila).Column(celda =>
                {
                    celda.Item().Text(s.Nombre).FontSize(10);
                    var detalle = string.IsNullOrWhiteSpace(s.Descripcion)
                        ? $"Servicio · {s.NombreMecanico}"
                        : $"Servicio · {s.NombreMecanico} · {s.Descripcion}";
                    celda.Item().Text(detalle).FontSize(7.5f).FontColor(Gris);
                });
                tabla.Cell().Element(Fila).AlignCenter().Text("1");
                tabla.Cell().Element(Fila).AlignCenter().Text(Monto(s.Precio));
                tabla.Cell().Element(Fila).AlignCenter().Text(Monto(s.Precio));
            }

            foreach (var r in c.Repuestos)
            {
                tabla.Cell().Element(Fila).Column(celda =>
                {
                    celda.Item().Text(r.Nombre).FontSize(10);
                    // El que trae el cliente se lista pero va sin cargo.
                    celda.Item().Text(r.SinCargo ? "Repuesto · lo trajo el cliente" : "Repuesto")
                        .FontSize(7.5f).FontColor(Gris);
                });
                tabla.Cell().Element(Fila).AlignCenter().Text(r.Cantidad.ToString(Cultura));

                if (r.SinCargo)
                {
                    tabla.Cell().Element(Fila).AlignCenter().Text("Sin cargo").FontColor(Gris);
                    tabla.Cell().Element(Fila).AlignCenter().Text("—").FontColor(Gris);
                }
                else
                {
                    tabla.Cell().Element(Fila).AlignCenter().Text(Monto(r.PrecioUnitario));
                    tabla.Cell().Element(Fila).AlignCenter().Text(Monto(r.Subtotal));
                }
            }
        });
    }

    /// <summary>
    /// Encabezado de tabla sin relleno: título en rojo con una línea roja debajo,
    /// cada columna separada de la siguiente por un pequeño espacio.
    /// </summary>
    private static IContainer CeldaCabecera(IContainer celda, bool separar)
        => celda.PaddingRight(separar ? 3 : 0)
            .BorderBottom(2).BorderColor(RojoTrazo).PaddingVertical(7).AlignCenter()
            .DefaultTextStyle(t => t.FontSize(10).Bold().FontColor(RojoCabecera).LetterSpacing(0.03f));

    /// <summary>Fila de la tabla: separada de la siguiente por una línea gris fina.</summary>
    private static IContainer Fila(IContainer container)
        => container.BorderBottom(0.8f).BorderColor(GrisFila)
            .PaddingVertical(7).PaddingHorizontal(4).AlignMiddle()
            .DefaultTextStyle(t => t.FontSize(10));

    /// <summary>Notas a la izquierda; subtotales, total y lo pagado a la derecha.</summary>
    private void Cierre(IContainer container, ComprobanteDto c)
    {
        container.Row(row =>
        {
            row.RelativeItem().PaddingRight(24).Column(izq =>
            {
                if (!string.IsNullOrWhiteSpace(_taller.TextoGarantia))
                    izq.Item().PaddingBottom(6).Text(t =>
                    {
                        t.DefaultTextStyle(s => s.FontSize(9).LineHeight(1.35f));
                        t.Span("Garantía: ").SemiBold();
                        t.Span(_taller.TextoGarantia).FontColor(TintaSuave);
                    });

                izq.Item().Text(t =>
                {
                    t.DefaultTextStyle(s => s.FontSize(9).LineHeight(1.35f));
                    t.Span("Nota: ").SemiBold();
                    t.Span("documento de cobro del taller, sin valor fiscal.").FontColor(TintaSuave);
                });
            });

            row.ConstantItem(240).Column(der =>
            {
                der.Item().Element(e => LineaTotal(e, "Subtotal servicios", c.SubtotalServicios));
                der.Item().Element(e => LineaTotal(e, "Subtotal repuestos", c.SubtotalRepuestos));

                der.Item().Element(e => LineaTotalDestacada(e, "Total a pagar", c.Total));

                // El estado del cobro en un marco sin relleno: amarillo con
                // saldo pendiente, verde cuando ya está pagado.
                var saldado = c.SaldoPendiente <= 0;
                var marco = saldado ? Verde : AmarilloBorde;
                var tinta = saldado ? Verde : AmarilloTexto;

                der.Item().PaddingTop(8).Border(1.2f).BorderColor(marco)
                    .PaddingVertical(5).PaddingHorizontal(9)
                    .Row(fila =>
                    {
                        fila.RelativeItem()
                            .Text(saldado ? "PAGADO" : "Saldo pendiente")
                            .FontSize(9.5f).Bold().FontColor(tinta);

                        fila.ConstantItem(95).AlignRight()
                            .Text(Monto(saldado ? c.Total : c.SaldoPendiente))
                            .FontSize(9.5f).Bold().FontColor(tinta);
                    });

                if (!saldado && c.TotalPagado > 0)
                    der.Item().PaddingTop(3).AlignRight()
                        .Text($"Pagado a la fecha: {Monto(c.TotalPagado)}")
                        .FontSize(8).FontColor(Gris);
            });
        });
    }

    /// <summary>El total del documento: en rojo y con una línea roja encima, para que se vea primero.</summary>
    private static void LineaTotalDestacada(IContainer container, string etiqueta, decimal valor)
    {
        container.PaddingTop(4).BorderTop(1.2f).BorderColor(RojoTrazo).PaddingTop(5).Row(fila =>
        {
            fila.RelativeItem().AlignRight().PaddingRight(14).Text(etiqueta).FontSize(13).Bold().FontColor(Rojo);
            fila.ConstantItem(95).AlignRight().Text(Monto(valor)).FontSize(13).Bold().FontColor(Rojo);
        });
    }

    private static void LineaTotal(IContainer container, string etiqueta, decimal valor)
    {
        container.PaddingVertical(2.5f).Row(row =>
        {
            row.RelativeItem().AlignRight().PaddingRight(14).Text(etiqueta).FontSize(10).FontColor(TintaSuave);
            row.ConstantItem(95).AlignRight().Text(Monto(valor)).FontSize(10);
        });
    }

    /// <summary>Línea de firma del taller, abajo a la derecha.</summary>
    private void Firma(IContainer container)
    {
        container.Row(row =>
        {
            row.RelativeItem();
            row.ConstantItem(210).Element(e => LineaFirma(e, "Firma y sello", _taller.Nombre));
        });
    }

    private static void LineaFirma(IContainer container, string titulo, string detalle)
    {
        container.Column(col =>
        {
            col.Item().LineHorizontal(0.8f).LineColor(Tinta);
            col.Item().PaddingTop(4).AlignCenter().Text(titulo).FontSize(10.5f).Bold();
            col.Item().AlignCenter().Text(detalle).FontSize(8.5f).FontColor(Gris);
        });
    }

    /// <summary>Bajo la onda de abajo: referencia del documento y página.</summary>
    private static void Pie(IContainer container, string referencia)
    {
        container.Height(96).AlignBottom().Row(row =>
        {
            row.RelativeItem()
                .Text(referencia)
                .FontSize(8).FontColor(Gris);

            row.ConstantItem(110).AlignRight().Text(t =>
            {
                t.DefaultTextStyle(s => s.FontSize(8).FontColor(Gris));
                t.Span("Página ");
                t.CurrentPageNumber();
                t.Span(" de ");
                t.TotalPages();
            });
        });
    }

    private static string Monto(decimal valor) => $"Bs {valor.ToString("N2", Cultura)}";
}
