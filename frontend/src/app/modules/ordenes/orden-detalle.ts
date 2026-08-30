import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import {
  ETIQUETAS,
  EstadoOrden,
  EstadoServicioOrden,
  EstadoUsuario,
  OrigenRepuesto,
} from '../../core/models/enums';
import { Repuesto } from '../../core/models/inventario.model';
import { Usuario } from '../../core/models/personas.model';
import {
  OrdenDetalle as OrdenDetalleModel,
  OrdenRepuesto,
  OrdenServicio,
  TipoServicio,
} from '../../core/models/taller.model';
import { AuthService } from '../../core/services/auth.service';
import { ContadoresService } from '../../core/services/contadores.service';
import { RepuestosService } from '../../core/services/inventario.service';
import { NotificacionService } from '../../core/services/notificacion.service';
import { OrdenesService } from '../../core/services/ordenes.service';
import { TiposServicioService } from '../../core/services/taller.service';
import { UsuariosService } from '../../core/services/usuarios.service';
import { Confirmacion } from '../../shared/components/confirmacion';
import { InsigniaEstado } from '../../shared/components/insignia-estado';
import { Migas } from '../../shared/components/migas';
import { Modal } from '../../shared/components/modal';
import { Paso, Pasos } from '../../shared/components/pasos';
import { OpcionSelector, SelectorBusqueda } from '../../shared/components/selector-busqueda';
import { BolivianosPipe } from '../../shared/pipes/bolivianos.pipe';

/** Un requisito que la orden debe cumplir para poder avanzar de etapa. */
interface Requisito {
  etiqueta: string;
  cumplido: boolean;
  ayuda: string;
}

/** USU022-USU025 — detalle de la orden: mecánicos, servicios, repuestos y cierre. */
@Component({
  selector: 'app-orden-detalle',
  imports: [
    FormsModule,
    RouterLink,
    DatePipe,
    Modal,
    Confirmacion,
    InsigniaEstado,
    Migas,
    Pasos,
    SelectorBusqueda,
    BolivianosPipe,
  ],
  templateUrl: './orden-detalle.html',
  styleUrl: './orden-detalle.css',
})
export class OrdenDetalle {
  /** Llega de la ruta `/ordenes/:id` vía withComponentInputBinding. */
  readonly id = input.required<string>();

  private readonly servicio = inject(OrdenesService);
  private readonly usuariosService = inject(UsuariosService);
  private readonly tiposServicioService = inject(TiposServicioService);
  private readonly repuestosService = inject(RepuestosService);
  private readonly notificacion = inject(NotificacionService);
  private readonly contadores = inject(ContadoresService);
  protected readonly auth = inject(AuthService);

  protected readonly orden = signal<OrdenDetalleModel | null>(null);
  protected readonly cargando = signal(true);
  protected readonly procesando = signal(false);

  protected readonly mecanicos = signal<Usuario[]>([]);
  protected readonly catalogo = signal<TipoServicio[]>([]);
  protected readonly repuestos = signal<Repuesto[]>([]);

  // Diálogos
  protected readonly panelMecanico = signal(false);
  protected readonly panelServicio = signal(false);
  protected readonly panelRepuesto = signal(false);
  protected readonly porCerrar = signal(false);
  protected readonly porCancelar = signal(false);

  // Formularios simples: son de un solo uso y no justifican un FormGroup.
  protected mecanicoSeleccionado = '';
  protected nuevoServicio = {
    delCatalogo: true,
    servicioId: '',
    nombreLibre: '',
    mecanicoId: '',
    descripcion: '',
    precio: null as number | null,
  };
  protected nuevoRepuesto = {
    origen: OrigenRepuesto.Inventario,
    repuestoId: '',
    descripcion: '',
    cantidad: 1,
    precioUnitario: null as number | null,
  };

  protected readonly EstadoOrden = EstadoOrden;
  protected readonly EstadoServicioOrden = EstadoServicioOrden;
  protected readonly OrigenRepuesto = OrigenRepuesto;
  protected readonly ETIQUETAS = ETIQUETAS;
  protected readonly origenesRepuesto = [
    OrigenRepuesto.Inventario,
    OrigenRepuesto.ClienteTrae,
    OrigenRepuesto.CompraExterna,
  ];

  protected readonly migas = computed(() => [
    { etiqueta: 'Órdenes de trabajo', ruta: '/ordenes' },
    { etiqueta: this.orden()?.ordenId ?? 'Detalle' },
  ]);

