import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { EstadoPago, EstadoUsuario } from '../../core/models/enums';
import { Comision, ComisionConfig, ResumenComisiones } from '../../core/models/finanzas.model';
import { Usuario } from '../../core/models/personas.model';
import { ContadoresService } from '../../core/services/contadores.service';
import { ComisionesService } from '../../core/services/finanzas.service';
import { NotificacionService } from '../../core/services/notificacion.service';
import { PreferenciasService } from '../../core/services/preferencias.service';
import { UsuariosService } from '../../core/services/usuarios.service';
import { Confirmacion } from '../../shared/components/confirmacion';
import { EstadoTabla } from '../../shared/components/estado-tabla';
import { InsigniaEstado } from '../../shared/components/insignia-estado';
import { Modal } from '../../shared/components/modal';
import { OpcionSelector, SelectorBusqueda } from '../../shared/components/selector-busqueda';
import { BolivianosPipe } from '../../shared/pipes/bolivianos.pipe';

type Pestania = 'comisiones' | 'resumen' | 'config';

const CLAVE_FILTRO = 'comisiones.estadoPago';

/** USU031-USU034 — comisiones de mecánicos. */
@Component({
  selector: 'app-comisiones',
  imports: [
    FormsModule,
    DatePipe,
    Modal,
    Confirmacion,
    EstadoTabla,
    InsigniaEstado,
    SelectorBusqueda,
    BolivianosPipe,
  ],
  templateUrl: './comisiones.html',
})
export class Comisiones {
  private readonly servicio = inject(ComisionesService);
  private readonly usuariosService = inject(UsuariosService);
  private readonly notificacion = inject(NotificacionService);
  private readonly preferencias = inject(PreferenciasService);
  private readonly contadores = inject(ContadoresService);

  protected readonly pestania = signal<Pestania>('comisiones');

  protected readonly comisiones = signal<Comision[]>([]);
  protected readonly resumen = signal<ResumenComisiones[]>([]);
  protected readonly configuraciones = signal<ComisionConfig[]>([]);
  protected readonly mecanicos = signal<Usuario[]>([]);

  protected readonly cargando = signal(true);
  protected readonly procesando = signal(false);
  protected readonly estadoFiltro = signal('');

  /** Comisiones marcadas para liquidar en lote. */
  protected readonly seleccionadas = signal<Set<string>>(new Set());

  /** Comisión cuyo detalle de servicios está desplegado en la tabla. */
  protected readonly expandida = signal<string | null>(null);

  protected readonly panelConfig = signal(false);
  protected readonly porPagar = signal<Comision | null>(null);
  protected readonly porPagarLote = signal(false);

  protected config = { mecanicoId: '', porcentaje: 0 };

  /** Adelantos ya entregados al mecánico, a descontar en la liquidación. */
  protected adelanto = 0;

  protected readonly EstadoPago = EstadoPago;

  protected readonly pendientes = computed(() =>
    this.comisiones().filter((c) => c.estadoPago === EstadoPago.Pendiente),
  );

  protected readonly totalSeleccionado = computed(() => {
    const ids = this.seleccionadas();
    return this.comisiones()
      .filter((c) => ids.has(c.comisionId))
      .reduce((suma, c) => suma + c.monto, 0);
  });

  /**
   * Nombre del mecánico si toda la selección es de uno solo; null si hay varios.
   * El adelanto solo puede descontarse cuando la planilla es de un único mecánico.
   */
  protected readonly mecanicoUnicoSeleccionado = computed<string | null>(() => {
    const ids = this.seleccionadas();
    const elegidas = this.comisiones().filter((c) => ids.has(c.comisionId));
    if (elegidas.length === 0) return null;
    const mecanicos = new Set(elegidas.map((c) => c.mecanicoId));
    return mecanicos.size === 1 ? elegidas[0].nombreMecanico : null;
  });

  protected readonly opcionesMecanico = computed<OpcionSelector[]>(() =>
    this.mecanicos().map((m) => ({
      valor: m.usuarioId,
      etiqueta: m.nombreCompleto,
      detalle: m.usuarioId,
    })),
  );

  constructor() {
    this.estadoFiltro.set(this.preferencias.leer(CLAVE_FILTRO, ''));

    this.cargar();

    this.usuariosService.getAll().subscribe((lista) =>
      // El administrador (dueño) también genera comisión cuando trabaja un
      // vehículo (con porcentaje 100), así que puede configurarse su porcentaje.
      this.mecanicos.set(
        lista.filter(
          (u) =>
            (u.nombreRol === 'Mecanico' || u.nombreRol === 'Administrador') &&
            u.estado === EstadoUsuario.Activo,
        ),
      ),
    );
  }

