import { DatePipe, KeyValuePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { FormatoReporte, TipoReporte } from '../../core/models/enums';
import { Reporte, ReporteGenerado } from '../../core/models/reporte.model';
import { NotificacionService } from '../../core/services/notificacion.service';
import { ReportesService } from '../../core/services/reportes.service';
import { EstadoTabla } from '../../shared/components/estado-tabla';
import { Paginador } from '../../shared/components/paginador';

type Rango = 'hoy' | 'semana' | 'mes' | 'fechas';
type Salida = 'pdf' | 'excel' | 'csv' | 'pantalla';

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** USU017-USU020 — reportes: qué, de cuándo y en qué formato. */
@Component({
  selector: 'app-reportes',
  imports: [FormsModule, DatePipe, KeyValuePipe, EstadoTabla, Paginador],
  templateUrl: './reportes.html',
  styleUrl: './reportes.css',
})
export class Reportes {
  private readonly servicio = inject(ReportesService);
  private readonly notificacion = inject(NotificacionService);

  /** Los totales se muestran en el orden en que los arma el servidor, no alfabético. */
  protected readonly enOrdenDelServidor = () => 0;

  protected readonly reporte = signal<Reporte | null>(null);
  protected readonly bitacora = signal<ReporteGenerado[]>([]);
  protected readonly procesando = signal(false);

  protected readonly paginaBitacora = signal(1);
  protected readonly tamanoPaginaBitacora = signal(10);
  protected readonly totalBitacora = signal(0);
  protected readonly totalPaginasBitacora = signal(0);

  protected readonly tipos = [
    {
      valor: TipoReporte.Ventas,
      etiqueta: 'Ventas',
      ayuda: 'Cada proforma y venta de mostrador, con lo cobrado y lo que falta.',
      icono: 'M4 19V5M4 19h16M8 15l3-4 3 2 4-6',
      tono: 'rojo',
    },
    {
      valor: TipoReporte.DetalleVentas,
      etiqueta: 'Detalle de ventas',
      ayuda: 'Cada servicio y repuesto vendido, con cantidad y precio.',
      icono: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
      tono: 'rojo',
    },
    {
      valor: TipoReporte.Ordenes,
      etiqueta: 'Órdenes',
      ayuda: 'Cuántas se abrieron, cerraron y cancelaron en el periodo.',
      icono: 'M7 3h10v18H7zM10 8h4M10 12h4M10 16h2',
      tono: 'azul',
    },
    {
      valor: TipoReporte.Comisiones,
      etiqueta: 'Comisiones',
      ayuda: 'Lo que corresponde a cada mecánico y lo ya pagado.',
      icono: 'M12 3v18M17 7H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H7',
      tono: 'naranja',
    },
    {
      valor: TipoReporte.Inventario,
      etiqueta: 'Inventario',
      ayuda: 'Stock actual, valor del inventario y repuestos por reponer.',
      icono: 'm12 3 8 4.5v9L12 21l-8-4.5v-9zM12 12v9',
      tono: 'verde',
    },
  ];

  protected readonly rangos: { clave: Rango; etiqueta: string }[] = [
    { clave: 'hoy', etiqueta: 'Hoy' },
    { clave: 'semana', etiqueta: 'Esta semana' },
    { clave: 'mes', etiqueta: 'Este mes' },
    { clave: 'fechas', etiqueta: 'Elegir fechas' },
  ];

  protected readonly salidas: { clave: Salida; etiqueta: string }[] = [
    { clave: 'pdf', etiqueta: 'PDF' },
    { clave: 'excel', etiqueta: 'Excel' },
    { clave: 'csv', etiqueta: 'CSV' },
    { clave: 'pantalla', etiqueta: 'Ver en pantalla' },
  ];

  protected readonly tipo = signal(TipoReporte.Ventas);
  protected readonly rango = signal<Rango>('mes');
  protected readonly salida = signal<Salida>('pdf');
  protected readonly desde = signal(fechaIso(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  protected readonly hasta = signal(fechaIso(new Date()));

  /** El de inventario es una foto del stock de hoy: el periodo no aplica. */
  protected readonly periodoAplica = computed(() => this.tipo() !== TipoReporte.Inventario);

  protected readonly nombreTipo = computed(
    () => this.tipos.find((t) => t.valor === this.tipo())?.etiqueta.toLowerCase() ?? '',
  );

  /** "Del 1 al 4 de noviembre de 2026". */
  protected readonly textoPeriodo = computed(() => textoPeriodo(this.desde(), this.hasta()));

  constructor() {
    this.cargarBitacora();
  }

  protected elegirRango(rango: Rango): void {
    this.rango.set(rango);
    const hoy = new Date();
    if (rango === 'hoy') {
      this.desde.set(fechaIso(hoy));
      this.hasta.set(fechaIso(hoy));
    } else if (rango === 'semana') {
      const lunes = new Date(hoy);
      lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
      this.desde.set(fechaIso(lunes));
      this.hasta.set(fechaIso(hoy));
    } else if (rango === 'mes') {
      this.desde.set(fechaIso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)));
      this.hasta.set(fechaIso(hoy));
    }
  }

  protected generar(): void {
    if (this.desde() > this.hasta()) {
      this.notificacion.advertencia('La fecha inicial no puede ser posterior a la final.');
      return;
    }

    const salida = this.salida();
    this.procesando.set(true);

    if (salida === 'pantalla') {
      this.servicio.generar(this.tipo(), this.desde(), this.hasta()).subscribe({
        next: (reporte) => {
          this.reporte.set(reporte);
          this.procesando.set(false);
          setTimeout(() => document.getElementById('reporte-en-pantalla')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
        },
        error: () => this.procesando.set(false),
      });
      return;
    }

    const formato = salida === 'excel' ? FormatoReporte.Excel : salida === 'csv' ? FormatoReporte.Csv : FormatoReporte.Pdf;
    this.descargar(this.tipo(), this.desde(), this.hasta(), formato);
  }

  /** "Descargar de nuevo" en la lista de generados: mismo tipo, periodo y formato. */
  protected repetir(registro: ReporteGenerado): void {
    const tipo = TipoReporte[registro.tipoReporte as keyof typeof TipoReporte];
    if (tipo === undefined) return;
    this.procesando.set(true);
    this.descargar(tipo, registro.fechaInicio.slice(0, 10), registro.fechaFin.slice(0, 10), registro.formato);
  }

  private descargar(tipo: TipoReporte, desde: string, hasta: string, formato: FormatoReporte): void {
    this.servicio.exportar(tipo, desde, hasta, formato).subscribe({
      next: ({ blob, nombreArchivo }) => {
        this.servicio.descargar(blob, nombreArchivo);
        this.notificacion.exito(`Reporte descargado: ${nombreArchivo}`);
        this.procesando.set(false);
        // La descarga queda registrada en la bitácora del backend.
        this.cargarBitacora();
      },
      error: () => this.procesando.set(false),
    });
  }

  protected cargarBitacora(): void {
    this.servicio
      .getBitacora(undefined, this.paginaBitacora(), this.tamanoPaginaBitacora())
      .subscribe((resultado) => {
        this.bitacora.set(resultado.items);
        this.totalBitacora.set(resultado.totalRegistros);
        this.totalPaginasBitacora.set(resultado.totalPaginas);
      });
  }

  protected cambiarPaginaBitacora(pagina: number): void {
    this.paginaBitacora.set(pagina);
    this.cargarBitacora();
  }

  protected cambiarTamanoBitacora(tamano: number): void {
    this.tamanoPaginaBitacora.set(tamano);
    this.paginaBitacora.set(1);
    this.cargarBitacora();
  }

  protected nombreFormato(formato: FormatoReporte): string {
    return formato === FormatoReporte.Pdf ? 'PDF' : formato === FormatoReporte.Excel ? 'Excel' : 'CSV';
  }

  protected nombreTipoGuardado(tipo: string): string {
    if (tipo === 'Ordenes') return 'Órdenes';
    if (tipo === 'DetalleVentas') return 'Detalle de ventas';
    return tipo;
  }

  protected periodoGuardado(registro: ReporteGenerado): string {
    // Registros viejos sin fechas guardadas llegan con el año 1.
    if (Number(registro.fechaInicio.slice(0, 4)) < 2000) return 'Sin periodo';
    return registro.tipoReporte === 'Inventario'
      ? 'Al ' + registro.fechaFin.slice(8, 10) + '/' + registro.fechaFin.slice(5, 7) + '/' + registro.fechaFin.slice(0, 4)
      : textoPeriodo(registro.fechaInicio.slice(0, 10), registro.fechaFin.slice(0, 10));
  }
}

function fechaIso(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

/** "Del 1 al 4 de noviembre de 2026", "El 4 de noviembre de 2026" o con dos meses. */
function textoPeriodo(desde: string, hasta: string): string {
  const [a1, m1, d1] = desde.split('-').map(Number);
  const [a2, m2, d2] = hasta.split('-').map(Number);
  if (!a1 || !a2) return '';
  if (desde === hasta) return `El ${d1} de ${MESES[m1 - 1]} de ${a1}`;
  if (a1 === a2 && m1 === m2) return `Del ${d1} al ${d2} de ${MESES[m2 - 1]} de ${a2}`;
  if (a1 === a2) return `Del ${d1} de ${MESES[m1 - 1]} al ${d2} de ${MESES[m2 - 1]} de ${a2}`;
  return `Del ${d1} de ${MESES[m1 - 1]} de ${a1} al ${d2} de ${MESES[m2 - 1]} de ${a2}`;
}