  /** Mecánicos y datos generales se pueden tocar mientras la orden siga abierta. */
  protected readonly editable = computed(() => {
    const estado = this.orden()?.estado;
    return estado === EstadoOrden.Abierta || estado === EstadoOrden.EnProceso;
  });

  /**
   * Servicios y repuestos solo se cargan una vez iniciado el trabajo: mientras
   * la orden está Abierta el administrador solo arma el equipo de mecánicos.
   * Espeja `EsEditableParaTrabajo` del backend.
   */
  protected readonly editableTrabajo = computed(() => this.orden()?.estado === EstadoOrden.EnProceso);

  /**
   * Marcar el avance de un servicio se permite también con la orden Finalizada:
   * es registro de trabajo, no un cambio en el contenido de la orden. Espeja la
   * regla del backend y evita que una orden finalizada con servicios pendientes
   * quede sin forma de completarse ni cerrarse.
   */
  protected readonly puedeAvanzarServicios = computed(() => {
    const estado = this.orden()?.estado;
    return (
      estado === EstadoOrden.Abierta ||
      estado === EstadoOrden.EnProceso ||
      estado === EstadoOrden.Finalizada
    );
  });

  protected readonly puedeGestionar = computed(() => this.auth.esAdministrador());

  /** El backend rechaza el cierre si queda algún servicio sin completar. */
  protected readonly serviciosPendientes = computed(
    () =>
      this.orden()?.servicios.filter((s) => s.estado !== EstadoServicioOrden.Completado).length ??
      0,
  );

  // --- Guía visual del flujo -----------------------------------------------

  /** Etapas de la orden como stepper; Cancelada queda fuera del recorrido. */
  protected readonly pasos = computed<Paso[]>(() => {
    const estado = this.orden()?.estado ?? EstadoOrden.Abierta;
    const etapas: { etiqueta: string; valor: EstadoOrden }[] = [
      { etiqueta: 'Abierta', valor: EstadoOrden.Abierta },
      { etiqueta: 'En proceso', valor: EstadoOrden.EnProceso },
      { etiqueta: 'Finalizada', valor: EstadoOrden.Finalizada },
      { etiqueta: 'Cerrada', valor: EstadoOrden.Cerrada },
    ];

    // Una orden cancelada se congela donde estaba: ninguna etapa queda "actual".
    const cancelada = estado === EstadoOrden.Cancelada;

    return etapas.map((etapa) => ({
      etiqueta: etapa.etiqueta,
      completado: !cancelada && estado > etapa.valor,
      actual: !cancelada && estado === etapa.valor,
    }));
  });

  protected readonly cancelada = computed(() => this.orden()?.estado === EstadoOrden.Cancelada);

  /**
   * Requisitos de la etapa actual, en forma de checklist.
   *
   * Sin esto el usuario descubre lo que falta recién cuando el backend rechaza
   * la acción; acá lo ve antes de intentarlo.
   */
  protected readonly requisitos = computed<Requisito[]>(() => {
    const orden = this.orden();
    if (!orden) return [];

    switch (orden.estado) {
      case EstadoOrden.Abierta:
        return [
          {
            etiqueta: 'Asignar al menos un mecánico',
            cumplido: orden.mecanicos.length > 0,
            ayuda: 'El responsable del trabajo debe quedar registrado antes de empezar.',
          },
        ];

      case EstadoOrden.EnProceso:
        return [
          {
            etiqueta: 'Cargar los servicios ejecutados',
            cumplido: orden.servicios.length > 0,
            ayuda: 'Sin servicios la orden no factura nada ni genera comisiones.',
          },
          {
            etiqueta: 'Completar todos los servicios',
            cumplido: orden.servicios.length > 0 && this.serviciosPendientes() === 0,
            ayuda: 'Marque cada servicio como Completado a medida que termine.',
          },
        ];

      case EstadoOrden.Finalizada:
        return [
          {
            etiqueta: 'Completar todos los servicios',
            cumplido: this.serviciosPendientes() === 0,
            ayuda: 'El cierre calcula comisiones: exige el trabajo terminado.',
          },
        ];

      default:
        return [];
    }
  });

  protected readonly requisitosPendientes = computed(
    () => this.requisitos().filter((r) => !r.cumplido).length,
  );

