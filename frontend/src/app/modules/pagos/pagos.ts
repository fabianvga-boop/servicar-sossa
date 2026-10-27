import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

import { ETIQUETAS, EstadoProforma, MetodoPago } from '../../core/models/enums';
import { Proforma, Pago } from '../../core/models/finanzas.model';
import { ProformasService, PagosService } from '../../core/services/finanzas.service';
import { NotificacionService } from '../../core/services/notificacion.service';
import { Confirmacion } from '../../shared/components/confirmacion';
import { EstadoTabla } from '../../shared/components/estado-tabla';
import { Modal } from '../../shared/components/modal';
import { Paginador } from '../../shared/components/paginador';
import { OpcionSelector, SelectorBusqueda } from '../../shared/components/selector-busqueda';
import { Atajo } from '../../shared/directives/atajo';
import { BolivianosPipe } from '../../shared/pipes/bolivianos.pipe';

/** USU037 — registro de pagos de clientes. */
@Component({
  selector: 'app-pagos',
  imports: [
    FormsModule,
    DatePipe,
    Modal,
    Confirmacion,
    EstadoTabla,
    Paginador,
    SelectorBusqueda,
    Atajo,
    BolivianosPipe,
  ],
  templateUrl: './pagos.html',
})
export class Pagos {
  private readonly servicio = inject(PagosService);
  private readonly proformasService = inject(ProformasService);
  private readonly notificacion = inject(NotificacionService);
  private readonly ruta = inject(ActivatedRoute);

  /** Llega desde la orden ("Cobrar en caja"): abre el cobro de esa proforma. */
  private proformaPorCobrar = this.ruta.snapshot.queryParamMap.get('proformaId');

  protected readonly pagos = signal<Pago[]>([]);
  protected readonly proformas = signal<Proforma[]>([]);
  protected readonly cargando = signal(true);
  protected readonly metodoFiltro = signal('');
  protected readonly procesando = signal(false);

  protected readonly pagina = signal(1);
  protected readonly tamanoPagina = signal(20);
  protected readonly totalRegistros = signal(0);
  protected readonly totalPaginas = signal(0);

  protected readonly panelNuevo = signal(false);
  protected readonly porRevertir = signal<Pago | null>(null);

  protected nuevo = this.pagoVacio();

  protected readonly metodos = Object.entries(ETIQUETAS.metodoPago).map(([valor, etiqueta]) => ({
    valor: Number(valor) as MetodoPago,
    etiqueta,
  }));

  /** Solo tiene sentido cobrar proformas emitidas con saldo pendiente. */
  protected readonly proformasCobrables = computed(() =>
    this.proformas().filter((f) => f.estado === EstadoProforma.Emitida && !f.estaSaldada),
  );

  /**
   * Método y no `computed`: `nuevo` es un objeto común (no un signal), así
   * que un computed quedaba con la primera proforma que vio y el monto no se
   * completaba al elegir otra.
   */
  protected proformaElegida(): Proforma | null {
    return this.proformas().find((f) => f.proformaId === this.nuevo.proformaId) ?? null;
  }

  /** Lo que quedará debiendo el cliente después de un pago a cuenta. */
  protected saldoQueQueda(): number {
    const saldo = this.proformaElegida()?.saldoPendiente ?? 0;
    return Math.max(0, Math.round((saldo - (this.nuevo.monto ?? 0)) * 100) / 100);
  }

  /** El saldo va en el detalle: es el dato que decide cuánto se cobra. */
  protected readonly opcionesProforma = computed<OpcionSelector[]>(() =>
    this.proformasCobrables().map((f) => ({
      valor: f.proformaId,
      etiqueta: `${f.proformaId} — ${f.nombreCliente}`,
      detalle: `saldo Bs ${f.saldoPendiente.toFixed(2)}`,
    })),
  );

  constructor() {
    this.cargar();
    this.cargarProformas();
  }

