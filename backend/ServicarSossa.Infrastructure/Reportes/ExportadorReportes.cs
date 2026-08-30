using System.Text;
using ClosedXML.Excel;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using ServicarSossa.Application.DTOs.Reportes;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Infrastructure.Reportes;

/// <summary>
/// Convierte un <see cref="ReporteDto"/> a PDF (QuestPDF), Excel (ClosedXML) o CSV.
/// Trabaja sobre la forma genérica columnas/filas/totales, así que un reporte
/// nuevo no obliga a tocar esta clase.
/// </summary>
public class ExportadorReportes : IExportadorReportes
{
    private const string Taller = "Servicar SOSSA";
    private const string Ciudad = "Tarija, Bolivia";

    public ArchivoReporteDto Exportar(ReporteDto reporte, FormatoReporte formato)
    {
        var nombreBase = $"{reporte.Tipo}_{reporte.FechaInicio:yyyyMMdd}_{reporte.FechaFin:yyyyMMdd}";

        return formato switch
        {
            FormatoReporte.Pdf => new ArchivoReporteDto
            {
                Contenido = GenerarPdf(reporte),
                NombreArchivo = $"{nombreBase}.pdf",
                TipoContenido = "application/pdf"
            },
            FormatoReporte.Excel => new ArchivoReporteDto
            {
                Contenido = GenerarExcel(reporte),
                NombreArchivo = $"{nombreBase}.xlsx",
                TipoContenido = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            },
            FormatoReporte.Csv => new ArchivoReporteDto
            {
                Contenido = GenerarCsv(reporte),
                NombreArchivo = $"{nombreBase}.csv",
                TipoContenido = "text/csv"
            },
            _ => throw new ArgumentOutOfRangeException(
                nameof(formato), formato, "Formato de reporte no soportado.")
        };
    }

    // ======================================================================= PDF

    private static byte[] GenerarPdf(ReporteDto reporte)
    {
        // Horizontal: los reportes tienen hasta 9 columnas y en vertical se apretarían.
        var documento = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4.Landscape());
                page.Margin(1.5f, Unit.Centimetre);
                page.DefaultTextStyle(t => t.FontSize(9).FontFamily(Fonts.Calibri));

