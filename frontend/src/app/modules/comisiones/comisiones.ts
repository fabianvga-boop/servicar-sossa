import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { EstadoPago, EstadoUsuario } from '../../core/models/enums';
import { Comision, ComisionConfig, ResumenComisiones } from '../../core/models/finanzas.model';
import { Usuario } from '../../core/models/personas.model';
import { Orden } from '../../core/models/taller.model';
import { AuthService } from '../../core/services/auth.service';
import { ContadoresService } from '../../core/services/contadores.service';
import { ComisionesService } from '../../core/services/finanzas.service';
import { NotificacionService } from '../../core/services/notificacion.service';
import { OrdenesService } from '../../core/services/ordenes.service';
import { UsuariosService } from '../../core/services/usuarios.service';
import { Cajon } from '../../shared/components/cajon';
import { Paginador } from '../../shared/components/paginador';
import { PaginacionLocal, TODOS_LOS_REGISTROS } from '../../shared/paginacion-local';
import { Confirmacion } from '../../shared/components/confirmacion';
import { EstadoTabla } from '../../shared/components/estado-tabla';
import { OpcionSelector, SelectorBusqueda } from '../../shared/components/selector-busqueda';
import { BolivianosPipe } from '../../shared/pipes/bolivianos.pipe';

/** Qué comisiones muestra el panel de un mecánico. */
type VistaPanel = 'pendientes' | 'pagadas' | 'todas';

/** Una tarjeta de mecánico: lo que se le debe y lo que ya se le pagó. */
interface TarjetaMecanico {
  mecanicoId: string;
  nombre: string;
  iniciales: string;
  porcentaje: number | null;
  pendiente: number;
  cantidadPendiente: number;
  pagado: number;
  /** "desde agosto": desde cuándo se le paga, o que todavía no se le pagó. */
  desde: string;
}

/** Una liquidación: lo que se le pagó a un mecánico en un mismo día. */
interface Liquidacion {
  clave: string;
  fecha: string;
  mecanico: string;
  cantidad: number;
  monto: number;
}

const nombreMes = (fecha: string) => new Date(fecha).toLocaleDateString('es-BO', { month: 'long' });

/**
 * USU031-USU034 — comisiones de mecánicos. Una tarjeta por mecánico con lo
 * que se le debe y lo que ya cobró; el detalle (servicio por servicio de cada
 * orden) y la liquidación, con el adelanto que ya recibió, van en el panel
 * lateral. El Mecánico entra en modo consulta (USU032): ve solo lo suyo, sin
 * liquidar ni cambiar porcentajes.
 */
@Component({
  selector: 'app-comisiones',
  imports: [
    FormsModule,
    RouterLink,
    DatePipe,
    Cajon,
    Paginador,
    Confirmacion,
    EstadoTabla,
    SelectorBusqueda,
    BolivianosPipe,
  ],
  templateUrl: './comisiones.html',
  styleUrl: './comisiones.css',
})
export class Comisiones {
  private readonly servicio = inject(ComisionesService);
  private readonly ordenesService = inject(OrdenesService);
  private readonly usuariosService = inject(UsuariosService);
  private readonly notificacion = inject(NotificacionService);
  private readonly contadores = inject(ContadoresService);
  private readonly auth = inject(AuthService);

  /** Administrador: gestiona todo. Mecánico: solo consulta sus comisiones. */
  protected readonly esAdmin = this.auth.esAdministrador;

  protected readonly resumen = signal<ResumenComisiones[]>([]);
  /** Todas las comisiones (el tope de 500 sobra para un taller). */
  protected readonly comisiones = signal<Comision[]>([]);
  protected readonly configuraciones = signal<ComisionConfig[]>([]);
  protected readonly mecanicos = signal<Usuario[]>([]);
  /** Órdenes por código: vehículo, cliente y fecha de cierre de cada comisión. */
  protected readonly ordenes = signal<ReadonlyMap<string, Orden>>(new Map());

  protected readonly cargando = signal(true);
  protected readonly procesando = signal(false);

  // --- Panel del mecánico -------------------------------------------------------
  protected readonly mecanicoAbierto = signal<string | null>(null);
  protected readonly vistaPanel = signal<VistaPanel>('pendientes');
  /** Comisiones marcadas para liquidar (al abrir, todas las pendientes). */
  protected readonly elegidas = signal<ReadonlySet<string>>(new Set());
  /** Adelanto que el mecánico ya recibió: se descuenta de lo que se le paga ahora. */
  protected readonly adelanto = signal(0);
  protected readonly porLiquidar = signal(false);

  // --- Panel de porcentajes ----------------------------------------------------------
  protected readonly panelPorcentajes = signal(false);
  protected config = { mecanicoId: '', porcentaje: 0 };

  protected readonly EstadoPago = EstadoPago;