  /**
   * Motivo por el que no se puede tocar el detalle, o cadena vacía si sí se
   * puede. Alimenta el `title` de los botones deshabilitados: un botón que
   * desaparece no enseña nada, uno gris con explicación sí.
   */
  protected readonly motivoBloqueoTrabajo = computed(() => {
    const estado = this.orden()?.estado;

    if (estado === EstadoOrden.Abierta)
      return 'Inicie el trabajo para poder cargar servicios y repuestos.';

    if (estado === EstadoOrden.EnProceso) return '';

    return `La orden está ${EstadoOrden[estado ?? EstadoOrden.Abierta]} y ya no admite cambios.`;
  });

  protected readonly motivoBloqueoMecanicos = computed(() =>
    this.editable() ? '' : 'La orden ya no admite cambios en el equipo de mecánicos.',
  );

  /** Mecánicos aún no asignados, para no ofrecer duplicados en el selector. */
  protected readonly mecanicosDisponibles = computed(() => {
    const asignados = new Set(this.orden()?.mecanicos.map((m) => m.mecanicoId) ?? []);
    return this.mecanicos().filter((m) => !asignados.has(m.usuarioId));
  });

  // --- Opciones para los selectores con búsqueda ---------------------------

  protected readonly opcionesMecanico = computed<OpcionSelector[]>(() =>
    this.mecanicosDisponibles().map((m) => ({
      valor: m.usuarioId,
      etiqueta: m.nombreCompleto,
      detalle: m.usuarioId,
    })),
  );

  protected readonly opcionesAsignados = computed<OpcionSelector[]>(
    () =>
      this.orden()?.mecanicos.map((m) => ({
        valor: m.mecanicoId,
        etiqueta: m.nombreMecanico,
      })) ?? [],
  );

  protected readonly opcionesCatalogo = computed<OpcionSelector[]>(() =>
    this.catalogo().map((s) => ({
      valor: s.servicioId,
      etiqueta: s.nombre,
      detalle: `Bs ${s.precioBase.toFixed(2)}`,
    })),
  );

  protected readonly opcionesRepuesto = computed<OpcionSelector[]>(() =>
    this.repuestos().map((r) => ({
      valor: r.repuestoId,
      etiqueta: r.nombre,
      detalle: `stock ${r.stockActual}`,
      deshabilitada: r.stockActual === 0,
      razonDeshabilitada: 'Sin stock disponible',
    })),
  );

  constructor() {
    // `id` es un input de ruta: Angular recién lo asigna después del
    // constructor, así que leerlo aquí directamente dispararía NG0950.
    // `effect()` espera a que el signal tenga valor y además recarga solo
    // si el usuario navega de una orden a otra sin recargar la página.
    effect(() => this.cargar(this.id()));

    if (this.auth.esAdministrador()) {
      this.usuariosService.getAll().subscribe((lista) =>
        // El administrador (dueño) también trabaja vehículos cuando el taller se
        // satura, así que ambos roles pueden asignarse como trabajadores.
        this.mecanicos.set(
          lista.filter(
            (u) =>
              (u.nombreRol === 'Mecanico' || u.nombreRol === 'Administrador') &&
              u.estado === EstadoUsuario.Activo,
          ),
        ),
      );
      this.tiposServicioService.getAll().subscribe((lista) => this.catalogo.set(lista));
      this.repuestosService.getAll().subscribe((lista) => this.repuestos.set(lista));
    }
  }

