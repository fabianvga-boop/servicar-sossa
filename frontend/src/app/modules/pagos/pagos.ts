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
import { Paginador } from '../../shared/components/paginador';
import { PaginacionLocal, TODOS_LOS_REGISTROS } from '../../shared/paginacion-local';
import { OpcionSelector, SelectorBusqueda } from '../../shared/components/selector-busqueda';
import { coincidePorPalabras } from '../../shared/busqueda';
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
    Paginador,
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

  /** Filtro por fechas (vacío = todas), en fecha local yyyy-mm-dd. */
  protected readonly desde = signal('');
  protected readonly hasta = signal('');
  protected readonly rangosRapidos = [
    { clave: 'hoy', etiqueta: 'Hoy' },
    { clave: 'semana', etiqueta: 'Esta semana' },
    { clave: 'mes', etiqueta: 'Este mes' },
  ] as const;
  protected readonly rangoActivo = signal<string | null>(null);

  /** Los pagos dentro de las fechas elegidas; sobre estos cuentan los chips de método. */
  protected readonly enFechas = computed(() => {
    const desde = this.desde();
    const hasta = this.hasta();
    const buscar = this.buscar();
    return this.pagos().filter((p) => {
      const dia = fechaLocal(new Date(p.fechaPago));
      if ((desde && dia < desde) || (hasta && dia > hasta)) return false;
      return coincidePorPalabras(buscar, p.pagoId, p.proformaId, p.nombreCliente, p.referencia ?? '');
    });
  });

  /** Búsqueda por código, proforma, cliente o referencia. */
  protected readonly buscar = signal('');

  protected readonly visibles = computed(() => {
    const metodo = this.metodoVista();
    return metodo === null ? this.enFechas() : this.enFechas().filter((p) => p.metodoPago === metodo);
  });

  protected readonly totalVisible = computed(() => this.visibles().reduce((suma, p) => suma + p.monto, 0));

  /** Solo los métodos que aparecen en los pagos, con su cantidad. */
  protected readonly chipsMetodo = computed(() =>
    this.todosLosMetodos
      .map((m) => ({ ...m, cuenta: this.enFechas().filter((p) => p.metodoPago === m.valor).length }))
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
  protected readonly paginacion = new PaginacionLocal(
    () => this.visibles(),
    () => [this.metodoVista(), this.desde(), this.hasta(), this.buscar()],
  );

  protected readonly porRevertir = signal<Pago | null>(null);

  protected nuevo = this.pagoVacio();

  /** Todos, para filtrar: pagos viejos pueden tener transferencia o tarjeta. */
  private readonly todosLosMetodos = Object.entries(ETIQUETAS.metodoPago).map(([valor, etiqueta]) => ({
    valor: Number(valor) as MetodoPago,
    etiqueta,
  }));

  /** Al cobrar, igual que en el punto de venta: efectivo, QR u otro. */
  protected readonly metodos = [MetodoPago.Efectivo, MetodoPago.QR, MetodoPago.Otro].map((valor) => ({
    valor,
    etiqueta: ETIQUETAS.metodoPago[valor],
  }));

  private readonly bs = new BolivianosPipe();

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
      detalle: `saldo ${this.bs.transform(f.saldoPendiente)}`,
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
      .getAll({ pagina: 1, tamanoPagina: TODOS_LOS_REGISTROS })
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
      .getAll({ estado: EstadoProforma.Emitida, tamanoPagina: TODOS_LOS_REGISTROS })
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

  /** True si el monto escrito es mayor a lo que debe el cliente. */
  protected excedeSaldo(): boolean {
    const proforma = this.proformaElegida();
    return !!proforma && (this.nuevo.monto ?? 0) > proforma.saldoPendiente + 0.001;
  }

  /** Cómo se llama la referencia según el método: lo que hay que anotar. */
  protected etiquetaReferencia(): string {
    switch (Number(this.nuevo.metodoPago) as MetodoPago) {
      case MetodoPago.QR:
        return 'Referencia del QR';
      case MetodoPago.Otro:
        return 'Cómo pagó';
      default:
        return 'Referencia';
    }
  }

  protected ayudaReferencia(): string {
    switch (Number(this.nuevo.metodoPago) as MetodoPago) {
      case MetodoPago.QR:
        return 'El número del comprobante del QR.';
      case MetodoPago.Otro:
        return 'Por ejemplo: transferencia, tarjeta o cheque, con su número.';
      default:
        return 'Opcional.';
    }
  }

  protected marcadorReferencia(): string {
    return Number(this.nuevo.metodoPago) === MetodoPago.Otro
      ? 'Transferencia 48213'
      : 'Número de transacción o comprobante';
  }

  protected onFecha(campo: 'desde' | 'hasta', valor: string): void {
    this.rangoActivo.set(null);
    (campo === 'desde' ? this.desde : this.hasta).set(valor);
  }

  /** Hoy, esta semana (desde el lunes) o este mes, hasta hoy. */
  protected aplicarRango(clave: 'hoy' | 'semana' | 'mes'): void {
    this.rangoActivo.set(clave);
    const ahora = new Date();
    let inicio = new Date(ahora);
    if (clave === 'semana') inicio.setDate(ahora.getDate() - ((ahora.getDay() + 6) % 7));
    if (clave === 'mes') inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    this.desde.set(fechaLocal(inicio));
    this.hasta.set(fechaLocal(ahora));
  }

  protected limpiarFechas(): void {
    this.rangoActivo.set(null);
    this.desde.set('');
    this.hasta.set('');
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
        'El monto supera el saldo pendiente de ' + this.bs.transform(proforma.saldoPendiente) + '.',
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
              : `Pago a cuenta registrado. Saldo pendiente: ${this.bs.transform(pago.saldoPendienteProforma)}.`,
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

/** Fecha local yyyy-mm-dd (no UTC: en Bolivia, desde las 20:00 el UTC ya es mañana). */
function fechaLocal(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}
