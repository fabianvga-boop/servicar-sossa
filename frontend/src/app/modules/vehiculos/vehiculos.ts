import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { EstadoCliente, EstadoDiag, EstadoOrden, RespuestaCliente } from '../../core/models/enums';
import { Cliente, Vehiculo } from '../../core/models/personas.model';
import { Diagnostico, Orden } from '../../core/models/taller.model';
import { urlArchivo } from '../../core/services/api-base';
import { AuthService } from '../../core/services/auth.service';
import { ClientesService } from '../../core/services/clientes.service';
import { NotificacionService } from '../../core/services/notificacion.service';
import { OrdenesService } from '../../core/services/ordenes.service';
import { PreferenciasService } from '../../core/services/preferencias.service';
import { DiagnosticosService } from '../../core/services/taller.service';
import { VehiculosService } from '../../core/services/vehiculos.service';
import { coincidePorPalabras } from '../../shared/busqueda';
import { Cajon } from '../../shared/components/cajon';
import { EstadoTabla } from '../../shared/components/estado-tabla';
import { Paginador } from '../../shared/components/paginador';
import { Placa } from '../../shared/components/placa';
import { OpcionSelector, SelectorBusqueda } from '../../shared/components/selector-busqueda';
import { PaginacionLocal, TODOS_LOS_REGISTROS } from '../../shared/paginacion-local';
import { detalleConNuevo } from '../../shared/recientes';
import { Atajo } from '../../shared/directives/atajo';
import { EnfocarError } from '../../shared/directives/enfocar-error';
import { SiTieneRol } from '../../shared/directives/si-tiene-rol';
import {
  COLORES_RAPIDOS,
  colorPunto,
  coloresSugeridos,
  marcasSugeridas,
  modelosSugeridos,
} from '../../shared/vehiculo-sugerencias';

const CLAVE_BUSCAR = 'vehiculos.buscar';

const ORDEN_ACTIVA = [EstadoOrden.Abierta, EstadoOrden.EnProceso, EstadoOrden.Finalizada];

/** Pasado este tiempo sin una orden conviene llamar al cliente (mantenimiento). */
const SEIS_MESES_MS = 182 * 24 * 60 * 60 * 1000;

type FiltroVehiculos = 'todos' | 'taller' | 'presupuesto' | 'sinVenir';

/** Cómo está el vehículo hoy: lo mismo que muestra la ficha del cliente. */
interface EstadoVehiculo {
  texto: string;
  tono: 'naranja' | 'azul' | 'verde' | 'gris';
}

/** Portada de la tarjeta: la primera foto del vehículo y cuántas tiene. */
interface Portada {
  url: string;
  cantidad: number;
}

/**
 * USU009-USU011 — gestión de vehículos. El historial, las fotos y el dibujo
 * con las zonas marcadas viven en la ficha de cada vehículo (/vehiculos/:id).
 *
 * La lista son tarjetas con la misma anatomía que las de Órdenes (foto con la
 * placa encima). Regla del sistema: lo que se reconoce por su foto (órdenes,
 * vehículos, productos, plantillas) va en tarjetas; los registros y
 * movimientos (diagnósticos, pagos, compras, auditoría…), en filas.
 */
@Component({
  selector: 'app-vehiculos',
  imports: [
    ReactiveFormsModule,
    DecimalPipe,
    Cajon,
    EstadoTabla,
    Paginador,
    SelectorBusqueda,
    Atajo,
    EnfocarError,
    SiTieneRol,
    Placa,
  ],
  templateUrl: './vehiculos.html',
  styleUrl: './vehiculos.css',
})
export class Vehiculos {
  private readonly servicio = inject(VehiculosService);
  private readonly clientesService = inject(ClientesService);
  private readonly ordenesService = inject(OrdenesService);
  private readonly diagnosticosService = inject(DiagnosticosService);
  private readonly fb = inject(FormBuilder);
  private readonly notificacion = inject(NotificacionService);
  private readonly preferencias = inject(PreferenciasService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);