  protected readonly tarjetas = computed<TarjetaMecanico[]>(() =>
    this.resumen().map((r) => {
      const suyas = this.comisiones().filter((c) => c.mecanicoId === r.mecanicoId);
      const fechasPago = suyas
        .filter((c) => c.estadoPago === EstadoPago.Pagado && c.fechaPago)
        .map((c) => c.fechaPago!)
        .sort();

      return {
        mecanicoId: r.mecanicoId,
        nombre: r.nombreMecanico,
        iniciales: this.iniciales(r.nombreMecanico),
        porcentaje: r.porcentajeConfigurado ?? null,
        pendiente: r.totalPendiente,
        cantidadPendiente: suyas.filter((c) => c.estadoPago === EstadoPago.Pendiente).length,
        pagado: r.totalPagado,
        desde: fechasPago.length ? `desde ${nombreMes(fechasPago[0])}` : 'sin pagos todavía',
      };
    }),
  );

  protected readonly seleccion = computed(
    () => this.tarjetas().find((t) => t.mecanicoId === this.mecanicoAbierto()) ?? null,
  );

  /** Las comisiones del mecánico abierto, las más nuevas primero. */
  private readonly delMecanico = computed(() =>
    this.comisiones()
      .filter((c) => c.mecanicoId === this.mecanicoAbierto())
      .sort((a, b) => b.fechaCalculo.localeCompare(a.fechaCalculo)),
  );

  protected readonly pendientesDelMecanico = computed(() =>
    this.delMecanico().filter((c) => c.estadoPago === EstadoPago.Pendiente),
  );

  protected readonly comisionesPanel = computed(() => {
    const vista = this.vistaPanel();
    return this.delMecanico().filter(
      (c) =>
        vista === 'todas' ||
        (vista === 'pendientes') === (c.estadoPago === EstadoPago.Pendiente),
    );
  });

  protected readonly totalElegido = computed(() =>
    this.pendientesDelMecanico()
      .filter((c) => this.elegidas().has(c.comisionId))
      .reduce((suma, c) => suma + c.monto, 0),
  );

  protected readonly aPagar = computed(() => Math.max(0, this.totalElegido() - (this.adelanto() || 0)));

  /** Lo pagado, agrupado por día y mecánico: las últimas seis liquidaciones. */
  protected readonly liquidaciones = computed<Liquidacion[]>(() => {
    const grupos = new Map<string, Liquidacion>();

    for (const c of this.comisiones()) {
      if (c.estadoPago !== EstadoPago.Pagado || !c.fechaPago) continue;

      const dia = c.fechaPago.slice(0, 10);
      const clave = `${dia}|${c.mecanicoId}`;
      const grupo = grupos.get(clave) ?? {
        clave,
        fecha: c.fechaPago,
        mecanico: c.nombreMecanico,
        cantidad: 0,
        monto: 0,
      };
      grupo.cantidad++;
      grupo.monto += c.monto;
      grupos.set(clave, grupo);
    }

    return [...grupos.values()].sort((a, b) => b.fecha.localeCompare(a.fecha));
  });

  /** De a 10, la más reciente arriba: las viejas siguen a mano para consultas. */
  protected readonly paginacionLiquidaciones = new PaginacionLocal(() => this.liquidaciones(), undefined, 10);

  protected readonly opcionesMecanico = computed<OpcionSelector[]>(() =>
    this.mecanicos().map((m) => ({
      valor: m.usuarioId,
      etiqueta: m.nombreCompleto,
      detalle: m.usuarioId,
    })),
  );

  constructor() {
    this.cargar();

    // El vehículo y el cliente de cada comisión salen de su orden.
    this.ordenesService
      .getAll()
      .pipe(catchError(() => of([] as Orden[])))
      .subscribe((lista) => this.ordenes.set(new Map(lista.map((o) => [o.ordenId, o]))));

    // La lista de mecánicos solo sirve para configurar porcentajes.
    if (!this.esAdmin()) return;

    this.usuariosService.getAll(undefined, 1, TODOS_LOS_REGISTROS).subscribe((resultado) =>
      // El administrador (dueño) también genera comisión cuando trabaja un
      // vehículo (con porcentaje 100), así que puede configurarse su porcentaje.
      this.mecanicos.set(
        resultado.items.filter(
          (u) =>
            (u.nombreRol === 'Mecanico' || u.nombreRol === 'Administrador') &&
            u.estado === EstadoUsuario.Activo,
        ),
      ),
    );
  }