                page.Header().Element(e => Encabezado(e, reporte));
                page.Content().PaddingVertical(10).Element(e => Contenido(e, reporte));
                page.Footer().Element(Pie);
            });
        });

        return documento.GeneratePdf();
    }

    private static void Encabezado(IContainer container, ReporteDto reporte)
    {
        container.Column(col =>
        {
            col.Item().Row(row =>
            {
                row.RelativeItem().Column(izq =>
                {
                    izq.Item().Text(Taller).FontSize(16).Bold();
                    izq.Item().Text(Ciudad).FontSize(8).FontColor(Colors.Grey.Darken1);
                });

                row.ConstantItem(220).Column(der =>
                {
                    der.Item().AlignRight().Text(reporte.Titulo).FontSize(12).SemiBold();
                    der.Item().AlignRight()
                        .Text($"Periodo: {reporte.FechaInicio:dd/MM/yyyy} — {reporte.FechaFin:dd/MM/yyyy}")
                        .FontSize(8);
                    der.Item().AlignRight()
                        .Text($"Emitido: {reporte.FechaGeneracion:dd/MM/yyyy HH:mm} UTC")
                        .FontSize(8).FontColor(Colors.Grey.Darken1);
                    der.Item().AlignRight()
                        .Text($"Por: {reporte.GeneradoPor}")
                        .FontSize(8).FontColor(Colors.Grey.Darken1);
                });
            });

            col.Item().PaddingTop(8).LineHorizontal(1).LineColor(Colors.Grey.Medium);
        });
    }

    private static void Contenido(IContainer container, ReporteDto reporte)
    {
        container.Column(col =>
        {
            if (reporte.Filas.Count == 0)
            {
                col.Item().PaddingVertical(30).AlignCenter()
                    .Text("No hay datos para el periodo seleccionado.")
                    .FontSize(11).FontColor(Colors.Grey.Darken1);
            }
            else
            {
                col.Item().Table(tabla =>
                {
                    tabla.ColumnsDefinition(def =>
                    {
                        foreach (var _ in reporte.Columnas) def.RelativeColumn();
                    });

                    tabla.Header(header =>
                    {
                        foreach (var columna in reporte.Columnas)
                            header.Cell()
                                .Background(Colors.Grey.Lighten2)
                                .Padding(4)
                                .Text(columna).SemiBold().FontSize(8);
                    });

                    var indice = 0;
                    foreach (var fila in reporte.Filas)
                    {
                        // Filas alternadas: facilitan seguir la línea en tablas anchas.
                        var fondo = indice++ % 2 == 0 ? Colors.White : Colors.Grey.Lighten4;

                        foreach (var celda in fila)
                            tabla.Cell().Background(fondo).Padding(3).Text(celda).FontSize(8);
                    }
                });
            }

            if (reporte.Totales.Count > 0)
            {
                col.Item().PaddingTop(15).LineHorizontal(1).LineColor(Colors.Grey.Medium);
                col.Item().PaddingTop(8).Text("Resumen").SemiBold().FontSize(10);

                foreach (var (clave, valor) in reporte.Totales)
                {
                    col.Item().PaddingTop(2).Row(row =>
                    {
                        row.RelativeItem().Text(clave).FontSize(9);
                        row.ConstantItem(120).AlignRight().Text(valor).SemiBold().FontSize(9);
                    });
                }
            }
        });
    }

    private static void Pie(IContainer container)
    {
        container.Row(row =>
        {
            row.RelativeItem().Text($"{Taller} — documento generado por el sistema")
                .FontSize(7).FontColor(Colors.Grey.Darken1);

            row.ConstantItem(100).AlignRight().Text(t =>
            {
                t.DefaultTextStyle(s => s.FontSize(7).FontColor(Colors.Grey.Darken1));
                t.Span("Página ");
                t.CurrentPageNumber();
                t.Span(" de ");
                t.TotalPages();
            });
        });
    }

    // ===================================================================== EXCEL

    private static byte[] GenerarExcel(ReporteDto reporte)
    {
        using var libro = new XLWorkbook();

        // Excel limita el nombre de hoja a 31 caracteres.
        var hoja = libro.Worksheets.Add(Recortar(reporte.Tipo.ToString(), 31));

        var fila = 1;

        hoja.Cell(fila, 1).Value = Taller;
        hoja.Cell(fila, 1).Style.Font.SetBold().Font.SetFontSize(14);
        fila++;

        hoja.Cell(fila, 1).Value = reporte.Titulo;
        hoja.Cell(fila, 1).Style.Font.SetBold().Font.SetFontSize(11);
        fila++;

        hoja.Cell(fila, 1).Value =
            $"Periodo: {reporte.FechaInicio:dd/MM/yyyy} — {reporte.FechaFin:dd/MM/yyyy}";
        fila++;

        hoja.Cell(fila, 1).Value =
            $"Emitido: {reporte.FechaGeneracion:dd/MM/yyyy HH:mm} UTC por {reporte.GeneradoPor}";
        fila += 2;

        var filaEncabezado = fila;

        for (var c = 0; c < reporte.Columnas.Count; c++)
        {
            var celda = hoja.Cell(filaEncabezado, c + 1);
            celda.Value = reporte.Columnas[c];
            celda.Style.Font.SetBold();
            celda.Style.Fill.SetBackgroundColor(XLColor.LightGray);
            celda.Style.Border.SetBottomBorder(XLBorderStyleValues.Thin);
        }

        fila++;

        foreach (var filaDatos in reporte.Filas)
        {
            for (var c = 0; c < filaDatos.Count; c++)
                hoja.Cell(fila, c + 1).Value = filaDatos[c];

            fila++;
        }

        if (reporte.Filas.Count > 0)
        {
            hoja.Range(filaEncabezado, 1, fila - 1, reporte.Columnas.Count)
                .SetAutoFilter();
        }

        if (reporte.Totales.Count > 0)
        {
            fila++;
            hoja.Cell(fila, 1).Value = "Resumen";
            hoja.Cell(fila, 1).Style.Font.SetBold();
            fila++;

            foreach (var (clave, valor) in reporte.Totales)
            {
                hoja.Cell(fila, 1).Value = clave;
                hoja.Cell(fila, 2).Value = valor;
                hoja.Cell(fila, 2).Style.Font.SetBold();
                fila++;
            }
        }

        hoja.Columns().AdjustToContents();

        using var memoria = new MemoryStream();
        libro.SaveAs(memoria);
        return memoria.ToArray();
    }

    // ======================================================================= CSV

    private static byte[] GenerarCsv(ReporteDto reporte)
    {
        var sb = new StringBuilder();

        sb.AppendLine(EscaparFila([reporte.Titulo]));
        sb.AppendLine(EscaparFila(
            [$"Periodo: {reporte.FechaInicio:dd/MM/yyyy} - {reporte.FechaFin:dd/MM/yyyy}"]));
        sb.AppendLine();

        sb.AppendLine(EscaparFila(reporte.Columnas));

        foreach (var fila in reporte.Filas)
            sb.AppendLine(EscaparFila(fila));

        if (reporte.Totales.Count > 0)
        {
            sb.AppendLine();
            sb.AppendLine(EscaparFila(["Resumen"]));

            foreach (var (clave, valor) in reporte.Totales)
                sb.AppendLine(EscaparFila([clave, valor]));
        }

        // BOM UTF-8: sin él, Excel en Windows abre las tildes como caracteres raros.
        return new UTF8Encoding(encoderShouldEmitUTF8Identifier: true).GetBytes(sb.ToString());
    }

    /// <summary>Escapa según RFC 4180: comillas dobles duplicadas y campo entrecomillado.</summary>
    private static string EscaparFila(IEnumerable<string> campos)
        => string.Join(',', campos.Select(campo =>
        {
            var valor = campo ?? string.Empty;

            return valor.Contains(',') || valor.Contains('"') || valor.Contains('\n')
                ? $"\"{valor.Replace("\"", "\"\"")}\""
                : valor;
        }));

    private static string Recortar(string texto, int maximo)
        => texto.Length <= maximo ? texto : texto[..maximo];
}