  protected readonly vehiculos = signal<Vehiculo[]>([]);
  protected readonly clientes = signal<Cliente[]>([]);
  protected readonly cargando = signal(true);
  protected readonly buscar = signal('');
  protected readonly clienteFiltro = signal('');
  protected readonly filtro = signal<FiltroVehiculos>('todos');
  protected readonly guardando = signal(false);

  private readonly ordenes = signal<Orden[]>([]);
  private readonly diagnosticos = signal<Diagnostico[]>([]);

  /** Portadas pedidas solo para las tarjetas a la vista (una petición por vehículo). */
  private readonly portadas = signal(new Map<string, Portada | null>());
  private readonly portadasPedidas = new Set<string>();

  protected readonly urlArchivo = urlArchivo;

  protected readonly editando = signal<Vehiculo | null>(null);
  protected readonly formularioAbierto = signal(false);

  /**
   * "Editar" desde la ficha de un vehículo abre el formulario aquí; al guardar
   * o cerrar se vuelve a esa ficha, que es donde estaba quien lo pidió.
   */
  private volverAFicha: string | null = null;

  /** Espejo reactivo de la placa: alimenta la vista previa en vivo. */
  protected readonly placaActual = signal('');
  /** Espejo reactivo de la marca: acota los modelos sugeridos a esa marca. */
  protected readonly marcaActual = signal('');

  protected readonly COLORES_RAPIDOS = COLORES_RAPIDOS;
  protected readonly colorPunto = colorPunto;

  protected readonly formulario = this.fb.nonNullable.group({
    clienteId: ['', Validators.required],
    placa: ['', [Validators.required, Validators.maxLength(15)]],
    marca: ['', [Validators.required, Validators.maxLength(50)]],
    modelo: ['', [Validators.required, Validators.maxLength(50)]],
    anio: [null as number | null, [Validators.min(1900), Validators.max(2100)]],
    color: ['', Validators.maxLength(30)],
    numMotor: ['', Validators.maxLength(50)],
    numChasis: ['', Validators.maxLength(50)],
    kilometraje: [0, Validators.min(0)],
  });

  /** Escribir menos = elegir de la lista; ver `vehiculo-sugerencias`. */
  protected readonly marcasSugeridas = computed(() => marcasSugeridas(this.vehiculos()));
  protected readonly modelosSugeridos = computed(() =>
    modelosSugeridos(this.vehiculos(), this.marcaActual()),
  );
  protected readonly coloresSugeridos = computed(() => coloresSugeridos(this.vehiculos()));

  /** El taller puede tener cientos de clientes: un `<select>` no escala. */
  protected readonly opcionesCliente = computed<OpcionSelector[]>(() =>
    this.clientes().map((c) => ({
      valor: c.clienteId,
      etiqueta: c.razonSocial?.trim() || `${c.nombre} ${c.apellido ?? ''}`.trim(),
      // La lista ya viene con los más recientes primero; "Nuevo" lo hace evidente.
      detalle: detalleConNuevo(c.ciNit, c.fechaRegistro),
    })),
  );

  // --- Estado de cada vehículo (mismo criterio que la ficha del cliente) ----------

  /** Orden en curso de cada vehículo (la más reciente si hubiera dos). */
  private readonly ordenActiva = computed(() => {
    const mapa = new Map<string, Orden>();
    for (const o of this.ordenes()) {
      if (!ORDEN_ACTIVA.includes(o.estado)) continue;
      const otra = mapa.get(o.vehiculoId);
      if (!otra || o.fechaCreacion > otra.fechaCreacion) mapa.set(o.vehiculoId, o);
    }
    return mapa;
  });

