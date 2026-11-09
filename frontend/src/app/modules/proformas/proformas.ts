import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { EstadoProforma, EstadoOrden } from '../../core/models/enums';
import { Proforma } from '../../core/models/finanzas.model';
import { Orden, OrdenDetalle } from '../../core/models/taller.model';
import { descargarArchivo } from '../../core/services/descarga';
import { ProformasService } from '../../core/services/finanzas.service';
import { NotificacionService } from '../../core/services/notificacion.service';
import { OrdenesService } from '../../core/services/ordenes.service';
import { Cajon } from '../../shared/components/cajon';
import { Confirmacion } from '../../shared/components/confirmacion';
import { EstadoTabla } from '../../shared/components/estado-tabla';
import { Paginador } from '../../shared/components/paginador';
import { Placa } from '../../shared/components/placa';
import { masRecienteMovida } from '../ordenes/ordenes-lista';
import { Atajo } from '../../shared/directives/atajo';
import { BolivianosPipe } from '../../shared/pipes/bolivianos.pipe';

/** Pestañas de la lista: por cómo va el cobro de cada proforma. */
type Vista = 'todas' | 'saldo' | 'saldadas' | 'anuladas';

/** "Bs 1.080": montos redondos para la columna Cobrado (el total exacto va al lado). */
const montoCorto = new Intl.NumberFormat('es-BO', { maximumFractionDigits: 0 });

/**
 * USU038 — emisión y anulación de proformas: el documento de cobro del taller,
 * sin valor fiscal. Es el flujo operativo de todos los días y contra lo que el
 * cliente paga.
 *
 * Las proformas se traen todas (el tope de 500 sobra para un taller) y se
 * filtran en pantalla: así las pestañas muestran su cantidad y se sabe qué
 * orden ya tiene la suya.
 *
 * El comprobante fiscal ante el SIN vive aparte, en el módulo de Facturas.
 */
@Component({
  selector: 'app-proformas',
  imports: [
    FormsModule,
    RouterLink,
    DatePipe,
    Cajon,
    Confirmacion,
    EstadoTabla,
    Paginador,
    Placa,
    Atajo,
    BolivianosPipe,
  ],
  templateUrl: './proformas.html',
  styleUrl: './proformas.css',
})
export class Proformas {
  private readonly servicio = inject(ProformasService);
  private readonly ordenesService = inject(OrdenesService);
  private readonly notificacion = inject(NotificacionService);
  private readonly ruta = inject(ActivatedRoute);

  protected readonly todas = signal<Proforma[]>([]);
  protected readonly ordenes = signal<Orden[]>([]);
  protected readonly cargando = signal(true);
  protected readonly procesando = signal(false);

  protected readonly vista = signal<Vista>('todas');
  protected readonly buscar = signal('');
  protected readonly pagina = signal(1);
  protected readonly tamanoPagina = signal(20);

  protected readonly panelNueva = signal(false);
  protected readonly porAnular = signal<Proforma | null>(null);

  /** Id de la proforma cuyo PDF se está generando, para desactivar su botón. */
  protected readonly descargando = signal<string | null>(null);

  // --- Panel "Emitir proforma" ---------------------------------------------------
  protected readonly ordenElegida = signal('');
  /** Servicios y repuestos de la orden elegida, para ver qué se cobra. */
  protected readonly detalle = signal<OrdenDetalle | null>(null);
  protected nueva = { nitRazonSocial: '' };
  protected descargarAlEmitir = true;

  protected readonly EstadoProforma = EstadoProforma;
  protected readonly EstadoOrden = EstadoOrden;

  /**
   * Proforma vigente (emitida) de cada orden. Una orden con proforma vigente
   * ya no se ofrece para emitir otra: el backend la rechazaría igual.
   */
  protected readonly vigentes = computed(
    () =>
      new Map(
        this.todas()
          .filter((p) => p.estado === EstadoProforma.Emitida)
          .map((p) => [p.ordenId, p]),
      ),
  );

