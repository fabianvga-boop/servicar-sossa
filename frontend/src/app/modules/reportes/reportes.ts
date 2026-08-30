import { DatePipe, KeyValuePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { FormatoReporte, TipoReporte } from '../../core/models/enums';
import { Reporte, ReporteGenerado } from '../../core/models/reporte.model';
import { NotificacionService } from '../../core/services/notificacion.service';
import { ReportesService } from '../../core/services/reportes.service';
import { EstadoTabla } from '../../shared/components/estado-tabla';

/** USU017-USU020 — generación y exportación de reportes. */
@Component({
  selector: 'app-reportes',
  imports: [FormsModule, DatePipe, KeyValuePipe, EstadoTabla],
  templateUrl: './reportes.html',
  styleUrl: './reportes.css',
})
export class Reportes {
  private readonly servicio = inject(ReportesService);
  private readonly notificacion = inject(NotificacionService);

  protected readonly reporte = signal<Reporte | null>(null);
  protected readonly bitacora = signal<ReporteGenerado[]>([]);
  protected readonly generando = signal(false);
  protected readonly exportando = signal(false);
  protected readonly mostrarBitacora = signal(false);

  protected readonly tipos = [
    { valor: TipoReporte.Ventas, etiqueta: 'Ventas', ayuda: 'Facturación emitida y cobrada' },
    { valor: TipoReporte.Comisiones, etiqueta: 'Comisiones', ayuda: 'Comisiones por mecánico' },
    { valor: TipoReporte.Inventario, etiqueta: 'Inventario', ayuda: 'Estado actual del stock' },
    { valor: TipoReporte.Ordenes, etiqueta: 'Órdenes', ayuda: 'Órdenes de trabajo del periodo' },
  ];

  protected readonly FormatoReporte = FormatoReporte;
  protected readonly TipoReporte = TipoReporte;

  protected filtros = {
    tipo: TipoReporte.Ventas,
    desde: this.primerDiaDelMes(),
    hasta: this.hoy(),
  };

  constructor() {
    this.generar();
    this.cargarBitacora();
  }

  private hoy(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private primerDiaDelMes(): string {
    const ahora = new Date();
    return new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString().slice(0, 10);
  }

  /** El reporte de inventario es una foto del stock: el periodo no aplica. */
  protected get periodoAplica(): boolean {
    return Number(this.filtros.tipo) !== TipoReporte.Inventario;
  }

  protected generar(): void {
    if (this.filtros.desde > this.filtros.hasta) {
      this.notificacion.advertencia('La fecha inicial no puede ser posterior a la final.');
      return;
    }

    this.generando.set(true);

    this.servicio
      .generar(Number(this.filtros.tipo) as TipoReporte, this.filtros.desde, this.filtros.hasta)
      .subscribe({
        next: (reporte) => {
          this.reporte.set(reporte);
          this.generando.set(false);
        },
        error: () => this.generando.set(false),
      });
  }

  protected exportar(formato: FormatoReporte): void {
    this.exportando.set(true);

    this.servicio
      .exportar(
        Number(this.filtros.tipo) as TipoReporte,
        this.filtros.desde,
        this.filtros.hasta,
        formato,
      )
      .subscribe({
        next: ({ blob, nombreArchivo }) => {
          this.servicio.descargar(blob, nombreArchivo);
          this.notificacion.exito(`Reporte descargado: ${nombreArchivo}`);
          this.exportando.set(false);
          // La exportación queda registrada en la bitácora del backend.
          this.cargarBitacora();
        },
        error: () => this.exportando.set(false),
      });
  }

  protected cargarBitacora(): void {
    this.servicio.getBitacora().subscribe((lista) => this.bitacora.set(lista));
  }

  protected nombreFormato(formato: FormatoReporte): string {
    return FormatoReporte[formato];
  }
}
