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
import { Cajon } from '../../shared/components/cajon';
import { OpcionSelector, SelectorBusqueda } from '../../shared/components/selector-busqueda';
import { Atajo } from '../../shared/directives/atajo';
import { BolivianosPipe } from '../../shared/pipes/bolivianos.pipe';

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** USU037 — registro de pagos de clientes. */
@Component({
  selector: 'app-pagos',
  imports: [
    FormsModule,
    DatePipe,
    Cajon,
    Confirmacion,
    EstadoTabla,
    SelectorBusqueda,
    Atajo,
    BolivianosPipe,
  ],
  templateUrl: './pagos.html',
  styleUrl: './pagos.css',
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
  protected readonly procesando = signal(false);

  /** Método elegido en los filtros; null = todos. */
  protected readonly metodoVista = signal<MetodoPago | null>(null);

  protected readonly visibles = computed(() => {
    const metodo = this.metodoVista();
    return metodo === null ? this.pagos() : this.pagos().filter((p) => p.metodoPago === metodo);
  });

  /** Solo los métodos que aparecen en los pagos, con su cantidad. */
  protected readonly chipsMetodo = computed(() =>
    this.metodos
      .map((m) => ({ ...m, cuenta: this.pagos().filter((p) => p.metodoPago === m.valor).length }))
      .filter((m) => m.cuenta > 0),
  );

  protected readonly mesActual = MESES[new Date().getMonth()];

  protected readonly cobradoMes = computed(() => {
    const hoy = new Date();
    const delMes = this.pagos().filter((p) => {
      const fecha = new Date(p.fechaPago);
      return fecha.getMonth() === hoy.getMonth() && fecha.getFullYear() === hoy.getFullYear();
    });
    return { monto: delMes.reduce((suma, p) => suma + p.monto, 0), cantidad: delMes.length };
  });

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

    // Todos de una vez: el filtro por método y el resumen del mes son en pantalla.
    this.servicio
      .getAll({ pagina: 1, tamanoPagina: 500 })
      .subscribe({
        next: (resultado) => {
          this.pagos.set(resultado.items);
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


  protected etiquetaMetodo(metodo: MetodoPago): string {
    return ETIQUETAS.metodoPago[metodo];
  }

  private pagoVacio() {
    return {
      proformaId: '',
      /** Todo el saldo, la mitad o un monto escrito a mano. */
      rapido: 'todo' as 'todo' | 'mitad' | 'otro',
      monto: null as number | null,
      metodoPago: MetodoPago.Efectivo,
      referencia: '',
    };
  }

  protected abrirNuevo(): void {
    this.nuevo = this.pagoVacio();
    this.panelNuevo.set(true);
  }

  /** Al elegir la proforma se propone todo el saldo. */
  protected onProformaSeleccionada(): void {
    this.elegirRapido('todo');
  }

  protected elegirRapido(rapido: 'todo' | 'mitad' | 'otro'): void {
    const saldo = this.proformaElegida()?.saldoPendiente ?? 0;
    this.nuevo.rapido = rapido;
    if (rapido === 'todo') this.nuevo.monto = saldo || null;
    else if (rapido === 'mitad') this.nuevo.monto = saldo ? Math.round((saldo / 2) * 100) / 100 : null;
    else {
      this.nuevo.monto = null;
      setTimeout(() => document.getElementById('montoPago')?.focus());
    }
  }

  /** Escribir un monto a mano deja marcado el atajo que corresponda. */
  protected onMontoEscrito(): void {
    const saldo = this.proformaElegida()?.saldoPendiente ?? 0;
    const monto = this.nuevo.monto ?? 0;
    const mitad = Math.round((saldo / 2) * 100) / 100;
    this.nuevo.rapido = monto === saldo ? 'todo' : monto === mitad ? 'mitad' : 'otro';
  }

  /** Cómo se llama la referencia según el método: lo que hay que anotar. */
  protected etiquetaReferencia(): string {
    switch (Number(this.nuevo.metodoPago) as MetodoPago) {
      case MetodoPago.QR:
        return 'Referencia del QR';
      case MetodoPago.Transferencia:
        return 'N.º de transferencia';
      case MetodoPago.Tarjeta:
        return 'N.º de comprobante de la tarjeta';
      default:
        return 'Referencia';
    }
  }

  protected registrar(): void {
    const proforma = this.proformaElegida();
    const monto = this.nuevo.monto ?? 0;

    if (!proforma) {
      this.notificacion.advertencia('Seleccione la proforma que se cobra.');
      return;
    }

    if (monto <= 0) {
      this.notificacion.advertencia('Indique cuánto paga el cliente.');
      return;
    }

    if (monto > proforma.saldoPendiente + 0.001) {
      this.notificacion.advertencia(
        'El monto supera el saldo pendiente de Bs ' + proforma.saldoPendiente.toFixed(2) + '.',
      );
      return;
    }

    this.procesando.set(true);

    this.servicio
      .crear({
        proformaId: proforma.proformaId,
        monto,
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