  protected cargar(): void {
    this.cargando.set(true);

    const metodo = this.metodoFiltro();

    this.servicio
      .getAll({
        metodoPago: metodo === '' ? undefined : (Number(metodo) as MetodoPago),
        pagina: this.pagina(),
        tamanoPagina: this.tamanoPagina(),
      })
      .subscribe({
        next: (resultado) => {
          this.pagos.set(resultado.items);
          this.totalRegistros.set(resultado.totalRegistros);
          this.totalPaginas.set(resultado.totalPaginas);
          this.cargando.set(false);
        },
        error: () => this.cargando.set(false),
      });
  }

  private cargarProformas(): void {
    this.proformasService
      .getAll({ estado: EstadoProforma.Emitida, tamanoPagina: 500 })
      .subscribe((resultado) => {
        this.proformas.set(resultado.items);

        // Una sola vez: si se llegó con ?proformaId=…, abrir su cobro.
        const id = this.proformaPorCobrar;
        this.proformaPorCobrar = null;
        if (id && this.proformasCobrables().some((f) => f.proformaId === id)) {
          this.abrirNuevo();
          this.nuevo.proformaId = id;
          this.onProformaSeleccionada();
        }
      });
  }

  protected onFiltrarMetodo(valor: string): void {
    this.metodoFiltro.set(valor);
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

  protected etiquetaMetodo(metodo: MetodoPago): string {
    return ETIQUETAS.metodoPago[metodo];
  }

  private pagoVacio() {
    return {
      proformaId: '',
      /** Total: cancela todo el saldo. A cuenta: paga una parte y queda saldo. */
      tipo: 'total' as 'total' | 'cuenta',
      monto: null as number | null,
      metodoPago: MetodoPago.Efectivo,
      referencia: '',
    };
  }

  protected abrirNuevo(): void {
    this.nuevo = this.pagoVacio();
    this.panelNuevo.set(true);
  }

  /** Al elegir la proforma se propone el pago total, con el saldo ya cargado. */
  protected onProformaSeleccionada(): void {
    this.elegirTipo('total');
  }

  /** Total: el monto es el saldo y no se edita. A cuenta: se escribe cuánto paga. */
  protected elegirTipo(tipo: 'total' | 'cuenta'): void {
    this.nuevo.tipo = tipo;
    this.nuevo.monto = tipo === 'total' ? (this.proformaElegida()?.saldoPendiente ?? null) : null;
  }

  protected registrar(): void {
    const proforma = this.proformaElegida();
    const monto = this.nuevo.monto ?? 0;

    if (!proforma) {
      this.notificacion.advertencia('Seleccione la proforma que se cobra.');
      return;
    }

    if (this.nuevo.tipo === 'cuenta' && (monto <= 0 || monto >= proforma.saldoPendiente)) {
      this.notificacion.advertencia(
        monto >= proforma.saldoPendiente
          ? 'Ese monto cubre todo el saldo: elija “Pago total”.'
          : 'Indique cuánto paga el cliente a cuenta.',
      );
      return;
    }

    this.procesando.set(true);

    this.servicio
      .crear({
        proformaId: proforma.proformaId,
        monto: this.nuevo.tipo === 'total' ? proforma.saldoPendiente : monto,
        metodoPago: Number(this.nuevo.metodoPago) as MetodoPago,
        referencia: this.nuevo.referencia || null,
      })
      .subscribe({
        next: (pago) => {
          this.notificacion.exito(
            pago.saldoPendienteProforma <= 0
              ? `Pago total registrado: la proforma ${proforma.proformaId} queda saldada.`
              : `Pago a cuenta registrado. Saldo pendiente: Bs ${pago.saldoPendienteProforma.toFixed(2)}.`,
          );
          this.procesando.set(false);
          this.panelNuevo.set(false);
          this.cargar();
          this.cargarProformas();
        },
        error: () => this.procesando.set(false),
      });
  }

  protected revertir(): void {
    const pago = this.porRevertir();
    if (!pago) return;

    this.procesando.set(true);

    this.servicio.revertir(pago.pagoId).subscribe({
      next: (respuesta) => {
        this.notificacion.exito(respuesta.mensaje ?? 'Pago revertido.');
        this.procesando.set(false);
        this.porRevertir.set(null);
        this.cargar();
        this.cargarProformas();
      },
      error: () => {
        this.procesando.set(false);
        this.porRevertir.set(null);
      },
    });
  }
}