  protected readonly cuentas = computed(() => {
    const lista = this.todas();
    return {
      todas: lista.length,
      saldo: lista.filter((p) => this.pasaVista(p, 'saldo')).length,
      saldadas: lista.filter((p) => this.pasaVista(p, 'saldadas')).length,
      anuladas: lista.filter((p) => this.pasaVista(p, 'anuladas')).length,
    };
  });

  protected readonly filtradas = computed(() => {
    const palabras = normalizar(this.buscar()).split(/\s+/).filter(Boolean);
    return this.todas().filter((p) => {
      if (!this.pasaVista(p, this.vista())) return false;
      const texto = normalizar([p.proformaId, p.ordenId, p.nombreCliente, p.placaVehiculo, p.nitRazonSocial].filter(Boolean).join(' '));
      return palabras.every((x) => texto.includes(x));
    });
  });

  protected readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.filtradas().length / this.tamanoPagina())),
  );

  protected readonly visibles = computed(() => {
    const inicio = (Math.min(this.pagina(), this.totalPaginas()) - 1) * this.tamanoPagina();
    return this.filtradas().slice(inicio, inicio + this.tamanoPagina());
  });

  /** Órdenes terminadas sin proforma vigente, la última cerrada primero. */
  protected readonly sinProforma = computed(() =>
    this.ordenes()
      .filter((o) => !this.vigentes().has(o.ordenId))
      .sort(masRecienteMovida),
  );

  /** La última orden cerrada del taller: la que se acaba de terminar y hay que cobrar. */
  protected readonly ultimaCerrada = computed(
    () =>
      [...this.ordenes()]
        .sort(masRecienteMovida)
        .find((o) => o.estado === EstadoOrden.Cerrada)?.ordenId ?? null,
  );

  protected readonly seleccionada = computed(
    () => this.ordenes().find((o) => o.ordenId === this.ordenElegida()) ?? null,
  );

  /**
   * Lo que falta cobrar en todo el taller: órdenes con monto todavía sin
   * proforma y saldos de proformas emitidas. Null cuando no queda nada.
   */
  protected readonly resumenCobro = computed(() => {
    const ordenes = this.sinProforma().filter((o) => o.total > 0).length;
    const conSaldo = [...this.vigentes().values()].filter((p) => !p.estaSaldada);
    const saldo = conSaldo.reduce((suma, p) => suma + p.saldoPendiente, 0);

    return ordenes > 0 || conSaldo.length > 0 ? { ordenes, conSaldo: conSaldo.length, saldo } : null;
  });

  constructor() {
    // Llega desde la tarjeta de una orden ("Emitir proforma").
    const ordenId = this.ruta.snapshot.queryParamMap.get('ordenId');

    forkJoin([this.ordenesService.getAll(), this.cargarProformas()]).subscribe(([lista]) => {
      // Solo tiene sentido cobrar trabajo terminado.
      this.ordenes.set(
        lista.filter(
          (o) => o.estado === EstadoOrden.Finalizada || o.estado === EstadoOrden.Cerrada,
        ),
      );

      // Recién con las órdenes y sus proformas cargadas se sabe si se puede emitir.
      if (!ordenId) return;

      const vigente = this.vigentes().get(ordenId);
      if (vigente) {
        this.notificacion.advertencia(
          `La orden ${ordenId} ya tiene la proforma ${vigente.proformaId} emitida.`,
        );
      } else if (this.ordenes().some((o) => o.ordenId === ordenId)) {
        this.abrirNueva(ordenId);
      }
    });
  }

  /** Todas las proformas, las más nuevas primero (así las devuelve la API). */
  private cargarProformas() {
    this.cargando.set(true);

    return this.servicio.getAll({ pagina: 1, tamanoPagina: 500 }).pipe(
      map((resultado) => {
        this.todas.set(resultado.items);
        this.cargando.set(false);
        return true;
      }),
      catchError(() => {
        this.cargando.set(false);
        return of(false);
      }),
    );
  }

  protected recargar(): void {
    this.cargarProformas().subscribe();
  }

  protected onBuscar(valor: string): void {
    this.buscar.set(valor);
    this.pagina.set(1);
  }

  protected elegirVista(vista: Vista): void {
    this.vista.set(vista);
    this.pagina.set(1);
  }

  protected cambiarTamano(tamano: number): void {
    this.tamanoPagina.set(tamano);
    this.pagina.set(1);
  }

  private pasaVista(p: Proforma, vista: Vista): boolean {
    const anulada = p.estado === EstadoProforma.Anulada;
    switch (vista) {
      case 'saldo':
        return !anulada && !p.estaSaldada;
      case 'saldadas':
        return !anulada && p.estaSaldada;
      case 'anuladas':
        return anulada;
      default:
        return true;
    }
  }

  // --- Columnas de la lista ---------------------------------------------------------

  protected estadoTexto(p: Proforma): string {
    if (p.estado === EstadoProforma.Anulada) return 'Anulada';
    return p.estaSaldada ? 'Saldada' : 'Con saldo';
  }

  protected estadoClase(p: Proforma): string {
    if (p.estado === EstadoProforma.Anulada) return 'roja';
    return p.estaSaldada ? 'verde' : 'naranja';
  }

  /** Estado en la tabla: verde saldada, rojo con saldo, gris anulada. */
  protected estadoInsignia(p: Proforma): string {
    if (p.estado === EstadoProforma.Anulada) return 'insignia-gris apagada con-icono ic-ban';
    return p.estaSaldada ? 'insignia-verde con-icono ic-ok' : 'insignia-roja con-icono ic-alerta';
  }

  /** "Bs 100 de 250", o "Reemplazada" si se anuló sin pagos. */
  protected cobradoTexto(p: Proforma): string {
    if (p.estado === EstadoProforma.Anulada) return 'Anulada sin cobrar';
    return `Bs ${montoCorto.format(p.totalPagado)} de ${montoCorto.format(p.total)}`;
  }

  protected cobradoPorcentaje(p: Proforma): number {
    if (p.estado === EstadoProforma.Anulada) return 100;
    return p.total > 0 ? Math.min(100, (p.totalPagado / p.total) * 100) : 100;
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

  // --- Emitir ---------------------------------------------------------------------

  /**
   * Abre el panel con una orden ya elegida: la que llega por parámetro o, si
   * no, la primera de la lista (la última cerrada), que es la que casi siempre
   * se cobra. Se cambia con un clic.
   */
  protected abrirNueva(ordenId?: string): void {
    this.nueva = { nitRazonSocial: '' };
    this.descargarAlEmitir = true;
    this.ordenElegida.set('');
    this.detalle.set(null);

    const inicial = ordenId ?? this.sinProforma()[0]?.ordenId;
    if (inicial) this.elegirOrden(inicial);

    this.panelNueva.set(true);
  }

  protected elegirOrden(ordenId: string): void {
    if (this.ordenElegida() === ordenId) return;

    this.ordenElegida.set(ordenId);
    this.detalle.set(null);

    this.ordenesService.getById(ordenId).subscribe((detalle) => {
      // Si mientras tanto se eligió otra, este detalle ya no corresponde.
      if (this.ordenElegida() === ordenId) this.detalle.set(detalle);
    });
  }

  protected emitir(): void {
    const ordenId = this.ordenElegida();
    if (!ordenId) {
      this.notificacion.advertencia('Seleccione la orden a cobrar.');
      return;
    }

    this.procesando.set(true);

    this.servicio
      .crear({
        ordenId,
        nitRazonSocial: this.nueva.nitRazonSocial.trim() || null,
      })
      .subscribe({
        next: (proforma) => {
          this.notificacion.exito(`Proforma ${proforma.proformaId} emitida.`);
          if (this.descargarAlEmitir) this.descargarPdf(proforma);

          this.procesando.set(false);
          this.panelNueva.set(false);
          this.recargar();
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
        this.recargar();
      },
      error: () => {
        this.procesando.set(false);
        this.porAnular.set(null);
      },
    });
  }
}

/** Minúsculas y sin tildes, para buscar "maria" y encontrar "María". */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