  protected cargar(): void {
    this.cargando.set(true);

    // Para el mecánico, la API devuelve solo lo suyo.
    this.servicio.getResumen().subscribe((lista) => this.resumen.set(lista));
    this.servicio.getAll({ pagina: 1, tamanoPagina: TODOS_LOS_REGISTROS }).subscribe({
      next: (resultado) => {
        this.comisiones.set(resultado.items);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });

    if (this.esAdmin()) {
      this.servicio.getConfiguraciones().subscribe((lista) => this.configuraciones.set(lista));
    }
  }

  /** Iniciales para el avatar del mecánico: solo presentación. */
  protected iniciales(nombre: string | null | undefined): string {
    const partes = (nombre ?? '').trim().split(/\s+/).filter(Boolean);
    if (partes.length === 0) return '—';

    return partes.length === 1
      ? partes[0].slice(0, 2).toUpperCase()
      : (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
  }

  // --- Panel del mecánico -------------------------------------------------------

  /** Abre el panel con lo pendiente ya elegido para liquidar (si hay). */
  protected abrirMecanico(mecanicoId: string): void {
    this.panelPorcentajes.set(false);
    this.mecanicoAbierto.set(mecanicoId);
    this.adelanto.set(0);

    const pendientes = this.pendientesDelMecanico();
    this.vistaPanel.set(pendientes.length > 0 ? 'pendientes' : 'todas');
    this.elegidas.set(new Set(pendientes.map((c) => c.comisionId)));
  }

  protected cerrarMecanico(): void {
    this.mecanicoAbierto.set(null);
  }

  protected alternarElegida(comisionId: string): void {
    this.elegidas.update((actual) => {
      const nueva = new Set(actual);
      nueva.has(comisionId) ? nueva.delete(comisionId) : nueva.add(comisionId);
      return nueva;
    });
  }

  /** "Toyota Rav4 · 6792UHD", o solo la placa si la orden no está a mano. */
  protected vehiculoDe(comision: Comision): string {
    const orden = this.ordenes().get(comision.ordenId);
    return orden ? `${orden.descripcionVehiculo} · ${comision.placaVehiculo}` : comision.placaVehiculo;
  }

  /** "Cerrada el 27/10/2026 · Jhon Lara" o "Pagada el …". */
  protected detalleDe(comision: Comision): string {
    const orden = this.ordenes().get(comision.ordenId);
    const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-BO');
    const partes = [
      comision.estadoPago === EstadoPago.Pagado && comision.fechaPago
        ? `Pagada el ${fecha(comision.fechaPago)}`
        : `Calculada el ${fecha(orden?.fechaCierre ?? comision.fechaCalculo)}`,
      orden?.nombreCliente,
    ];
    return partes.filter(Boolean).join(' · ');
  }

  /**
   * Lo que le toca al mecánico por un servicio: su parte del monto, en
   * proporción al precio (monto × precio / suma de los servicios).
   */
  protected comisionServicio(comision: Comision, precio: number): number {
    const suma = comision.detalle.reduce((total, d) => total + d.precio, 0);
    return suma > 0 ? (comision.monto * precio) / suma : 0;
  }

  protected onAdelanto(valor: number | string | null): void {
    const numero = Number(valor);
    this.adelanto.set(Number.isFinite(numero) && numero > 0 ? numero : 0);
  }

  // --- Liquidación (USU034) ---------------------------------------------------

  protected pedirLiquidacion(): void {
    if (this.elegidas().size === 0) {
      this.notificacion.advertencia('Elija al menos una comisión para liquidar.');
      return;
    }
    if ((this.adelanto() || 0) > this.totalElegido()) {
      this.notificacion.advertencia('El adelanto no puede ser mayor que lo que se liquida.');
      return;
    }
    this.porLiquidar.set(true);
  }

  protected liquidar(): void {
    const ids = this.pendientesDelMecanico()
      .filter((c) => this.elegidas().has(c.comisionId))
      .map((c) => c.comisionId);
    if (ids.length === 0) return;

    this.procesando.set(true);

    this.servicio.pagarLote(ids, this.adelanto() || 0).subscribe({
      next: (res) => {
        const mensaje =
          res.adelantoDescontado > 0
            ? `Liquidación pagada: neto Bs ${res.netoPagado.toFixed(2)} ` +
              `(bruto Bs ${res.totalBruto.toFixed(2)} − adelanto Bs ${res.adelantoDescontado.toFixed(2)}).`
            : `${res.cantidadComisiones} comisión(es) liquidadas por Bs ${res.netoPagado.toFixed(2)}.`;
        this.notificacion.exito(mensaje);
        this.procesando.set(false);
        this.porLiquidar.set(false);
        this.mecanicoAbierto.set(null);
        this.cargar();
        // Bajó el pendiente: la insignia del menú debe reflejarlo.
        this.contadores.refrescar();
      },
      error: () => {
        this.procesando.set(false);
        this.porLiquidar.set(false);
      },
    });
  }

  // --- Porcentajes (USU031) ----------------------------------------------------

  protected abrirPorcentajes(): void {
    this.mecanicoAbierto.set(null);
    this.config = { mecanicoId: '', porcentaje: 0 };
    this.panelPorcentajes.set(true);
  }

  protected cambiarPorcentaje(cfg: ComisionConfig): void {
    this.config = { mecanicoId: cfg.mecanicoId, porcentaje: cfg.porcentaje };
    setTimeout(() => document.getElementById('porcentajeConfig')?.focus());
  }

  protected guardarConfig(): void {
    if (!this.config.mecanicoId) {
      this.notificacion.advertencia('Seleccione el mecánico.');
      return;
    }

    this.procesando.set(true);

    this.servicio.establecerPorcentaje(this.config.mecanicoId, this.config.porcentaje).subscribe({
      next: () => {
        this.notificacion.exito('Porcentaje de comisión guardado.');
        this.procesando.set(false);
        this.config = { mecanicoId: '', porcentaje: 0 };
        this.cargar();
      },
      error: () => this.procesando.set(false),
    });
  }
}
