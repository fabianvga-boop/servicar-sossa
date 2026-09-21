import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { EstadoFacturacion, Factura } from '../../core/models/finanzas.model';
import { descargarArchivo } from '../../core/services/descarga';
import { FacturasService } from '../../core/services/finanzas.service';
import { NotificacionService } from '../../core/services/notificacion.service';
import { EstadoTabla } from '../../shared/components/estado-tabla';
import { Paginador } from '../../shared/components/paginador';
import { BolivianosPipe } from '../../shared/pipes/bolivianos.pipe';

/**
 * Facturación electrónica: el comprobante FISCAL ante el SIN, con su CUF y su
 * XML. Distinto del módulo de Proformas, que documenta el cobro del taller.
 *
 * Mientras el taller no tenga NIT habilitado, la pantalla no ofrece emitir:
 * explica por qué y remite a Proformas. Es preferible eso a un botón que
 * siempre falla.
 */
@Component({
  selector: 'app-facturas',
  imports: [RouterLink, DatePipe, EstadoTabla, Paginador, BolivianosPipe],
  templateUrl: './facturas.html',
})
export class Facturas {
  private readonly servicio = inject(FacturasService);
  private readonly notificacion = inject(NotificacionService);

  protected readonly facturas = signal<Factura[]>([]);
  protected readonly cargando = signal(true);
  protected readonly estadoModulo = signal<EstadoFacturacion | null>(null);

  protected readonly pagina = signal(1);
  protected readonly tamanoPagina = signal(20);
  protected readonly totalRegistros = signal(0);
  protected readonly totalPaginas = signal(0);

  constructor() {
    // Lo primero es saber si el módulo puede emitir: define toda la pantalla.
    this.servicio.estado().subscribe({
      next: (estado) => this.estadoModulo.set(estado),
      error: () => this.estadoModulo.set(null),
    });

    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);

    this.servicio
      .getAll({ pagina: this.pagina(), tamanoPagina: this.tamanoPagina() })
      .subscribe({
        next: (resultado) => {
          this.facturas.set(resultado.items);
          this.totalRegistros.set(resultado.totalRegistros);
          this.totalPaginas.set(resultado.totalPaginas);
          this.cargando.set(false);
        },
        error: () => this.cargando.set(false),
      });
  }

  protected cambiarPagina(nueva: number): void {
    this.pagina.set(nueva);
    this.cargar();
  }

  protected cambiarTamano(nuevo: number): void {
    this.tamanoPagina.set(nuevo);
    this.pagina.set(1);
    this.cargar();
  }

  /** Descarga el XML: el respaldo que el contribuyente debe archivar. */
  protected descargarXml(factura: Factura, firmado: boolean): void {
    this.servicio.xml(factura.facturaId, firmado).subscribe({
      next: ({ blob, nombreArchivo }) => descargarArchivo(blob, nombreArchivo),
      error: () =>
        this.notificacion.advertencia(
          `La factura ${factura.facturaId} todavía no tiene XML ${firmado ? 'firmado' : 'generado'}.`,
        ),
    });
  }
}
