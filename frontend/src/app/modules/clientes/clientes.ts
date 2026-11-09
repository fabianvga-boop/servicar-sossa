import {
  afterNextRender,
  Component,
  computed,
  effect,
  inject,
  Injector,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import {
  EstadoCliente,
  EstadoDiag,
  EstadoOrden,
  EstadoProforma,
  EstadoServicioOrden,
  RespuestaCliente,
} from '../../core/models/enums';
import { Proforma } from '../../core/models/finanzas.model';
import { Cliente, TipoCarroceria, Vehiculo, VehiculoFoto } from '../../core/models/personas.model';
import { Diagnostico, Orden } from '../../core/models/taller.model';
import { urlArchivo } from '../../core/services/api-base';
import { ClientesService } from '../../core/services/clientes.service';
import { ProformasService } from '../../core/services/finanzas.service';
import { NotificacionService } from '../../core/services/notificacion.service';
import { OrdenesService } from '../../core/services/ordenes.service';
import { PreferenciasService } from '../../core/services/preferencias.service';
import { DiagnosticosService } from '../../core/services/taller.service';
import { VehiculosService } from '../../core/services/vehiculos.service';
import { Cajon } from '../../shared/components/cajon';
import { Confirmacion } from '../../shared/components/confirmacion';
import { EstadoTabla } from '../../shared/components/estado-tabla';
import { Paginador } from '../../shared/components/paginador';
import { estiloOrden, estiloVehiculo } from '../../shared/estilo-estado';
import { Placa } from '../../shared/components/placa';
import { Atajo } from '../../shared/directives/atajo';
import { EnfocarError } from '../../shared/directives/enfocar-error';
import { PaginacionLocal, TODOS_LOS_REGISTROS } from '../../shared/paginacion-local';
import { BolivianosPipe } from '../../shared/pipes/bolivianos.pipe';
import { unicosOrdenados } from '../../shared/sugerencias-texto';
import {
  COLORES_RAPIDOS,
  colorPunto,
  coloresSugeridos,
  marcasSugeridas,
  modelosSugeridos,
} from '../../shared/vehiculo-sugerencias';

const CLAVE_BUSCAR = 'clientes.buscar';

/** Placas que se muestran en la fila antes de resumir el resto en un "+N". */
const MAX_PLACAS = 2;

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** Siluetas del recuadro del vehículo, por tipo de carrocería. */
const SILUETAS = {
  sedan: 'M24 92V76l34-8 30-22h66l30 22 32 8v16z',
  suv: 'M24 92V70l22-6 26-24h86l28 24 32 6v22z',
  camioneta: 'M24 92V62h96V36h48l34 26h14v30z',
};

const ORDEN_ACTIVA = [EstadoOrden.Abierta, EstadoOrden.EnProceso, EstadoOrden.Finalizada];

type Filtro = 'todos' | 'taller' | 'saldo' | 'inactivos';
type Pestana = 'vehiculos' | 'ordenes' | 'historial';
type Modo = 'ficha' | 'nuevo' | 'editar';

/** Cómo está un vehículo del cliente ahora mismo. */
interface EstadoVehiculo {
  texto: string;
  tono: 'naranja' | 'azul' | 'verde' | 'gris';
  /** Servicios hechos de la orden en curso (para la barrita de avance). */
  avance?: { hechos: number; total: number };
}

interface FilaCliente {
  cliente: Cliente;
  nombre: string;
  iniciales: string;
  saldo: number;
  enTaller: boolean;
  activo: boolean;
  vehiculos: number;
  /** Fecha de su orden más reciente: la última vez que trajo un vehículo. */
  ultima: string | null;
}

/** Un renglón del historial de la ficha. */
interface Evento {
  fecha: string;
  texto: string;
  tono: '' | 'verde' | 'rojo';
}

/**
 * USU006-USU008 — clientes en tabla: quién es, sus placas, si tiene el auto en
 * el taller, cuánto debe y cuándo vino por última vez; se ordena por columna.
 * Al tocar una fila se abre su ficha en el panel lateral (datos, resumen,
 * vehículos, órdenes e historial). El alta y la edición, en otro panel.
 */
@Component({
  selector: 'app-clientes',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    Cajon,
    Confirmacion,
    EstadoTabla,
    Paginador,
    Placa,
    Atajo,
    EnfocarError,
    BolivianosPipe,
  ],
  templateUrl: './clientes.html',
  styleUrl: './clientes.css',
  host: {
    '(document:click)': 'menuDe.set(null)',
  },
})
export class Clientes {
  private readonly servicio = inject(ClientesService);
  private readonly vehiculosService = inject(VehiculosService);
  private readonly ordenesService = inject(OrdenesService);
  private readonly proformasService = inject(ProformasService);
  private readonly diagnosticosService = inject(DiagnosticosService);
  private readonly fb = inject(FormBuilder);
  private readonly notificacion = inject(NotificacionService);
  private readonly preferencias = inject(PreferenciasService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);

