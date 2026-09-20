import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

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

  protected nuevo = {
    proformaId: '',
    monto: 0,
    metodoPago: MetodoPago.Efectivo,
    referencia: '',
  };

  protected readonly metodos = Object.entries(ETIQUETAS.metodoPago).map(([valor, etiqueta]) => ({
    valor: Number(valor) as MetodoPago,
    etiqueta,
  }));

  /** Solo tiene sentido cobrar proformas emitidas con saldo pendiente. */
  protected readonly proformasCobrables = computed(() =>
    this.proformas().filter((f) => f.estado === EstadoProforma.Emitida && !f.estaSaldada),
  );

  protected readonly proformaElegida = computed(() =>
    this.proformas().find((f) => f.proformaId === this.nuevo.proformaId) ?? null,
  );

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
      .subscribe((resultado) => this.proformas.set(resultado.items));
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

  protected abrirNuevo(): void {
    this.nuevo = { proformaId: '', monto: 0, metodoPago: MetodoPago.Efectivo, referencia: '' };
    this.panelNuevo.set(true);
  }

  /** Propone el saldo completo: lo habitual es cobrar el total pendiente. */
  protected onProformaSeleccionada(): void {
    this.nuevo.monto = this.proformaElegida()?.saldoPendiente ?? 0;
  }

  protected registrar(): void {
    if (!this.nuevo.proformaId || this.nuevo.monto <= 0) {
      this.notificacion.advertencia('Seleccione la proforma e indique un monto mayor a cero.');
      return;
    }

    this.procesando.set(true);

    this.servicio
      .crear({
        proformaId: this.nuevo.proformaId,
        monto: this.nuevo.monto,
        metodoPago: Number(this.nuevo.metodoPago) as MetodoPago,
        referencia: this.nuevo.referencia || null,
      })
      .subscribe({
        next: (pago) => {
          this.notificacion.exito(
            pago.saldoPendienteProforma <= 0
              ? 'Pago registrado. La proforma queda saldada.'
              : `Pago registrado. Saldo pendiente: Bs ${pago.saldoPendienteProforma.toFixed(2)}.`,
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
