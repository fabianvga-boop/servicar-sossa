import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import {
  EstadoDiag,
  EstadoOrden,
  EstadoPago,
  EstadoProforma,
  EstadoServicioOrden,
  RespuestaCliente,
} from '../../core/models/enums';
import { Comision, Pago, Proforma } from '../../core/models/finanzas.model';
import { Repuesto } from '../../core/models/inventario.model';
import { Diagnostico, Orden } from '../../core/models/taller.model';
import { AuthService } from '../../core/services/auth.service';
import { ComisionesService, PagosService, ProformasService } from '../../core/services/finanzas.service';
import { RepuestosService } from '../../core/services/inventario.service';
import { OrdenesService } from '../../core/services/ordenes.service';
import { DiagnosticosService } from '../../core/services/taller.service';
import { Esqueleto } from '../../shared/components/esqueleto';
import { Placa } from '../../shared/components/placa';
import { estiloOrden } from '../../shared/estilo-estado';
import { BolivianosPipe } from '../../shared/pipes/bolivianos.pipe';

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const DIA_MS = 24 * 60 * 60 * 1000;

/** Una tarea de "Pendientes de acción": qué hay que hacer, con quién y el botón. */
interface Tarea {
  clave: string;
  codigo: string;
  titulo: string;
  detalle: string;
  monto: number | null;
  accion: string;
  ruta: string[];
  parametros?: Record<string, string>;
  /** La primera tarea de cobro va con el botón rojo: es lo que más urge. */
  principal: boolean;
  tono: 'roja' | 'naranja' | 'azul' | 'verde';
  /** Para ordenar: primero cobrar, después saldos, presupuestos y trabajo en curso. */
  prioridad: number;
  fecha: string;
}

/**
 * Panel de inicio: "Lo que toca hoy". Cuatro números del día, la cola de
 * tareas con su botón (cobrar, registrar un pago, la respuesta de un
 * presupuesto, abrir una orden), las órdenes recientes, el stock por reponer
 * y las comisiones por liquidar. El mecánico ve solo lo suyo.
 */