  protected readonly urlArchivo = urlArchivo;
  protected readonly EstadoCliente = EstadoCliente;
  protected readonly estiloOrden = estiloOrden;
  protected readonly estiloVehiculo = estiloVehiculo;
  protected readonly MAX_PLACAS = MAX_PLACAS;

  // --- Datos ------------------------------------------------------------------------
  protected readonly clientes = signal<Cliente[]>([]);
  protected readonly cargando = signal(true);
  private readonly vehiculos = signal<Vehiculo[]>([]);
  private readonly ordenes = signal<Orden[]>([]);
  private readonly proformas = signal<Proforma[]>([]);
  private readonly diagnosticos = signal<Diagnostico[]>([]);

  /** Fotos y avance de servicios: se piden solo para el cliente que se mira. */
  private readonly fotos = signal(new Map<string, VehiculoFoto[]>());
  private readonly avances = signal(new Map<string, { hechos: number; total: number }>());
  private readonly fotosPedidas = new Set<string>();
  private readonly avancesPedidos = new Set<string>();

  // --- Lista ------------------------------------------------------------------------
  protected readonly buscar = signal('');
  protected readonly filtro = signal<Filtro>('todos');
  /** El cliente con la ficha abierta en el panel. */
  protected readonly elegidoId = signal<string | null>(null);
  protected readonly pestana = signal<Pestana>('vehiculos');
  /** Fila con el menú ⋯ abierto. */
  protected readonly menuDe = signal<string | null>(null);

  // --- Formulario -------------------------------------------------------------------
  protected readonly modo = signal<Modo>('ficha');
  protected readonly formularioAbierto = computed(() => this.modo() !== 'ficha');
  /** El cliente que se está editando: fijo, aunque la lista cambie mientras tanto. */
  protected readonly editando = signal<Cliente | null>(null);
  protected readonly guardando = signal(false);
  protected readonly porCambiarEstado = signal<Cliente | null>(null);

  /** Solo aplica al alta nueva: registrar el primer vehículo en el mismo paso. */
  protected readonly registrarVehiculo = signal(false);

  /** Cuando está activo, tras guardar se limpia el formulario en vez de cerrarlo. */
  private crearOtro = false;

  /** Espejo reactivo de la placa: alimenta la vista previa en vivo. */
  protected readonly placaActual = signal('');
  /** Espejo reactivo de la marca: acota los modelos sugeridos a esa marca. */
  protected readonly marcaActual = signal('');

  protected readonly COLORES_RAPIDOS = COLORES_RAPIDOS;
  protected readonly colorPunto = colorPunto;

  protected readonly marcasSugeridas = computed(() => marcasSugeridas(this.vehiculos()));
  protected readonly modelosSugeridos = computed(() =>
    modelosSugeridos(this.vehiculos(), this.marcaActual()),
  );
  protected readonly coloresSugeridos = computed(() => coloresSugeridos(this.vehiculos()));
  protected readonly direccionesSugeridas = computed(() =>
    unicosOrdenados(this.clientes().map((c) => c.direccion)),
  );

