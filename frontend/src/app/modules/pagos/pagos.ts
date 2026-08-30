import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ETIQUETAS, EstadoFactura, MetodoPago } from '../../core/models/enums';
import { Factura, Pago } from '../../core/models/finanzas.model';
import { FacturasService, PagosService } from '../../core/services/finanzas.service';
import { NotificacionService } from '../../core/services/notificacion.service';
import { Confirmacion } from '../../shared/components/confirmacion';
import { EstadoTabla } from '../../shared/components/estado-tabla';
import { Modal } from '../../shared/components/modal';
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
    SelectorBusqueda,
    Atajo,
    BolivianosPipe,
  ],
  templateUrl: './pagos.html',
})
export class Pagos {
  private readonly servicio = inject(PagosService);
  private readonly facturasService = inject(FacturasService);
  private readonly notificacion = inject(NotificacionService);

  protected readonly pagos = signal<Pago[]>([]);
  protected readonly facturas = signal<Factura[]>([]);
  protected readonly cargando = signal(true);
  protected readonly metodoFiltro = signal('');
  protected readonly procesando = signal(false);

  protected readonly panelNuevo = signal(false);
  protected readonly porRevertir = signal<Pago | null>(null);

  protected nuevo = {
    facturaId: '',
    monto: 0,
    metodoPago: MetodoPago.Efectivo,
    referencia: '',
  };

  protected readonly metodos = Object.entries(ETIQUETAS.metodoPago).map(([valor, etiqueta]) => ({
    valor: Number(valor) as MetodoPago,
    etiqueta,
  }));

  /** Solo tiene sentido cobrar facturas emitidas con saldo pendiente. */
  protected readonly facturasCobrables = computed(() =>
    this.facturas().filter((f) => f.estado === EstadoFactura.Emitida && !f.estaSaldada),
  );

  protected readonly facturaElegida = computed(() =>
    this.facturas().find((f) => f.facturaId === this.nuevo.facturaId) ?? null,
  );

  /** El saldo va en el detalle: es el dato que decide cuánto se cobra. */
  protected readonly opcionesFactura = computed<OpcionSelector[]>(() =>
    this.facturasCobrables().map((f) => ({
      valor: f.facturaId,
      etiqueta: `${f.facturaId} — ${f.nombreCliente}`,
      detalle: `saldo Bs ${f.saldoPendiente.toFixed(2)}`,
    })),
  );

  constructor() {
    this.cargar();
    this.cargarFacturas();
  }

  protected cargar(): void {
    this.cargando.set(true);

    const metodo = this.metodoFiltro();

    this.servicio
      .getAll({ metodoPago: metodo === '' ? undefined : (Number(metodo) as MetodoPago) })
      .subscribe({
        next: (lista) => {
          this.pagos.set(lista);
          this.cargando.set(false);
        },
        error: () => this.cargando.set(false),
      });
  }

  private cargarFacturas(): void {
    this.facturasService
      .getAll({ estado: EstadoFactura.Emitida })
      .subscribe((lista) => this.facturas.set(lista));
  }

  protected onFiltrarMetodo(valor: string): void {
    this.metodoFiltro.set(valor);
    this.cargar();
  }

  protected etiquetaMetodo(metodo: MetodoPago): string {
    return ETIQUETAS.metodoPago[metodo];
  }

  protected abrirNuevo(): void {
    this.nuevo = { facturaId: '', monto: 0, metodoPago: MetodoPago.Efectivo, referencia: '' };
    this.panelNuevo.set(true);
  }

  /** Propone el saldo completo: lo habitual es cobrar el total pendiente. */
  protected onFacturaSeleccionada(): void {
    this.nuevo.monto = this.facturaElegida()?.saldoPendiente ?? 0;
  }

  protected registrar(): void {
    if (!this.nuevo.facturaId || this.nuevo.monto <= 0) {
      this.notificacion.advertencia('Seleccione la factura e indique un monto mayor a cero.');
      return;
    }

    this.procesando.set(true);

    this.servicio
      .crear({
        facturaId: this.nuevo.facturaId,
        monto: this.nuevo.monto,
        metodoPago: Number(this.nuevo.metodoPago) as MetodoPago,
        referencia: this.nuevo.referencia || null,
      })
      .subscribe({
        next: (pago) => {
          this.notificacion.exito(
            pago.saldoPendienteFactura <= 0
              ? 'Pago registrado. La factura queda saldada.'
              : `Pago registrado. Saldo pendiente: Bs ${pago.saldoPendienteFactura.toFixed(2)}.`,
          );
          this.procesando.set(false);
          this.panelNuevo.set(false);
          this.cargar();
          this.cargarFacturas();
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
        this.cargarFacturas();
      },
      error: () => {
        this.procesando.set(false);
        this.porRevertir.set(null);
      },
    });
  }
}
