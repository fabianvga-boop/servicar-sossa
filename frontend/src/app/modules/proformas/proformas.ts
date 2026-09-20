import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { EstadoProforma, EstadoOrden } from '../../core/models/enums';
import { Proforma } from '../../core/models/finanzas.model';
import { Orden } from '../../core/models/taller.model';
import { descargarArchivo } from '../../core/services/descarga';
import { ProformasService } from '../../core/services/finanzas.service';
import { NotificacionService } from '../../core/services/notificacion.service';
import { OrdenesService } from '../../core/services/ordenes.service';
import { Confirmacion } from '../../shared/components/confirmacion';
import { EstadoTabla } from '../../shared/components/estado-tabla';
import { InsigniaEstado } from '../../shared/components/insignia-estado';
import { Modal } from '../../shared/components/modal';
import { Paginador } from '../../shared/components/paginador';
import { OpcionSelector, SelectorBusqueda } from '../../shared/components/selector-busqueda';
import { Atajo } from '../../shared/directives/atajo';
import { BolivianosPipe } from '../../shared/pipes/bolivianos.pipe';

/**
 * USU038 — emisión y anulación de proformas: el documento de cobro del taller,
 * sin valor fiscal. Es el flujo operativo de todos los días y contra lo que el
 * cliente paga.
 *
 * El comprobante fiscal ante el SIN vive aparte, en el módulo de Facturas.
 */
@Component({
  selector: 'app-proformas',
  imports: [
    FormsModule,
    RouterLink,
    DatePipe,
    Modal,
    Confirmacion,
    EstadoTabla,
    InsigniaEstado,
    Paginador,
    SelectorBusqueda,
    Atajo,
    BolivianosPipe,
  ],
  templateUrl: './proformas.html',
})
export class Proformas {
  private readonly servicio = inject(ProformasService);
  private readonly ordenesService = inject(OrdenesService);
  private readonly notificacion = inject(NotificacionService);
  private readonly ruta = inject(ActivatedRoute);

  protected readonly proformas = signal<Proforma[]>([]);
  protected readonly ordenes = signal<Orden[]>([]);
  protected readonly cargando = signal(true);
  protected readonly estadoFiltro = signal('');
  protected readonly procesando = signal(false);

  protected readonly pagina = signal(1);
  protected readonly tamanoPagina = signal(20);
  protected readonly totalRegistros = signal(0);
  protected readonly totalPaginas = signal(0);

  protected readonly panelNueva = signal(false);
  protected readonly porAnular = signal<Proforma | null>(null);

  /** Id de la proforma cuyo PDF se está generando, para desactivar su botón. */
  protected readonly descargando = signal<string | null>(null);

  protected nueva = { ordenId: '', nitRazonSocial: '' };

  protected readonly EstadoProforma = EstadoProforma;

  protected readonly opcionesOrden = computed<OpcionSelector[]>(() =>
    this.ordenes().map((o) => ({
      valor: o.ordenId,
      etiqueta: `${o.ordenId} — ${o.placaVehiculo}`,
      detalle: `${o.nombreCliente} · Bs ${o.total.toFixed(2)}`,
    })),
  );

  constructor() {
    this.cargar();

    // Llega desde el menú de acciones de una orden ("Cobrar").
    const ordenId = this.ruta.snapshot.queryParamMap.get('ordenId');

    // Solo tiene sentido cobrar trabajo terminado.
    this.ordenesService.getAll().subscribe((lista) => {
      this.ordenes.set(
        lista.filter(
          (o) => o.estado === EstadoOrden.Finalizada || o.estado === EstadoOrden.Cerrada,
        ),
      );

      // Recién con las órdenes cargadas: el selector necesita sus opciones.
      if (ordenId && this.ordenes().some((o) => o.ordenId === ordenId)) {
        this.nueva = { ordenId, nitRazonSocial: '' };
        this.panelNueva.set(true);
      }
    });
  }

  protected cargar(): void {
    this.cargando.set(true);

    const estado = this.estadoFiltro();

    this.servicio
      .getAll({
        estado: estado === '' ? undefined : (Number(estado) as EstadoProforma),
        pagina: this.pagina(),
        tamanoPagina: this.tamanoPagina(),
      })
      .subscribe({
        next: (resultado) => {
          this.proformas.set(resultado.items);
          this.totalRegistros.set(resultado.totalRegistros);
          this.totalPaginas.set(resultado.totalPaginas);
          this.cargando.set(false);
        },
        error: () => this.cargando.set(false),
      });
  }

  protected onFiltrarEstado(valor: string): void {
    this.estadoFiltro.set(valor);
    this.pagina.set(1);
    this.cargar();
  }

  protected cambiarPagina(pagina: number): void {
    this.pagina.set(pagina);
    this.cargar();
  }

  protected cambiarTamano(tamano: number): void {
    this.tamanoPagina.set(tamano);
    this.pagina.set(1);
    this.cargar();
  }

  /** El PDF se arma en el backend a partir de la orden; acá solo se descarga. */
  protected descargarPdf(proforma: Proforma): void {
    this.descargando.set(proforma.proformaId);

    this.servicio.pdf(proforma.proformaId).subscribe({
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
        next: (proforma) => {
          this.notificacion.exito(`Proforma ${proforma.proformaId} emitida.`);
          this.procesando.set(false);
          this.panelNueva.set(false);
          this.cargar();
        },
        error: () => this.procesando.set(false),
      });
  }

  protected anular(): void {
    const proforma = this.porAnular();
    if (!proforma) return;

    this.procesando.set(true);

    this.servicio.anular(proforma.proformaId).subscribe({
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