  protected cargar(): void {
    this.cargando.set(true);

    const estado = this.estadoFiltro();

    this.servicio
      .getAll({ estadoPago: estado === '' ? undefined : (Number(estado) as EstadoPago) })
      .subscribe({
        next: (lista) => {
          this.comisiones.set(lista);
          this.cargando.set(false);
        },
        error: () => this.cargando.set(false),
      });

    this.servicio.getResumen().subscribe((lista) => this.resumen.set(lista));
    this.servicio.getConfiguraciones().subscribe((lista) => this.configuraciones.set(lista));
  }

  protected cambiarPestania(valor: Pestania): void {
    this.pestania.set(valor);
  }

  protected onFiltrarEstado(valor: string): void {
    this.estadoFiltro.set(valor);
    this.preferencias.guardar(CLAVE_FILTRO, valor);
    this.seleccionadas.set(new Set());
    this.cargar();
  }

  // --- Selección para el pago por lote -------------------------------------

  protected estaSeleccionada(comisionId: string): boolean {
    return this.seleccionadas().has(comisionId);
  }

  protected alternarSeleccion(comisionId: string): void {
    this.seleccionadas.update((actual) => {
      const nueva = new Set(actual);
      nueva.has(comisionId) ? nueva.delete(comisionId) : nueva.add(comisionId);
      return nueva;
    });
  }

  protected alternarDetalle(comisionId: string): void {
    this.expandida.update((actual) => (actual === comisionId ? null : comisionId));
  }

  protected seleccionarTodasPendientes(): void {
    const pendientes = this.pendientes().map((c) => c.comisionId);

    this.seleccionadas.update((actual) =>
      actual.size === pendientes.length ? new Set() : new Set(pendientes),
    );
  }

  // --- Pago (USU034) -------------------------------------------------------

  protected pagar(): void {
    const comision = this.porPagar();
    if (!comision) return;

    this.procesando.set(true);

    this.servicio.pagar(comision.comisionId).subscribe({
      next: () => {
        this.notificacion.exito('Comisión marcada como pagada.');
        this.procesando.set(false);
        this.porPagar.set(null);
        this.cargar();
        // Bajó el pendiente: la insignia del menú debe reflejarlo.
        this.contadores.refrescar();
      },
      error: () => {
        this.procesando.set(false);
        this.porPagar.set(null);
      },
    });
  }

  protected abrirPagarLote(): void {
    this.adelanto = 0;
    this.porPagarLote.set(true);
  }

  protected pagarLote(): void {
    const ids = [...this.seleccionadas()];
    if (ids.length === 0) return;

    // El adelanto solo se envía si la planilla es de un único mecánico.
    const adelanto = this.mecanicoUnicoSeleccionado() ? this.adelanto || 0 : 0;

    this.procesando.set(true);

    this.servicio.pagarLote(ids, adelanto).subscribe({
      next: (res) => {
        const mensaje =
          res.adelantoDescontado > 0
            ? `Liquidación pagada: neto Bs ${res.netoPagado.toFixed(2)} ` +
              `(bruto Bs ${res.totalBruto.toFixed(2)} − adelanto Bs ${res.adelantoDescontado.toFixed(2)}).`
            : `${res.cantidadComisiones} comisión(es) liquidadas por Bs ${res.netoPagado.toFixed(2)}.`;
        this.notificacion.exito(mensaje);
        this.procesando.set(false);
        this.porPagarLote.set(false);
        this.adelanto = 0;
        this.seleccionadas.set(new Set());
        this.cargar();
        this.contadores.refrescar();
      },
      error: () => {
        this.procesando.set(false);
        this.porPagarLote.set(false);
      },
    });
  }

  // --- Configuración (USU031) ----------------------------------------------

  protected abrirConfig(mecanicoId = '', porcentaje = 0): void {
    this.config = { mecanicoId, porcentaje };
    this.panelConfig.set(true);
  }

  protected guardarConfig(): void {
    if (!this.config.mecanicoId) {
      this.notificacion.advertencia('Seleccione el mecánico.');
      return;
    }

    this.procesando.set(true);

    this.servicio
      .establecerPorcentaje(this.config.mecanicoId, this.config.porcentaje)
      .subscribe({
        next: () => {
          this.notificacion.exito('Porcentaje de comisión guardado.');
          this.procesando.set(false);
          this.panelConfig.set(false);
          this.cargar();
        },
        error: () => this.procesando.set(false),
      });
  }
}