  private cargar(id: string): void {
    this.cargando.set(true);

    this.servicio.getById(id).subscribe({
      next: (orden) => {
        this.orden.set(orden);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  /** Todas las operaciones del detalle devuelven la orden completa actualizada. */
  private aplicar(mensaje: string) {
    return {
      next: (orden: OrdenDetalleModel) => {
        this.orden.set(orden);
        this.notificacion.exito(mensaje);
        this.procesando.set(false);
        this.cerrarPaneles();
        // Los badges de la barra lateral cuentan órdenes activas y stock bajo.
        this.contadores.refrescar();
      },
      error: () => this.procesando.set(false),
    };
  }

  /**
   * Igual que `aplicar`, pero el aviso ofrece deshacer. Se usa al quitar un
   * servicio o repuesto: la acción ya se ejecutó, y revertirla es volver a
   * crearlo con los mismos datos.
   */
  private aplicarConDeshacer(mensaje: string, revertir: () => void) {
    return {
      next: (orden: OrdenDetalleModel) => {
        this.orden.set(orden);
        this.notificacion.deshacer(mensaje, revertir);
        this.procesando.set(false);
        this.cerrarPaneles();
        this.contadores.refrescar();
      },
      error: () => this.procesando.set(false),
    };
  }

  private cerrarPaneles(): void {
    this.panelMecanico.set(false);
    this.panelServicio.set(false);
    this.panelRepuesto.set(false);
    this.porCerrar.set(false);
    this.porCancelar.set(false);
  }

  // --- Estado de la orden --------------------------------------------------

  protected iniciar(): void {
    this.procesando.set(true);
    this.servicio
      .cambiarEstado(this.id(), EstadoOrden.EnProceso)
      .subscribe(this.aplicar('Orden marcada en proceso. Ya puede cargar servicios y repuestos.'));
  }

  protected finalizar(): void {
    this.procesando.set(true);
    this.servicio
      .cambiarEstado(this.id(), EstadoOrden.Finalizada)
      .subscribe(this.aplicar('Orden finalizada. Ya se puede cerrar y facturar.'));
  }

  protected cerrarOrden(): void {
    this.procesando.set(true);
    this.servicio
      .cambiarEstado(this.id(), EstadoOrden.Cerrada)
      .subscribe(this.aplicar('Orden cerrada: stock descontado y comisiones calculadas.'));
  }

  protected cancelarOrden(): void {
    this.procesando.set(true);
    this.servicio
      .cambiarEstado(this.id(), EstadoOrden.Cancelada)
      .subscribe(this.aplicar('Orden cancelada.'));
  }

  // --- Mecánicos (USU022) --------------------------------------------------

  protected asignarMecanico(): void {
    if (!this.mecanicoSeleccionado) return;

    this.procesando.set(true);
    this.servicio
      .asignarMecanico(this.id(), this.mecanicoSeleccionado)
      .subscribe(this.aplicar('Mecánico asignado.'));

    this.mecanicoSeleccionado = '';
  }

  protected quitarMecanico(mecanicoId: string): void {
    this.procesando.set(true);

    this.servicio.quitarMecanico(this.id(), mecanicoId).subscribe(
      this.aplicarConDeshacer('Mecánico desasignado.', () => {
        this.procesando.set(true);
        this.servicio
          .asignarMecanico(this.id(), mecanicoId)
          .subscribe(this.aplicar('Se restauró la asignación del mecánico.'));
      }),
    );
  }

  // --- Servicios (USU023) --------------------------------------------------

  /**
   * Por lo general un solo mecánico trabaja el vehículo: se lo preselecciona
   * para no hacer elegir de nuevo a quien ya está asignado a la orden. Si hay
   * dos (el caso de saturación), queda el selector para indicar cuál hizo el
   * trabajo.
   */
  protected abrirPanelServicio(): void {
    const asignados = this.orden()?.mecanicos ?? [];

    this.nuevoServicio = {
      delCatalogo: true,
      servicioId: '',
      nombreLibre: '',
      mecanicoId: asignados.length === 1 ? asignados[0].mecanicoId : '',
      descripcion: '',
      precio: null,
    };

    this.panelServicio.set(true);
  }

  /** Al cambiar el origen se limpian los campos que dejan de aplicar. */
  protected cambiarOrigenServicio(delCatalogo: boolean): void {
    this.nuevoServicio.delCatalogo = delCatalogo;
    this.nuevoServicio.servicioId = '';
    this.nuevoServicio.nombreLibre = '';
    this.nuevoServicio.precio = null;
  }

  protected onServicioSeleccionado(servicioId: string): void {
    // Propone el precio base del catálogo; el usuario puede ajustarlo.
    const servicio = this.catalogo().find((s) => s.servicioId === servicioId);
    this.nuevoServicio.precio = servicio?.precioBase ?? null;
  }

  protected agregarServicio(): void {
    const { delCatalogo, servicioId, nombreLibre, mecanicoId, descripcion, precio } =
      this.nuevoServicio;

    if (!mecanicoId) {
      this.notificacion.advertencia('Seleccione el mecánico responsable.');
      return;
    }

    if (delCatalogo && !servicioId) {
      this.notificacion.advertencia('Seleccione el servicio del catálogo.');
      return;
    }

    if (!delCatalogo && !nombreLibre.trim()) {
      this.notificacion.advertencia('Describa el servicio realizado.');
      return;
    }

    if (!delCatalogo && (precio == null || precio <= 0)) {
      this.notificacion.advertencia('Indique el precio cobrado por el servicio.');
      return;
    }

    this.procesando.set(true);

    this.servicio
      .agregarServicio(this.id(), {
        servicioId: delCatalogo ? servicioId : null,
        nombreLibre: delCatalogo ? null : nombreLibre.trim(),
        mecanicoId,
        descripcion: descripcion || null,
        precio,
      })
      .subscribe(this.aplicar('Servicio agregado a la orden.'));

    this.nuevoServicio = {
      delCatalogo: true,
      servicioId: '',
      nombreLibre: '',
      mecanicoId: '',
      descripcion: '',
      precio: null,
    };
  }

  protected avanzarServicio(ordenServicioId: string, estado: EstadoServicioOrden): void {
    this.procesando.set(true);
    this.servicio
      .cambiarEstadoServicio(this.id(), ordenServicioId, estado)
      .subscribe(this.aplicar('Estado del servicio actualizado.'));
  }

  protected quitarServicio(servicio: OrdenServicio): void {
    this.procesando.set(true);

    this.servicio.quitarServicio(this.id(), servicio.ordenServicioId).subscribe(
      this.aplicarConDeshacer(`Se quitó «${servicio.nombreServicio}» de la orden.`, () => {
        this.procesando.set(true);
        this.servicio
          .agregarServicio(this.id(), {
            servicioId: servicio.servicioId ?? null,
            nombreLibre: servicio.servicioId ? null : servicio.nombreServicio,
            mecanicoId: servicio.mecanicoId,
            diagnosticoId: servicio.diagnosticoId ?? null,
            descripcion: servicio.descripcion ?? null,
            precio: servicio.precio,
          })
          .subscribe(this.aplicar('Servicio restaurado en la orden.'));
      }),
    );
  }

  // --- Repuestos -----------------------------------------------------------

  protected onRepuestoSeleccionado(repuestoId: string): void {
    const repuesto = this.repuestos().find((r) => r.repuestoId === repuestoId);
    this.nuevoRepuesto.precioUnitario = repuesto?.precioVenta ?? null;
  }

  /** Al cambiar el origen se limpian los campos que dejan de aplicar. */
  protected cambiarOrigenRepuesto(origen: OrigenRepuesto): void {
    this.nuevoRepuesto.origen = origen;
    this.nuevoRepuesto.repuestoId = '';
    this.nuevoRepuesto.descripcion = '';
    // El que trae el cliente no se cobra; los demás parten sin precio propuesto.
    this.nuevoRepuesto.precioUnitario = null;
  }

  protected agregarRepuesto(): void {
    const { origen, repuestoId, descripcion, cantidad, precioUnitario } = this.nuevoRepuesto;

    if (cantidad < 1) {
      this.notificacion.advertencia('Indique una cantidad válida.');
      return;
    }

    if (origen === OrigenRepuesto.Inventario && !repuestoId) {
      this.notificacion.advertencia('Seleccione el repuesto del inventario.');
      return;
    }

    if (origen !== OrigenRepuesto.Inventario && !descripcion.trim()) {
      this.notificacion.advertencia('Describa el repuesto que no proviene del inventario.');
      return;
    }

    if (origen === OrigenRepuesto.CompraExterna && (precioUnitario == null || precioUnitario <= 0)) {
      this.notificacion.advertencia('Indique el costo del repuesto de compra externa.');
      return;
    }

    this.procesando.set(true);

    this.servicio
      .agregarRepuesto(this.id(), {
        origen,
        repuestoId: origen === OrigenRepuesto.Inventario ? repuestoId : null,
        descripcion: origen === OrigenRepuesto.Inventario ? null : descripcion.trim(),
        cantidad,
        // El que trae el cliente va sin cargo; la compra externa a su costo.
        precioUnitario: origen === OrigenRepuesto.ClienteTrae ? 0 : precioUnitario,
      })
      .subscribe(this.aplicar('Repuesto agregado a la orden.'));

    this.nuevoRepuesto = {
      origen: OrigenRepuesto.Inventario,
      repuestoId: '',
      descripcion: '',
      cantidad: 1,
      precioUnitario: null,
    };
  }

  protected quitarRepuesto(consumo: OrdenRepuesto): void {
    this.procesando.set(true);

    this.servicio.quitarRepuesto(this.id(), consumo.ordenRepuestoId).subscribe(
      this.aplicarConDeshacer(`Se quitó «${consumo.nombreRepuesto}» de la orden.`, () => {
        this.procesando.set(true);
        this.servicio
          .agregarRepuesto(this.id(), {
            origen: consumo.origen,
            repuestoId: consumo.repuestoId ?? null,
            descripcion:
              consumo.origen === OrigenRepuesto.Inventario ? null : consumo.nombreRepuesto,
            cantidad: consumo.cantidad,
            precioUnitario: consumo.precioUnitario,
          })
          .subscribe(this.aplicar('Repuesto restaurado en la orden.'));
      }),
    );
  }
}