  /** Diagnóstico con el presupuesto todavía sin respuesta del cliente. */
  private readonly diagnosticoPendiente = computed(() => {
    const mapa = new Map<string, Diagnostico>();
    for (const d of this.diagnosticos()) {
      if (d.estado === EstadoDiag.Anulado || d.ordenId) continue;
      if (d.respuestaCliente !== RespuestaCliente.Pendiente) continue;
      const otro = mapa.get(d.vehiculoId);
      if (!otro || d.fecha > otro.fecha) mapa.set(d.vehiculoId, d);
    }
    return mapa;
  });

  private readonly ultimaOrden = computed(() => {
    const mapa = new Map<string, Orden>();
    for (const o of this.ordenes()) {
      const otra = mapa.get(o.vehiculoId);
      if (!otra || o.fechaCreacion > otra.fechaCreacion) mapa.set(o.vehiculoId, o);
    }
    return mapa;
  });

  // --- Lista: buscar, filtrar y paginar en pantalla --------------------------------

  /** Lo que coincide con el buscador y el dueño elegido, antes de los chips. */
  private readonly coinciden = computed(() => {
    const texto = this.buscar();
    const cliente = this.clienteFiltro();
    return this.vehiculos().filter(
      (v) =>
        (!cliente || v.clienteId === cliente) &&
        coincidePorPalabras(
          texto,
          v.vehiculoId,
          v.placa,
          v.marca,
          v.modelo,
          v.nombreCliente,
          v.color,
          v.anio?.toString(),
        ),
    );
  });

  protected readonly cuentas = computed(() => {
    const lista = this.coinciden();
    return {
      todos: lista.length,
      taller: lista.filter((v) => this.pasaFiltro(v, 'taller')).length,
      presupuesto: lista.filter((v) => this.pasaFiltro(v, 'presupuesto')).length,
      sinVenir: lista.filter((v) => this.pasaFiltro(v, 'sinVenir')).length,
    };
  });

  protected readonly filtrados = computed(() =>
    this.coinciden().filter((v) => this.pasaFiltro(v, this.filtro())),
  );

  protected readonly paginacion = new PaginacionLocal(
    () => this.filtrados(),
    () => [this.buscar(), this.clienteFiltro(), this.filtro()],
  );

  constructor() {
    const parametros = this.ruta.snapshot.queryParamMap;

    // El panel de clientes enlaza aquí con ?clienteId=CLI-001 y el buscador
    // global con ?buscar=<placa>; sin parámetros se restaura el último criterio.
    this.clienteFiltro.set(parametros.get('clienteId') ?? '');
    this.buscar.set(parametros.get('buscar') ?? this.preferencias.leer(CLAVE_BUSCAR, ''));

    this.cargar();
    this.cargarEstados();

    // Las fotos se piden para las tarjetas que se ven, no para todo el parque.
    effect(() => {
      for (const v of this.paginacion.items()) this.pedirPortada(v.vehiculoId);
    });

    // Solo el administrador puede dar de alta, y necesita el selector de clientes.
    if (this.auth.esAdministrador()) {
      this.clientesService.getAll(undefined, 1, TODOS_LOS_REGISTROS).subscribe((resultado) =>
        this.clientes.set(resultado.items.filter((c) => c.estado === EstadoCliente.Activo)),
      );
    }

    // "+ Agregar vehículo" desde la ficha de un cliente enlaza con ?clienteId=...&nuevo=true:
    // abre el alta directo con el propietario ya elegido, sin buscarlo de nuevo.
    if (parametros.get('nuevo') === 'true') {
      this.abrirNuevo();
      this.limpiarParametro('nuevo');
    }

    // "Editar" desde la ficha del vehículo enlaza con ?editar=VEH-001.
    const editar = parametros.get('editar');
    if (editar && this.auth.esAdministrador()) {
      this.servicio.getById(editar).subscribe((vehiculo) => {
        this.volverAFicha = vehiculo.vehiculoId;
        this.abrirEditar(vehiculo);
      });
      this.limpiarParametro('editar');
    }
  }