  protected readonly formulario = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(100)]],
    apellido: ['', Validators.maxLength(100)],
    razonSocial: ['', Validators.maxLength(150)],
    ciNit: ['', [Validators.required, Validators.maxLength(30)]],
    telefono: ['', Validators.maxLength(20)],
    email: ['', [Validators.email, Validators.maxLength(150)]],
    direccion: ['', Validators.maxLength(200)],
  });

  /** Espeja los campos del alta de vehículo, menos el propietario (se deduce). */
  protected readonly formularioVehiculo = this.fb.nonNullable.group({
    placa: ['', Validators.maxLength(15)],
    marca: ['', Validators.maxLength(50)],
    modelo: ['', Validators.maxLength(50)],
    anio: [null as number | null, [Validators.min(1900), Validators.max(2100)]],
    color: ['', Validators.maxLength(30)],
    numMotor: ['', Validators.maxLength(50)],
    numChasis: ['', Validators.maxLength(50)],
    kilometraje: [0, Validators.min(0)],
  });

  // --- Cruces -------------------------------------------------------------------------

  private readonly vehiculosPorCliente = computed(() => {
    const mapa = new Map<string, Vehiculo[]>();
    for (const v of this.vehiculos()) mapa.set(v.clienteId, [...(mapa.get(v.clienteId) ?? []), v]);
    return mapa;
  });

  /** La orden que tiene cada vehículo en el taller ahora (la más reciente). */
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

  /** Lo que se le cobró y todavía no pagó, por cliente. */
  private readonly saldoPorCliente = computed(() => {
    const mapa = new Map<string, number>();
    for (const p of this.proformas()) {
      if (p.estado !== EstadoProforma.Emitida || p.estaSaldada || p.saldoPendiente <= 0) continue;
      mapa.set(p.clienteId, (mapa.get(p.clienteId) ?? 0) + p.saldoPendiente);
    }
    return mapa;
  });

  private readonly ultimaOrdenPorVehiculo = computed(() => {
    const mapa = new Map<string, Orden>();
    for (const o of this.ordenes()) {
      const otra = mapa.get(o.vehiculoId);
      if (!otra || o.fechaCreacion > otra.fechaCreacion) mapa.set(o.vehiculoId, o);
    }
    return mapa;
  });

  /** Fecha de la orden más reciente de cada cliente. */
  private readonly ultimaPorCliente = computed(() => {
    const mapa = new Map<string, string>();
    for (const o of this.ordenes()) {
      const otra = mapa.get(o.clienteId);
      if (!otra || o.fechaCreacion > otra) mapa.set(o.clienteId, o.fechaCreacion);
    }
    return mapa;
  });

  // --- Lista ------------------------------------------------------------------------

  protected readonly filas = computed<FilaCliente[]>(() => {
    const saldos = this.saldoPorCliente();
    const porCliente = this.vehiculosPorCliente();
    const activas = this.ordenActiva();
    const ultimas = this.ultimaPorCliente();

    return this.clientes().map((cliente) => {
      const nombre = nombreDe(cliente);
      const vehiculos = porCliente.get(cliente.clienteId) ?? [];
      return {
        cliente,
        nombre,
        iniciales: iniciales(nombre),
        saldo: saldos.get(cliente.clienteId) ?? 0,
        enTaller: vehiculos.some((v) => activas.has(v.vehiculoId)),
        activo: cliente.estado === EstadoCliente.Activo,
        // Las placas del cliente cubren el rato en que los vehículos aún no llegaron.
        vehiculos: Math.max(vehiculos.length, (cliente.placas ?? []).length),
        ultima: ultimas.get(cliente.clienteId) ?? null,
      };
    });
  });

  protected readonly cuentas = computed(() => {
    const filas = this.filas();
    return {
      todos: filas.length,
      taller: filas.filter((f) => f.enTaller).length,
      saldo: filas.filter((f) => f.saldo > 0).length,
      inactivos: filas.filter((f) => !f.activo).length,
    };
  });

  protected readonly filtradas = computed(() => {
    const filtro = this.filtro();
    const palabras = normalizar(this.buscar()).split(/\s+/).filter(Boolean);

    const lista = this.filas().filter((f) => {
      if (filtro === 'taller' && !f.enTaller) return false;
      if (filtro === 'saldo' && f.saldo <= 0) return false;
      if (filtro === 'inactivos' && f.activo) return false;
      if (palabras.length === 0) return true;

      const c = f.cliente;
      const texto = normalizar(
        [f.nombre, c.nombre, c.apellido, c.razonSocial, c.ciNit, c.telefono, c.clienteId, ...(c.placas ?? [])]
          .filter(Boolean)
          .join(' '),
      );
      return palabras.every((p) => texto.includes(p));
    });

    // Orden fijo por nombre, como el resto de las tablas (sin ordenar por columna).
    return lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  });

  protected readonly paginacion = new PaginacionLocal(
    () => this.filtradas(),
    () => [this.buscar(), this.filtro()],
  );
  protected readonly visibles = this.paginacion.items;

  /** El cliente de la ficha abierta, si hay una. */
  protected readonly elegido = computed<FilaCliente | null>(() => {
    const id = this.elegidoId();
    return id ? (this.filas().find((f) => f.cliente.clienteId === id) ?? null) : null;
  });

  // --- Ficha ------------------------------------------------------------------------

  protected readonly vehiculosElegido = computed(() => {
    const elegido = this.elegido();
    return elegido ? (this.vehiculosPorCliente().get(elegido.cliente.clienteId) ?? []) : [];
  });

  private readonly ordenesElegido = computed(() => {
    const elegido = this.elegido();
    if (!elegido) return [];
    return this.ordenes()
      .filter((o) => o.clienteId === elegido.cliente.clienteId)
      .sort((a, b) => b.fechaCreacion.localeCompare(a.fechaCreacion));
  });

  protected readonly cantidadOrdenes = computed(() => this.ordenesElegido().length);
  protected readonly ultimasOrdenes = computed(() => this.ordenesElegido().slice(0, 6));

  /** Proformas con saldo: la más antigua es la que se ofrece cobrar primero. */
  protected readonly proformasPendientes = computed(() => {
    const elegido = this.elegido();
    if (!elegido) return [];
    return this.proformas()
      .filter(
        (p) =>
          p.clienteId === elegido.cliente.clienteId &&
          p.estado === EstadoProforma.Emitida &&
          !p.estaSaldada &&
          p.saldoPendiente > 0,
      )
      .sort((a, b) => a.fechaEmision.localeCompare(b.fechaEmision));
  });

  /** Lo que pasó con el cliente, del más reciente al más viejo. */
  protected readonly historial = computed<Evento[]>(() => {
    const elegido = this.elegido();
    if (!elegido) return [];
    const eventos: Evento[] = [
      { fecha: elegido.cliente.fechaRegistro, texto: 'Se registró como cliente', tono: '' },
    ];
    for (const o of this.ordenesElegido()) {
      eventos.push({ fecha: o.fechaCreacion, texto: `Abrió la orden ${o.ordenId}`, tono: '' });
      if (o.fechaCierre && o.estado === EstadoOrden.Cerrada) {
        eventos.push({ fecha: o.fechaCierre, texto: `Se cerró la orden ${o.ordenId}`, tono: 'verde' });
      }
    }
    for (const p of this.proformas()) {
      if (p.clienteId !== elegido.cliente.clienteId) continue;
      const debe = !p.estaSaldada && p.saldoPendiente > 0;
      eventos.push({
        fecha: p.fechaEmision,
        texto: `Proforma ${p.proformaId}${debe ? ' · debe ' + bolivianos(p.saldoPendiente) : ' · pagada'}`,
        tono: debe ? 'rojo' : '',
      });
    }
    return eventos.sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 12);
  });

  constructor() {
    const parametros = this.ruta.snapshot.queryParamMap;

    // El buscador global enlaza aquí con ?buscar=<CI/NIT>; la ficha de un
    // vehículo, con ?clienteId=. Sin parámetros se restaura la última búsqueda.
    const desdeUrl = parametros.get('buscar');
    this.buscar.set(desdeUrl ?? this.preferencias.leer(CLAVE_BUSCAR, ''));
    const clienteId = parametros.get('clienteId');
    if (clienteId) {
      this.elegidoId.set(clienteId);
      // Que la búsqueda guardada no esconda al cliente que se pidió.
      if (!desdeUrl) this.buscar.set('');
    }

    this.cargar();

    // "Nuevo → Cliente" desde la barra del celular enlaza con ?nuevo=true.
    if (parametros.get('nuevo') === 'true') {
      this.abrirNuevo();
      void this.router.navigate([], {
        relativeTo: this.ruta,
        queryParams: { nuevo: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }

    this.vehiculosService
      .getAll(undefined, undefined, 1, TODOS_LOS_REGISTROS)
      .pipe(catchError(() => of(null)))
      .subscribe((resultado) => this.vehiculos.set(resultado?.items ?? []));
    this.ordenesService
      .getAll()
      .pipe(catchError(() => of([] as Orden[])))
      .subscribe((lista) => this.ordenes.set(lista));
    this.proformasService
      .getAll({ estado: EstadoProforma.Emitida, tamanoPagina: TODOS_LOS_REGISTROS })
      .pipe(catchError(() => of(null)))
      .subscribe((resultado) => this.proformas.set(resultado?.items ?? []));
    this.diagnosticosService
      .getAll({ tamanoPagina: TODOS_LOS_REGISTROS })
      .pipe(catchError(() => of(null)))
      .subscribe((resultado) => this.diagnosticos.set(resultado?.items ?? []));

    // Las fotos de cada vehículo y el avance de la orden en curso se piden
    // recién cuando se abre la ficha de ese cliente, una sola vez.
    effect(() => {
      const activas = this.ordenActiva();
      for (const v of this.vehiculosElegido()) {
        this.pedirFotos(v.vehiculoId);
        const orden = activas.get(v.vehiculoId);
        if (orden?.estado === EstadoOrden.EnProceso) this.pedirAvance(orden.ordenId);
      }
    });
  }

  protected cargar(): void {
    this.cargando.set(true);

    this.servicio.getAll(undefined, 1, TODOS_LOS_REGISTROS).subscribe({
      next: (resultado) => {
        this.clientes.set(resultado.items);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  private pedirFotos(vehiculoId: string): void {
    if (this.fotosPedidas.has(vehiculoId)) return;
    this.fotosPedidas.add(vehiculoId);

    this.vehiculosService
      .getFotos(vehiculoId)
      .pipe(catchError(() => of([] as VehiculoFoto[])))
      .subscribe((lista) => this.fotos.update((mapa) => new Map(mapa).set(vehiculoId, lista)));
  }

  private pedirAvance(ordenId: string): void {
    if (this.avancesPedidos.has(ordenId)) return;
    this.avancesPedidos.add(ordenId);

    this.ordenesService
      .getById(ordenId)
      .pipe(catchError(() => of(null)))
      .subscribe((detalle) => {
        if (!detalle) return;
        const hechos = detalle.servicios.filter((s) => s.estado === EstadoServicioOrden.Completado).length;
        this.avances.update((mapa) =>
          new Map(mapa).set(ordenId, { hechos, total: detalle.servicios.length }),
        );
      });
  }

  // --- Lista: buscar, filtrar, elegir --------------------------------------------------

  protected onBuscar(valor: string): void {
    this.buscar.set(valor);
    this.preferencias.guardar(CLAVE_BUSCAR, valor);
  }

  protected elegirFiltro(filtro: Filtro): void {
    this.filtro.set(filtro);
  }

  protected alternarMenu(evento: Event, id: string): void {
    evento.stopPropagation();
    this.menuDe.set(this.menuDe() === id ? null : id);
  }

  protected limpiarBusqueda(): void {
    this.onBuscar('');
    this.filtro.set('todos');
  }

  protected elegir(cliente: Cliente, pestana: Pestana = 'vehiculos'): void {
    this.menuDe.set(null);
    this.pestana.set(pestana);
    this.elegidoId.set(cliente.clienteId);
    this.modo.set('ficha');
    this.editando.set(null);
    // En la dirección: al ir a Vehículos y tocar "Volver", vuelve a este cliente.
    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: { clienteId: cliente.clienteId, buscar: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected cerrarFicha(): void {
    this.elegidoId.set(null);
    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: { clienteId: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected tono(id: string): string {
    return ['azul', 'verde', 'naranja', 'rojo'][Number(id.replace(/\D/g, '')) % 4];
  }

  /** "hoy", "hace 10 días", "hace 2 meses". */
  protected haceCuanto(iso: string): string {
    const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
    if (dias <= 0) return 'hoy';
    if (dias === 1) return 'ayer';
    if (dias < 31) return `hace ${dias} días`;
    const meses = Math.round(dias / 30);
    if (meses < 12) return meses === 1 ? 'hace 1 mes' : `hace ${meses} meses`;
    const anios = Math.round(dias / 365);
    return anios === 1 ? 'hace 1 año' : `hace ${anios} años`;
  }

  protected fechaCorta(iso: string): string {
    return fechaCorta(iso);
  }

  /** Clase del chip de estado de una orden en la ficha. */
  // --- Lo que muestra la fila y la ficha ------------------------------------------------

  protected placasVisibles(cliente: Cliente): string[] {
    // `?? []` cubre la ventana de un despliegue: el frontend puede quedar
    // arriba antes que la API y recibir todavía respuestas sin `placas`.
    return (cliente.placas ?? []).slice(0, MAX_PLACAS);
  }

  protected placasRestantes(cliente: Cliente): number {
    return Math.max(0, (cliente.placas ?? []).length - MAX_PLACAS);
  }

  protected clienteDesde(cliente: Cliente): string {
    const fecha = new Date(cliente.fechaRegistro);
    return `${MESES[fecha.getMonth()]} ${fecha.getFullYear()}`;
  }

  /**
   * Enlace directo a un chat de WhatsApp. El teléfono se guarda como texto
   * libre: acá solo se limpia para armar la URL; si no trae código de país se
   * asume Bolivia (+591). El dato guardado no se toca.
   */
  protected enlaceWhatsapp(telefono: string): string {
    const digitos = telefono.replace(/\D/g, '');
    const conCodigo = digitos.startsWith('591') ? digitos : `591${digitos}`;
    return `https://wa.me/${conCodigo}`;
  }

  protected enlaceLlamada(telefono: string): string {
    return `tel:${telefono.replace(/[^\d+]/g, '')}`;
  }

  protected silueta(tipo: TipoCarroceria): string {
    if (tipo === 'Suv') return SILUETAS.suv;
    if (tipo === 'Pickup' || tipo === 'Camion' || tipo === 'Furgon') return SILUETAS.camioneta;
    return SILUETAS.sedan;
  }

  protected fotosDe(vehiculo: Vehiculo): VehiculoFoto[] {
    return this.fotos().get(vehiculo.vehiculoId) ?? [];
  }

  /** En el taller, listo para entregar, esperando respuesta o cuándo vino por última vez. */
  protected estadoVehiculo(vehiculo: Vehiculo): EstadoVehiculo {
    const orden = this.ordenActiva().get(vehiculo.vehiculoId);

    if (orden?.estado === EstadoOrden.Finalizada) {
      return { texto: `Listo para entregar · ${orden.ordenId} finalizada`, tono: 'verde' };
    }
    if (orden?.estado === EstadoOrden.EnProceso) {
      const avance = this.avances().get(orden.ordenId);
      const detalle =
        avance && avance.total > 0
          ? `, ${avance.hechos} de ${avance.total} ${avance.total === 1 ? 'servicio' : 'servicios'}`
          : '';
      return {
        texto: `En el taller · ${orden.ordenId} en proceso${detalle}`,
        tono: 'naranja',
        avance: avance && avance.total > 0 ? avance : undefined,
      };
    }
    if (orden) return { texto: `En el taller · ${orden.ordenId} en espera`, tono: 'naranja' };

    const diagnostico = this.diagnosticoPendiente().get(vehiculo.vehiculoId);
    if (diagnostico) {
      return { texto: `Presupuesto esperando su respuesta · ${diagnostico.diagnosticoId}`, tono: 'azul' };
    }

    const ultima = this.ultimaOrdenPorVehiculo().get(vehiculo.vehiculoId);
    if (ultima) {
      return { texto: `Última visita el ${fechaCorta(ultima.fechaCierre ?? ultima.fechaCreacion)}`, tono: 'gris' };
    }
    return { texto: 'Todavía no vino al taller', tono: 'gris' };
  }

  /** Columna de la fecha: la orden en curso dice en qué está; la cerrada, cuándo. */
  protected cuandoOrden(orden: Orden): string {
    switch (orden.estado) {
      case EstadoOrden.Abierta:
        return 'En espera';
      case EstadoOrden.EnProceso:
        return 'En proceso';
      case EstadoOrden.Finalizada:
        return 'Finalizada';
      case EstadoOrden.Cancelada:
        return 'Cancelada';
      default:
        return fechaCorta(orden.fechaCierre ?? orden.fechaCreacion);
    }
  }

  // --- Alta y edición -----------------------------------------------------------------

  protected invalido(control: string): boolean {
    const campo = this.formulario.get(control);
    // `dirty` además de `touched`: el error se corrige mientras se escribe,
    // sin esperar a que el campo pierda el foco.
    return !!campo && campo.invalid && (campo.touched || campo.dirty);
  }

  /** Mensaje concreto por campo, en vez de un genérico "revise el formulario". */
  protected error(control: string): string {
    const campo = this.formulario.get(control);
    if (!campo || !this.invalido(control)) return '';

    if (campo.hasError('required')) return 'Este campo es obligatorio.';
    if (campo.hasError('email')) return 'El correo no tiene un formato válido.';
    if (campo.hasError('maxlength')) {
      const { requiredLength } = campo.getError('maxlength');
      return `Máximo ${requiredLength} caracteres.`;
    }

    return 'Revise el valor ingresado.';
  }

  /** Deja el formulario listo para un alta nueva. */
  private reiniciarFormulario(): void {
    this.formulario.reset();
    this.registrarVehiculo.set(false);
    // El año casi siempre es el actual: se ofrece hecho y solo se corrige si no.
    this.formularioVehiculo.reset({ kilometraje: 0, anio: new Date().getFullYear() });
    this.placaActual.set('');
    this.marcaActual.set('');
  }

  protected abrirNuevo(): void {
    this.reiniciarFormulario();
    this.editando.set(null);
    this.menuDe.set(null);
    this.modo.set('nuevo');
    this.enfocarFormulario();
  }

  /** Al abrir el formulario, el cursor queda en el nombre, listo para escribir. */
  private enfocarFormulario(): void {
    afterNextRender(
      () => {
        const campo = document.getElementById('nombre') as HTMLInputElement | null;
        campo?.focus();
        campo?.scrollIntoView({ block: 'nearest' });
      },
      { injector: this.injector },
    );
  }

  /** La ficha que estaba abierta al empezar a editar (null: se vino de la tabla). */
  private fichaPrevia: string | null = null;

  protected abrirEditar(cliente: Cliente): void {
    this.menuDe.set(null);
    this.editando.set(cliente);
    this.fichaPrevia = this.elegidoId();
    this.elegidoId.set(cliente.clienteId);
    this.registrarVehiculo.set(false);
    this.formulario.reset({
      nombre: cliente.nombre,
      apellido: cliente.apellido ?? '',
      razonSocial: cliente.razonSocial ?? '',
      ciNit: cliente.ciNit,
      telefono: cliente.telefono ?? '',
      email: cliente.email ?? '',
      direccion: cliente.direccion ?? '',
    });
    this.modo.set('editar');
    this.enfocarFormulario();
  }

  protected cerrarFormulario(): void {
    // Cancelar vuelve a donde se estaba: a la ficha si se editó desde ella, a la
    // tabla si se editó desde el menú ⋯ de una fila.
    if (this.modo() === 'editar') this.elegidoId.set(this.fichaPrevia);
    this.modo.set('ficha');
    this.editando.set(null);
  }

  /** Marca que, al guardar, el formulario siga abierto para cargar otro cliente. */
  protected marcarCrearOtro(): void {
    this.crearOtro = true;
  }

  /** Las placas bolivianas van en mayúsculas: se normaliza al escribir. */
  protected onPlacaInput(valor: string): void {
    const mayus = valor.toUpperCase();
    this.formularioVehiculo.controls.placa.setValue(mayus);
    this.placaActual.set(mayus);
  }

  protected onMarcaInput(valor: string): void {
    this.marcaActual.set(valor);
  }

  /** Color de un clic, sin teclear. */
  protected elegirColor(color: string): void {
    const control = this.formularioVehiculo.controls.color;
    // Volver a tocar el mismo color lo quita: sigue siendo un campo opcional.
    control.setValue(control.value === color ? '' : color);
    control.markAsDirty();
  }

  /** Ir directo a registrar otro vehículo de este cliente, sin volver a buscarlo. */
  protected agregarVehiculo(cliente: Cliente): void {
    void this.router.navigate(['/vehiculos'], {
      queryParams: { clienteId: cliente.clienteId, nuevo: true },
    });
  }

  protected guardar(): void {
    if (this.formulario.invalid) {
      this.crearOtro = false;
      this.formulario.markAllAsTouched();
      return;
    }

    const enEdicion = this.modo() === 'editar' ? this.editando() : null;

    // Solo se pide completo cuando "Registrar un vehículo ahora" está marcado:
    // en la edición, o si no se marcó, el vehículo ni se toca.
    const conVehiculo = this.registrarVehiculo() && !enEdicion;
    const datosVehiculo = this.formularioVehiculo.getRawValue();

    if (conVehiculo && (!datosVehiculo.placa || !datosVehiculo.marca || !datosVehiculo.modelo)) {
      this.crearOtro = false;
      this.formularioVehiculo.markAllAsTouched();
      this.notificacion.advertencia('Complete placa, marca y modelo del vehículo, o desmarque la opción.');
      return;
    }

    this.guardando.set(true);
    const datos = this.formulario.getRawValue();

    const peticion = enEdicion
      ? this.servicio.actualizar(enEdicion.clienteId, datos)
      : this.servicio.crear(datos);

    peticion.subscribe({
      next: (cliente) => {
        if (!conVehiculo) {
          this.finalizarExito(cliente, enEdicion ? 'Cliente actualizado.' : 'Cliente registrado correctamente.');
          return;
        }

        // Encadenado: el vehículo se crea recién con el ID que acaba de asignar el backend.
        this.vehiculosService.crear({ clienteId: cliente.clienteId, ...datosVehiculo }).subscribe({
          next: () => {
            this.recargarVehiculos();
            this.finalizarExito(cliente, 'Cliente y vehículo registrados correctamente.');
          },
          error: () => {
            // El cliente sí quedó creado: avisar para que complete el vehículo aparte.
            this.crearOtro = false;
            this.notificacion.advertencia(
              `Cliente ${cliente.clienteId} registrado, pero el vehículo no se pudo guardar. Agréguelo desde su ficha.`,
            );
            this.guardando.set(false);
            this.elegidoId.set(cliente.clienteId);
            this.modo.set('ficha');
            this.cargar();
          },
        });
      },
      error: () => {
        this.crearOtro = false;
        this.guardando.set(false);
      },
    });
  }

  /** Muestra la ficha del cliente guardado, o deja el alta lista para otro. */
  private finalizarExito(cliente: Cliente, mensaje: string): void {
    const seguir = this.crearOtro && this.modo() === 'nuevo';
    this.crearOtro = false;
    this.notificacion.exito(mensaje);
    this.guardando.set(false);

    if (seguir) {
      this.reiniciarFormulario();
    } else {
      // Se pone ya en la lista: si no, hasta que vuelve la recarga la ficha
      // mostraba al primer cliente de la lista en lugar del recién guardado.
      this.clientes.update((lista) => [
        cliente,
        ...lista.filter((c) => c.clienteId !== cliente.clienteId),
      ]);
      // Un alta muestra la ficha del nuevo cliente; una edición vuelve a donde estaba.
      this.elegidoId.set(this.modo() === 'editar' ? this.fichaPrevia : cliente.clienteId);
      this.modo.set('ficha');
      this.editando.set(null);
      // Que el filtro o la búsqueda no escondan al que se acaba de guardar.
      this.filtro.set('todos');
      this.buscar.set('');
    }
    this.cargar();
  }

  private recargarVehiculos(): void {
    this.vehiculosService
      .getAll(undefined, undefined, 1, TODOS_LOS_REGISTROS)
      .pipe(catchError(() => of(null)))
      .subscribe((resultado) => {
        if (resultado) this.vehiculos.set(resultado.items);
      });
  }

  protected confirmarCambioEstado(cliente: Cliente): void {
    this.porCambiarEstado.set(cliente);
  }

  protected cambiarEstado(): void {
    const cliente = this.porCambiarEstado();
    if (!cliente) return;

    const nuevo =
      cliente.estado === EstadoCliente.Activo ? EstadoCliente.Inactivo : EstadoCliente.Activo;

    this.guardando.set(true);

    this.servicio.cambiarEstado(cliente.clienteId, nuevo).subscribe({
      next: () => {
        this.notificacion.exito(
          nuevo === EstadoCliente.Activo ? 'Cliente activado.' : 'Cliente desactivado.',
        );
        this.guardando.set(false);
        this.porCambiarEstado.set(null);
        this.modo.set('ficha');
        this.editando.set(null);
        this.cargar();
      },
      error: () => {
        this.guardando.set(false);
        this.porCambiarEstado.set(null);
      },
    });
  }
}

/** Empresa por su razón social; persona por nombre y apellido. */
function nombreDe(cliente: Cliente): string {
  return cliente.razonSocial?.trim() || `${cliente.nombre} ${cliente.apellido ?? ''}`.trim();
}

/** Dos iniciales de las primeras palabras con sentido ("María Fernanda Flores" → MF). */
function iniciales(nombre: string): string {
  const palabras = nombre.split(/\s+/).filter((p) => p.length > 2);
  const letras = (palabras.length ? palabras : [nombre]).slice(0, 2).map((p) => p[0] ?? '');
  return letras.join('').toUpperCase();
}

/** Minúsculas y sin tildes, para buscar "jesus" y encontrar "Jesús". */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function bolivianos(monto: number): string {
  return 'Bs ' + monto.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fechaCorta(iso: string): string {
  const fecha = new Date(iso);
  const dia = String(fecha.getDate()).padStart(2, '0');
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}/${fecha.getFullYear()}`;
}