@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, Esqueleto, Placa, BolivianosPipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  protected readonly estiloOrden = estiloOrden;

  private readonly ordenesService = inject(OrdenesService);
  private readonly repuestosService = inject(RepuestosService);
  private readonly comisionesService = inject(ComisionesService);
  private readonly proformasService = inject(ProformasService);
  private readonly pagosService = inject(PagosService);
  private readonly diagnosticosService = inject(DiagnosticosService);
  protected readonly auth = inject(AuthService);

  protected readonly esAdmin = this.auth.esAdministrador();

  protected readonly cargando = signal(true);
  protected readonly ordenes = signal<Orden[]>([]);
  private readonly proformas = signal<Proforma[]>([]);
  private readonly pagosMes = signal<Pago[]>([]);
  private readonly diagnosticos = signal<Diagnostico[]>([]);
  protected readonly stockBajo = signal<Repuesto[]>([]);
  protected readonly stockBajoTotal = signal(0);
  protected readonly comisionesPendientes = signal<Comision[]>([]);
  /** Servicios hechos de cada orden en proceso: se piden aparte, una vez. */
  private readonly avances = signal(new Map<string, { hechos: number; total: number; actual: string | null }>());
  private readonly avancesPedidos = new Set<string>();

  // --- Encabezado --------------------------------------------------------------------

  protected readonly saludo = computed(() => {
    const hora = new Date().getHours();
    const momento = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
    const nombre = this.auth.nombreCompleto().split(' ')[0];
    return nombre ? `${momento}, ${nombre}` : momento;
  });

  protected readonly mesActual = MESES[new Date().getMonth()];

  // --- Indicadores -----------------------------------------------------------------

  private readonly activas = computed(() =>
    this.ordenes().filter((o) =>
      [EstadoOrden.Abierta, EstadoOrden.EnProceso, EstadoOrden.Finalizada].includes(o.estado),
    ),
  );

  protected readonly cuentaActivas = computed(() => {
    const activas = this.activas();
    const partes = [
      [activas.filter((o) => o.estado === EstadoOrden.EnProceso).length, 'en proceso'],
      [activas.filter((o) => o.estado === EstadoOrden.Abierta).length, 'en espera'],
      [activas.filter((o) => o.estado === EstadoOrden.Finalizada).length, 'para entregar'],
    ] as const;
    return {
      total: activas.length,
      pie: partes.filter(([n]) => n > 0).map(([n, texto]) => `${n} ${texto}`).join(' · ') || 'Ninguna en el taller',
    };
  });

  private readonly vigentes = computed(
    () =>
      new Map(
        this.proformas()
          .filter((p) => p.estado === EstadoProforma.Emitida)
          .map((p) => [p.ordenId, p]),
      ),
  );

  /** Trabajo terminado que todavía no tiene proforma: lo que falta cobrar. */
  private readonly sinProforma = computed(() =>
    this.ordenes()
      .filter(
        (o) =>
          (o.estado === EstadoOrden.Finalizada || o.estado === EstadoOrden.Cerrada) &&
          o.total > 0 &&
          !this.vigentes().has(o.ordenId),
      )
      .sort((a, b) => (b.fechaCierre ?? b.fechaCreacion).localeCompare(a.fechaCierre ?? a.fechaCreacion)),
  );

  protected readonly porCobrar = computed(() => ({
    monto: this.sinProforma().reduce((suma, o) => suma + o.total, 0),
    cantidad: this.sinProforma().length,
  }));

  private readonly conSaldo = computed(() =>
    [...this.vigentes().values()]
      .filter((p) => !p.estaSaldada && p.saldoPendiente > 0)
      .sort((a, b) => b.fechaEmision.localeCompare(a.fechaEmision)),
  );

  protected readonly cobradoMes = computed(() => ({
    monto: this.pagosMes().reduce((suma, p) => suma + p.monto, 0),
    cantidad: this.pagosMes().length,
  }));

  protected readonly comisiones = computed(() => {
    const lista = this.comisionesPendientes();
    return {
      monto: lista.reduce((suma, c) => suma + c.monto, 0),
      cantidad: lista.length,
      mecanicos: new Set(lista.map((c) => c.mecanicoId)).size,
    };
  });

  // --- Inicio del mecánico: lo que está haciendo, arriba y en grande -------------

  /** La orden en proceso del mecánico (la API ya le devuelve solo las suyas). */
  protected readonly trabajoAhora = computed(() => {
    if (this.esAdmin) return null;
    const orden = this.activas().find((o) => o.estado === EstadoOrden.EnProceso);
    if (!orden) return null;
    const avance = this.avances().get(orden.ordenId);
    return {
      orden,
      actual: avance?.actual ?? null,
      hechos: avance?.hechos ?? 0,
      total: avance?.total ?? 0,
      porcentaje: avance && avance.total > 0 ? Math.round((avance.hechos / avance.total) * 100) : 0,
    };
  });

  protected readonly otrasOrdenes = computed(() =>
    this.activas().filter((o) => o.ordenId !== this.trabajoAhora()?.orden.ordenId),
  );

  protected textoOrdenMecanico(o: Orden): string {
    if (o.estado === EstadoOrden.Abierta) return 'Espera que la inicie el administrador';
    if (o.estado === EstadoOrden.Finalizada) return 'Terminada, lista para entregar';
    const avance = this.avances().get(o.ordenId);
    return avance?.actual ? `Sigue: ${avance.actual}` : 'En proceso';
  }

  // --- Pendientes de acción ----------------------------------------------------------

  protected readonly tareas = computed<Tarea[]>(() => {
    const lista: Tarea[] = [];

    if (this.esAdmin) {
      for (const o of this.sinProforma()) {
        lista.push({
          clave: 'cobrar' + o.ordenId,
          codigo: o.ordenId,
          titulo: `Cobrar a ${o.nombreCliente}`,
          detalle: `${o.descripcionVehiculo} · ${o.placaVehiculo} — ${
            o.estado === EstadoOrden.Cerrada ? `cerrada ${cuando(o.fechaCierre ?? o.fechaCreacion)}` : 'finalizada'
          }, sin proforma`,
          monto: o.total,
          accion: 'Emitir proforma',
          ruta: ['/proformas'],
          parametros: { ordenId: o.ordenId },
          principal: false,
          tono: 'roja',
          prioridad: 0,
          fecha: o.fechaCierre ?? o.fechaCreacion,
        });
      }

      for (const p of this.conSaldo()) {
        lista.push({
          clave: 'saldo' + p.proformaId,
          codigo: p.proformaId,
          titulo: 'Saldo pendiente',
          detalle: `${p.nombreCliente} · ${p.placaVehiculo} — emitida ${cuando(p.fechaEmision)}`,
          monto: p.saldoPendiente,
          accion: 'Registrar pago',
          ruta: ['/pagos'],
          parametros: { proformaId: p.proformaId },
          principal: false,
          tono: 'naranja',
          prioridad: 1,
          fecha: p.fechaEmision,
        });
      }
    }

    for (const d of this.diagnosticos()) {
      if (d.estado === EstadoDiag.Anulado || d.ordenId) continue;
      if (d.respuestaCliente !== RespuestaCliente.Pendiente) continue;
      lista.push({
        clave: 'diag' + d.diagnosticoId,
        codigo: d.diagnosticoId,
        titulo: 'Presupuesto sin respuesta',
        detalle: `${d.nombreCliente} · ${d.descripcionVehiculo} — registrado ${cuando(d.fecha)}`,
        monto: d.montoEstimado ?? null,
        accion: 'Registrar respuesta',
        ruta: ['/diagnosticos'],
        parametros: { responder: d.diagnosticoId },
        principal: false,
        tono: 'azul',
        prioridad: 2,
        fecha: d.fecha,
      });
    }

    for (const o of this.activas()) {
      const mecanicos = o.mecanicos.map((m) => m.nombreMecanico).join(', ');
      const avance = this.avances().get(o.ordenId);
      let titulo = 'En espera de empezar';
      let tono: Tarea['tono'] = 'naranja';
      if (o.estado === EstadoOrden.EnProceso) {
        titulo =
          avance && avance.total > 0
            ? `En proceso, ${avance.hechos} de ${avance.total} ${avance.total === 1 ? 'servicio' : 'servicios'}`
            : 'En proceso';
      } else if (o.estado === EstadoOrden.Finalizada) {
        // Si ya está en "Cobrar a…", no se repite.
        if (this.esAdmin && this.sinProforma().some((s) => s.ordenId === o.ordenId)) continue;
        titulo = 'Lista para entregar';
        tono = 'verde';
      }
      lista.push({
        clave: 'orden' + o.ordenId,
        codigo: o.ordenId,
        titulo,
        detalle: `${o.nombreCliente} · ${o.descripcionVehiculo} ${o.placaVehiculo}${mecanicos ? ' — ' + mecanicos : ''}`,
        monto: o.total,
        accion: 'Abrir',
        ruta: ['/ordenes', o.ordenId],
        principal: false,
        tono,
        prioridad: 3,
        fecha: o.fechaCreacion,
      });
    }

    lista.sort((a, b) => a.prioridad - b.prioridad || b.fecha.localeCompare(a.fecha));
    if (lista[0]?.prioridad === 0) lista[0].principal = true;
    return lista;
  });

  protected readonly presupuestosPendientes = computed(
    () => this.tareas().filter((t) => t.tono === 'azul').length,
  );

  /** La cola se muestra corta; el resto, a pedido. */
  protected readonly verTodasTareas = signal(false);
  protected readonly tareasVisibles = computed(() =>
    this.verTodasTareas() ? this.tareas() : this.tareas().slice(0, 6),
  );

  /** Las más recientes primero; el backend ya las devuelve ordenadas. */
  protected readonly recientes = computed(() => this.ordenes().slice(0, 5));

  // --- Stock por reponer --------------------------------------------------------------

  protected readonly stockVisible = computed(() =>
    [...this.stockBajo()].sort((a, b) => a.stockActual - b.stockActual).slice(0, 5),
  );

  /** Cuánto llena la barra: el stock contra el doble del mínimo (un mínimo "sano"). */
  protected nivelStock(r: Repuesto): number {
    if (r.stockActual <= 0) return 2;
    const tope = Math.max(r.stockMinimo * 2, 1);
    return Math.min(100, Math.max(8, Math.round((r.stockActual / tope) * 100)));
  }

  constructor() {
    this.cargar();

    // El avance ("1 de 2 servicios") de las órdenes en proceso, una vez cada una.
    effect(() => {
      for (const o of this.activas()) {
        if (o.estado !== EstadoOrden.EnProceso || this.avancesPedidos.has(o.ordenId)) continue;
        this.avancesPedidos.add(o.ordenId);
        this.ordenesService
          .getById(o.ordenId)
          .pipe(catchError(() => of(null)))
          .subscribe((detalle) => {
            if (!detalle) return;
            const hechos = detalle.servicios.filter((s) => s.estado === EstadoServicioOrden.Completado).length;
            // El que está en curso o, si no hay, el próximo pendiente.
            const actual =
              detalle.servicios.find((s) => s.estado === EstadoServicioOrden.EnProceso) ??
              detalle.servicios.find((s) => s.estado === EstadoServicioOrden.Pendiente);
            this.avances.update((mapa) =>
              new Map(mapa).set(o.ordenId, { hechos, total: detalle.servicios.length, actual: actual?.nombreServicio ?? null }),
            );
          });
      }
    });
  }

  private cargar(): void {
    // El mecánico solo ve sus propias órdenes y comisiones: la API ya se las
    // filtra. Cada pedido va protegido para que un error parcial no vacíe el panel.
    let pendientes = this.esAdmin ? 6 : 3;
    const listo = () => {
      pendientes -= 1;
      if (pendientes === 0) this.cargando.set(false);
    };

    this.ordenesService
      .getAll(this.esAdmin ? {} : { mecanicoId: this.auth.usuarioId() ?? undefined })
      .pipe(catchError(() => of([] as Orden[])))
      .subscribe((lista) => {
        this.ordenes.set(lista);
        listo();
      });

    this.comisionesService
      .getAll({ estadoPago: EstadoPago.Pendiente, tamanoPagina: 500 })
      .pipe(catchError(() => of(null)))
      .subscribe((r) => {
        this.comisionesPendientes.set(r?.items ?? []);
        listo();
      });

    this.diagnosticosService
      .getAll(this.esAdmin ? { tamanoPagina: 500 } : { mecanicoId: this.auth.usuarioId() ?? undefined, tamanoPagina: 500 })
      .pipe(catchError(() => of(null)))
      .subscribe((r) => {
        this.diagnosticos.set(r?.items ?? []);
        listo();
      });

    if (!this.esAdmin) return;

    this.proformasService
      .getAll({ estado: EstadoProforma.Emitida, tamanoPagina: 500 })
      .pipe(catchError(() => of(null)))
      .subscribe((r) => {
        this.proformas.set(r?.items ?? []);
        listo();
      });

    // Los pagos llegan del más nuevo al más viejo: se filtra el mes en la hora
    // local. (El filtro por fecha del backend falla con fechas sin zona.)
    const hoy = new Date();
    this.pagosService
      .getAll({ tamanoPagina: 500 })
      .pipe(catchError(() => of(null)))
      .subscribe((r) => {
        this.pagosMes.set(
          (r?.items ?? []).filter((p) => {
            const fecha = new Date(p.fechaPago);
            return fecha.getMonth() === hoy.getMonth() && fecha.getFullYear() === hoy.getFullYear();
          }),
        );
        listo();
      });

    this.repuestosService
      .getAll({ soloStockBajo: true, tamanoPagina: 500 })
      .pipe(catchError(() => of(null)))
      .subscribe((r) => {
        this.stockBajo.set(r?.items ?? []);
        this.stockBajoTotal.set(r?.totalRegistros ?? 0);
        listo();
      });
  }

  protected textoEstado(estado: EstadoOrden): string {
    return ['En espera', 'En proceso', 'Finalizada', 'Cerrada', 'Cancelada'][estado] ?? '';
  }

}

/** "hoy 18:02", "ayer", "hace 3 días" o la fecha. */
function cuando(iso: string): string {
  const fecha = new Date(iso);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const dia = new Date(fecha);
  dia.setHours(0, 0, 0, 0);
  const dias = Math.round((hoy.getTime() - dia.getTime()) / DIA_MS);

  if (dias <= 0) {
    return `hoy ${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`;
  }
  if (dias === 1) return 'ayer';
  if (dias < 7) return `hace ${dias} días`;
  return `el ${String(fecha.getDate()).padStart(2, '0')}/${String(fecha.getMonth() + 1).padStart(2, '0')}/${fecha.getFullYear()}`;
}