  private limpiarParametro(nombre: string): void {
    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: { [nombre]: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** Todo el parque de una vez: buscar, filtrar y paginar se hace en pantalla. */
  protected cargar(): void {
    this.cargando.set(true);

    this.servicio.getAll(undefined, undefined, 1, TODOS_LOS_REGISTROS).subscribe({
      next: (resultado) => {
        this.vehiculos.set(resultado.items);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  /** Órdenes y diagnósticos: de ahí sale el estado de cada tarjeta. */
  private cargarEstados(): void {
    this.ordenesService
      .getAll()
      .pipe(catchError(() => of([] as Orden[])))
      .subscribe((lista) => this.ordenes.set(lista));
    this.diagnosticosService
      .getAll({ tamanoPagina: TODOS_LOS_REGISTROS })
      .pipe(catchError(() => of(null)))
      .subscribe((resultado) => this.diagnosticos.set(resultado?.items ?? []));
  }

  private pedirPortada(vehiculoId: string): void {
    if (this.portadasPedidas.has(vehiculoId)) return;
    this.portadasPedidas.add(vehiculoId);

    this.servicio
      .getFotos(vehiculoId)
      .pipe(catchError(() => of([])))
      .subscribe((fotos) =>
        this.portadas.update((mapa) =>
          new Map(mapa).set(
            vehiculoId,
            fotos.length ? { url: fotos[0].url, cantidad: fotos.length } : null,
          ),
        ),
      );
  }

  protected portada(vehiculo: Vehiculo): Portada | null {
    return this.portadas().get(vehiculo.vehiculoId) ?? null;
  }

  /** En el taller, listo para entregar, esperando respuesta o cuándo vino por última vez. */
  protected estado(vehiculo: Vehiculo): EstadoVehiculo {
    const orden = this.ordenActiva().get(vehiculo.vehiculoId);
    if (orden?.estado === EstadoOrden.Finalizada) {
      return { texto: `Listo para entregar · ${orden.ordenId}`, tono: 'verde' };
    }
    if (orden) return { texto: `En el taller · ${orden.ordenId}`, tono: 'naranja' };

    if (this.diagnosticoPendiente().has(vehiculo.vehiculoId)) {
      return { texto: 'Presupuesto esperando respuesta', tono: 'azul' };
    }

    const ultima = this.ultimaOrden().get(vehiculo.vehiculoId);
    if (ultima) {
      return {
        texto: `Última visita el ${fechaCorta(ultima.fechaCierre ?? ultima.fechaCreacion)}`,
        tono: 'gris',
      };
    }
    return { texto: 'Todavía no vino al taller', tono: 'gris' };
  }

  private pasaFiltro(vehiculo: Vehiculo, filtro: FiltroVehiculos): boolean {
    const id = vehiculo.vehiculoId;
    switch (filtro) {
      case 'taller':
        return this.ordenActiva().has(id);
      case 'presupuesto':
        return !this.ordenActiva().has(id) && this.diagnosticoPendiente().has(id);
      case 'sinVenir': {
        if (this.ordenActiva().has(id)) return false;
        const ultima = this.ultimaOrden().get(id);
        const desde = ultima ? (ultima.fechaCierre ?? ultima.fechaCreacion) : vehiculo.fechaRegistro;
        return Date.now() - new Date(desde).getTime() > SEIS_MESES_MS;
      }
      default:
        return true;
    }
  }

  protected abrirFicha(vehiculo: Vehiculo): void {
    void this.router.navigate(['/vehiculos', vehiculo.vehiculoId]);
  }

  protected onBuscar(valor: string): void {
    this.buscar.set(valor);
    this.preferencias.guardar(CLAVE_BUSCAR, valor);
  }

  protected onFiltrarCliente(valor: string): void {
    this.clienteFiltro.set(valor);
  }

  protected invalido(control: string): boolean {
    const campo = this.formulario.get(control);
    return !!campo && campo.invalid && (campo.touched || campo.dirty);
  }

  /** Mensaje concreto por campo, en vez de un genérico "revise el formulario". */
  protected error(control: string): string {
    const campo = this.formulario.get(control);
    if (!campo || !this.invalido(control)) return '';

    if (campo.hasError('required')) return 'Este campo es obligatorio.';
    if (campo.hasError('min') || campo.hasError('max'))
      return 'El año debe estar entre 1900 y 2100.';
    if (campo.hasError('maxlength')) {
      const { requiredLength } = campo.getError('maxlength');
      return `Máximo ${requiredLength} caracteres.`;
    }

    return 'Revise el valor ingresado.';
  }

  protected abrirNuevo(): void {
    this.editando.set(null);
    this.volverAFicha = null;
    // El año casi siempre es el actual: se ofrece hecho y solo se corrige si no.
    this.formulario.reset({
      kilometraje: 0,
      clienteId: this.clienteFiltro(),
      anio: new Date().getFullYear(),
    });
    this.formulario.controls.clienteId.enable();
    this.placaActual.set('');
    this.marcaActual.set('');
    this.formularioAbierto.set(true);
  }

  protected abrirEditar(vehiculo: Vehiculo): void {
    this.editando.set(vehiculo);
    this.formulario.patchValue({
      clienteId: vehiculo.clienteId,
      placa: vehiculo.placa,
      marca: vehiculo.marca,
      modelo: vehiculo.modelo,
      anio: vehiculo.anio ?? null,
      color: vehiculo.color ?? '',
      numMotor: vehiculo.numMotor ?? '',
      numChasis: vehiculo.numChasis ?? '',
      kilometraje: vehiculo.kilometraje ?? 0,
    });
    this.placaActual.set(vehiculo.placa ?? '');
    this.marcaActual.set(vehiculo.marca ?? '');

    // El propietario no se reasigna desde aquí: el backend no lo permite.
    this.formulario.controls.clienteId.disable();
    this.formularioAbierto.set(true);
  }

  /** Las placas bolivianas van en mayúsculas: se normaliza al escribir. */
  protected onPlacaInput(valor: string): void {
    const mayus = valor.toUpperCase();
    this.formulario.controls.placa.setValue(mayus);
    this.placaActual.set(mayus);
  }

  protected onMarcaInput(valor: string): void {
    this.marcaActual.set(valor);
  }

  /** Color de un clic, sin teclear. */
  protected elegirColor(color: string): void {
    const control = this.formulario.controls.color;
    // Volver a tocar el mismo color lo quita: sigue siendo un campo opcional.
    control.setValue(control.value === color ? '' : color);
    control.markAsDirty();
  }

  protected cerrarFormulario(): void {
    this.formularioAbierto.set(false);
    this.editando.set(null);

    const ficha = this.volverAFicha;
    this.volverAFicha = null;
    if (ficha) void this.router.navigate(['/vehiculos', ficha]);
  }

  protected guardar(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.guardando.set(true);
    const datos = this.formulario.getRawValue();
    const enEdicion = this.editando();

    const peticion = enEdicion
      ? this.servicio.actualizar(enEdicion.vehiculoId, {
          placa: datos.placa,
          marca: datos.marca,
          modelo: datos.modelo,
          anio: datos.anio,
          color: datos.color,
          numMotor: datos.numMotor,
          numChasis: datos.numChasis,
          kilometraje: datos.kilometraje,
        })
      : this.servicio.crear(datos);

    peticion.subscribe({
      next: () => {
        this.notificacion.exito(
          enEdicion ? 'Vehículo actualizado.' : 'Vehículo registrado correctamente.',
        );
        this.guardando.set(false);
        this.cerrarFormulario();
        // El nuevo queda primero en la lista: volver a la página 1 para verlo.
        if (!enEdicion) this.paginacion.irA(1);
        this.cargar();
      },
      error: () => this.guardando.set(false),
    });
  }
}

function fechaCorta(iso: string): string {
  const fecha = new Date(iso);
  const dia = String(fecha.getDate()).padStart(2, '0');
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}/${fecha.getFullYear()}`;
}
