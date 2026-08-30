import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { EstadoFactura, EstadoOrden } from '../../core/models/enums';
import { Factura } from '../../core/models/finanzas.model';
import { Orden } from '../../core/models/taller.model';
import { descargarArchivo } from '../../core/services/descarga';
import { FacturasService } from '../../core/services/finanzas.service';
import { NotificacionService } from '../../core/services/notificacion.service';
import { OrdenesService } from '../../core/services/ordenes.service';
import { Confirmacion } from '../../shared/components/confirmacion';
import { EstadoTabla } from '../../shared/components/estado-tabla';
import { InsigniaEstado } from '../../shared/components/insignia-estado';
import { Modal } from '../../shared/components/modal';
import { OpcionSelector, SelectorBusqueda } from '../../shared/components/selector-busqueda';
import { Atajo } from '../../shared/directives/atajo';
import { BolivianosPipe } from '../../shared/pipes/bolivianos.pipe';

/**
 * USU038 — emisión y anulación de proformas.
 *
 * El sistema no factura vía SIAT: no hay distinción fiscal entre "factura" y
 * "proforma", así que es el único documento de cobro del taller. El recurso
 * técnico (FacturasService, /api/facturas) sigue llamándose así para no
 * tocar datos existentes; el nombre visible para el usuario es "Proforma".
 */
@Component({
  selector: 'app-facturas',
  imports: [
    FormsModule,
    RouterLink,
    DatePipe,
    Modal,
    Confirmacion,
    EstadoTabla,
    InsigniaEstado,
    SelectorBusqueda,
    Atajo,
    BolivianosPipe,
  ],
  templateUrl: './facturas.html',
})
export class Facturas {
  private readonly servicio = inject(FacturasService);
  private readonly ordenesService = inject(OrdenesService);
  private readonly notificacion = inject(NotificacionService);

  protected readonly facturas = signal<Factura[]>([]);
  protected readonly ordenes = signal<Orden[]>([]);
  protected readonly cargando = signal(true);
  protected readonly estadoFiltro = signal('');
  protected readonly procesando = signal(false);

  protected readonly panelNueva = signal(false);
  protected readonly porAnular = signal<Factura | null>(null);

  /** Id de la proforma cuyo PDF se está generando, para desactivar su botón. */
  protected readonly descargando = signal<string | null>(null);

  protected nueva = { ordenId: '', nitRazonSocial: '' };

  protected readonly EstadoFactura = EstadoFactura;

  protected readonly opcionesOrden = computed<OpcionSelector[]>(() =>
    this.ordenes().map((o) => ({
      valor: o.ordenId,
      etiqueta: `${o.ordenId} — ${o.placaVehiculo}`,
      detalle: `${o.nombreCliente} · Bs ${o.total.toFixed(2)}`,
    })),
  );

  constructor() {
    this.cargar();

    // Solo tiene sentido cobrar trabajo terminado.
    this.ordenesService.getAll().subscribe((lista) =>
      this.ordenes.set(
        lista.filter(
          (o) => o.estado === EstadoOrden.Finalizada || o.estado === EstadoOrden.Cerrada,
        ),
      ),
    );
  }

  protected cargar(): void {
    this.cargando.set(true);

    const estado = this.estadoFiltro();

    this.servicio
      .getAll({ estado: estado === '' ? undefined : (Number(estado) as EstadoFactura) })
      .subscribe({
        next: (lista) => {
          this.facturas.set(lista);
          this.cargando.set(false);
        },
        error: () => this.cargando.set(false),
      });
  }

  protected onFiltrarEstado(valor: string): void {
    this.estadoFiltro.set(valor);
    this.cargar();
  }

  /** El PDF se arma en el backend a partir de la orden; acá solo se descarga. */
  protected descargarPdf(factura: Factura): void {
    this.descargando.set(factura.facturaId);

    this.servicio.pdf(factura.facturaId).subscribe({
      next: ({ blob, nombreArchivo }) => {
        descargarArchivo(blob, nombreArchivo);
        this.descargando.set(null);
      },
      error: () => this.descargando.set(null),
    });
  }

  protected abrirNueva(): void {
    this.nueva = { ordenId: '', nitRazonSocial: '' };
    this.panelNueva.set(true);
  }

  protected emitir(): void {
    if (!this.nueva.ordenId) {
      this.notificacion.advertencia('Seleccione la orden a cobrar.');
      return;
    }

    this.procesando.set(true);

    this.servicio
      .crear({
        ordenId: this.nueva.ordenId,
        nitRazonSocial: this.nueva.nitRazonSocial || null,
      })
      .subscribe({
        next: (factura) => {
          this.notificacion.exito(`Proforma ${factura.facturaId} emitida.`);
          this.procesando.set(false);
          this.panelNueva.set(false);
          this.cargar();
        },
        error: () => this.procesando.set(false),
      });
  }

  protected anular(): void {
    const factura = this.porAnular();
    if (!factura) return;

    this.procesando.set(true);

    this.servicio.anular(factura.facturaId).subscribe({
      next: () => {
        this.notificacion.exito('Proforma anulada.');
        this.procesando.set(false);
        this.porAnular.set(null);
        this.cargar();
      },
      error: () => {
        this.procesando.set(false);
        this.porAnular.set(null);
      },
    });
  }
}
