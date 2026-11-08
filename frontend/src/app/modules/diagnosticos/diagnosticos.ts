import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';

import { EstadoDiag, RespuestaCliente } from '../../core/models/enums';
import { Vehiculo } from '../../core/models/personas.model';
import { Diagnostico, SugerenciaDiagnostico } from '../../core/models/taller.model';
import { unicosOrdenados } from '../../shared/sugerencias-texto';
import { DIAGNOSTICO_ASISTIDO } from '../../core/funciones-activas';
import { dictadoDisponible, dictar, sumarFrase } from '../../shared/dictado';
import { AuthService } from '../../core/services/auth.service';
import { ClientesService } from '../../core/services/clientes.service';
import { ContadoresService } from '../../core/services/contadores.service';
import { descargarArchivo } from '../../core/services/descarga';
import { NotificacionService } from '../../core/services/notificacion.service';
import { OrdenesService } from '../../core/services/ordenes.service';
import { DiagnosticosService } from '../../core/services/taller.service';
import { VehiculosService } from '../../core/services/vehiculos.service';
import { coincidePorPalabras } from '../../shared/busqueda';
import { Cajon } from '../../shared/components/cajon';
import { Confirmacion } from '../../shared/components/confirmacion';
import { EstadoTabla } from '../../shared/components/estado-tabla';
import { Paginador } from '../../shared/components/paginador';
import { Placa } from '../../shared/components/placa';
import { OpcionSelector, SelectorBusqueda } from '../../shared/components/selector-busqueda';
import { detalleConNuevo } from '../../shared/recientes';
import { Borrador, borrarBorrador, guardarBorrador, leerBorrador } from '../../shared/borradores';
import { Atajo } from '../../shared/directives/atajo';
import { BolivianosPipe } from '../../shared/pipes/bolivianos.pipe';

/** Lo que se guarda como borrador de un diagnóstico a medio escribir. */
interface DatosDiagnostico {
  vehiculoId: string;
  descripcionFalla: string;
  observacionesTecnicas: string;
  montoEstimado: number | null;
}

/** Filtro por la respuesta del cliente: lo que más importa de un diagnóstico. */
type FiltroRespuesta = 'todos' | 'sinDiagnostico' | 'sinPresupuesto' | 'esperando' | 'aprobados' | 'rechazados';

/** Lo que más cuentan los clientes: un toque lo suma al relato. */
const SINTOMAS = ['Ruido', 'Golpe', 'Vibración', 'No arranca', 'Fuga', 'Frenos', 'Luz en el tablero', 'Se calienta'];

/** Cuántos pendientes se ven en cada bloque de la bandeja; el resto, con "Ver los N". */
const MAXIMO_BANDEJA = 4;

/** Desde esta espera, el pendiente se marca en rojo: hay que llamar al cliente. */
const DIAS_ESPERA_LARGA = 5;

/** Los pasos del alta: vehículo, falla y presupuesto. */
const PASOS = [
  { numero: 1, nombre: 'Vehículo' },
  { numero: 2, nombre: 'Falla' },
  { numero: 3, nombre: 'Presupuesto' },
];

/** Motivos frecuentes de rechazo, para elegir con un toque. */
const MOTIVOS_RECHAZO = ['Le pareció caro', 'Lo hará en otro taller', 'Lo va a pensar', 'Otro motivo'];

/**
 * USU012, USU014-USU016 — diagnósticos de vehículos.
 *
 * Es el punto de entrada del flujo de taller: toda orden de trabajo nace de
 * un diagnóstico. El cliente aprueba o rechaza el presupuesto aproximado, y
 * al aprobar el backend abre la orden en el acto — no hay paso manual salvo
 * el caso raro en que la creación automática falle (fallback abajo).
 *
 * La lista se trae entera (el tope de 500 sobra para un taller) y se filtra
 * en pantalla, así los filtros por respuesta muestran su cantidad.
 */
@Component({
  selector: 'app-diagnosticos',
  host: { '(document:click)': 'cerrarMenus($event)' },
  imports: [
    ReactiveFormsModule,
    FormsModule,
    RouterLink,
    DatePipe,
    Cajon,
    Confirmacion,
    EstadoTabla,
    Paginador,
    Placa,
    SelectorBusqueda,
    Atajo,
    BolivianosPipe,
  ],
  templateUrl: './diagnosticos.html',
  styleUrl: './diagnosticos.css',
})
export class Diagnosticos {
  private readonly servicio = inject(DiagnosticosService);
  private readonly vehiculosService = inject(VehiculosService);
  private readonly clientesService = inject(ClientesService);
  private readonly ordenesService = inject(OrdenesService);
  private readonly fb = inject(FormBuilder);
  private readonly notificacion = inject(NotificacionService);
  private readonly contadores = inject(ContadoresService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  protected readonly auth = inject(AuthService);

  /** Todos los diagnósticos: la tabla, los filtros y el autocompletado salen de acá. */
  protected readonly todos = signal<Diagnostico[]>([]);
  protected readonly vehiculos = signal<Vehiculo[]>([]);
  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);

  protected readonly filtro = signal<FiltroRespuesta>('todos');
  protected readonly buscar = signal('');
  protected readonly pagina = signal(1);
  protected readonly tamanoPagina = signal(20);

  // --- Paneles laterales (uno a la vez) ---------------------------------------
  protected readonly editando = signal<Diagnostico | null>(null);
  protected readonly formularioAbierto = signal(false);
  protected readonly paso = signal(1);
  protected readonly detalle = signal<Diagnostico | null>(null);
  protected readonly respondiendo = signal<Diagnostico | null>(null);
  protected readonly porAnular = signal<Diagnostico | null>(null);

  /** Solo se usa como fallback si la orden no se creó sola al aprobar. */
  protected readonly guardandoOrden = signal(false);
  protected readonly descargando = signal<string | null>(null);

  // --- Respuesta del cliente ---------------------------------------------------
  /** Lo que eligió quien registra: nada hasta que toca Aprobó o Rechazó. */
  protected readonly decision = signal<RespuestaCliente | null>(null);
  protected readonly motivo = signal<string | null>(null);
  protected comentarioCliente = '';
  /** Fecha estimada de entrega al aprobar (opcional; la carga el Administrador). */
  protected fechaEntrega = '';
  /** Teléfono del cliente, para llamarlo o escribirle desde el panel. */
  protected readonly telefonoCliente = signal<string | null>(null);

  protected readonly EstadoDiag = EstadoDiag;
  protected readonly RespuestaCliente = RespuestaCliente;
  protected readonly PASOS = PASOS;
  protected readonly MOTIVOS_RECHAZO = MOTIVOS_RECHAZO;

  protected readonly formulario = this.fb.nonNullable.group({
    vehiculoId: ['', Validators.required],
    descripcionFalla: ['', Validators.required],
    observacionesTecnicas: [''],
    montoEstimado: this.fb.control<number | null>(null),
  });

  // --- Borrador: lo escrito no se pierde si la sesión se cierra -------------

  /** Borrador encontrado al abrir el formulario, a la espera de recuperar o descartar. */
  protected readonly borradorPendiente = signal<Borrador<DatosDiagnostico> | null>(null);

  /** Borrador de un diagnóstico nuevo, para avisarlo en la pantalla al volver a entrar. */
  protected readonly borradorEnPantalla = signal<Borrador<DatosDiagnostico> | null>(null);

  private claveBorrador(): string {
    const editando = this.editando();
    return editando ? `diagnostico.${editando.diagnosticoId}` : 'diagnostico.nuevo';
  }

  // --- Diagnóstico asistido: sugerencias mientras se redacta la falla --------
  protected readonly sugerencia = signal<SugerenciaDiagnostico | null>(null);
  protected readonly cargandoSugerencia = signal(false);

  /** Fallas ya registradas: para no volver a escribir una que ya se tipeó antes. */
  protected readonly fallasSugeridas = computed(() =>
    unicosOrdenados(this.todos().map((d) => d.descripcionFalla)),
  );

  protected readonly opcionesVehiculo = computed<OpcionSelector[]>(() =>
    this.vehiculos().map((v) => ({
      valor: v.vehiculoId,
      etiqueta: `${v.placa} — ${v.marca} ${v.modelo}`,
      detalle: detalleConNuevo(v.nombreCliente, v.fechaRegistro),
    })),
  );

  // --- Lista y filtros ------------------------------------------------------------

  protected readonly cuentas = computed(() => {
    const lista = this.todos();
    return {
      todos: lista.length,
      sinDiagnostico: lista.filter((d) => this.pasaFiltro(d, 'sinDiagnostico')).length,
      sinPresupuesto: lista.filter((d) => this.pasaFiltro(d, 'sinPresupuesto')).length,
      esperando: lista.filter((d) => this.pasaFiltro(d, 'esperando')).length,
      aprobados: lista.filter((d) => this.pasaFiltro(d, 'aprobados')).length,
      rechazados: lista.filter((d) => this.pasaFiltro(d, 'rechazados')).length,
    };
  });

  protected readonly filtrados = computed(() => {
    const filtro = this.filtro();
    const texto = this.buscar();

    return this.todos().filter(
      (d) =>
        this.pasaFiltro(d, filtro) &&
        coincidePorPalabras(
          texto,
          d.diagnosticoId,
          d.placaVehiculo,
          d.descripcionVehiculo,
          d.nombreCliente,
          d.descripcionFalla,
          d.observacionesTecnicas,
        ),
    );
  });

  protected readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.filtrados().length / this.tamanoPagina())),
  );

  protected readonly visibles = computed(() => {
    const inicio = (Math.min(this.pagina(), this.totalPaginas()) - 1) * this.tamanoPagina();
    return this.filtrados().slice(inicio, inicio + this.tamanoPagina());
  });

  // --- Bandeja: lo que espera una acción, lo que más espera primero -------------

  protected readonly MAXIMO_BANDEJA = MAXIMO_BANDEJA;

  /** Presupuesto enviado y sin respuesta del cliente. */
  protected readonly esperandoRespuesta = computed(() =>
    this.todos()
      .filter((d) => this.pasaFiltro(d, 'esperando'))
      .sort((a, b) => a.fecha.localeCompare(b.fecha)),
  );

  /** Recibido con lo que cuenta el cliente; el mecánico todavía no lo revisó. */
  protected readonly faltaDiagnostico = computed(() =>
    this.todos()
      .filter((d) => this.pasaFiltro(d, 'sinDiagnostico'))
      .sort((a, b) => a.fecha.localeCompare(b.fecha)),
  );

  /** Ya diagnosticado: falta ponerle precio. */
  protected readonly faltaPresupuesto = computed(() =>
    this.todos()
      .filter((d) => this.pasaFiltro(d, 'sinPresupuesto'))
      .sort((a, b) => a.fecha.localeCompare(b.fecha)),
  );

  /** La fila del diagnóstico abierto en el panel lateral. */
  protected readonly filaElegida = computed(
    () =>
      this.respondiendo()?.diagnosticoId ??
      this.detalle()?.diagnosticoId ??
      (this.formularioAbierto() ? this.editando()?.diagnosticoId : null) ??
      null,
  );

  /** Diagnóstico pedido por ?responder=: su panel se abre cuando llega la lista. */
  private responderPendiente: string | null = null;

  constructor() {
    this.borradorEnPantalla.set(leerBorrador(this.auth.usuarioId(), 'diagnostico.nuevo'));

    // Mientras se escribe, lo cargado se guarda como borrador cada pocos
    // segundos. Mientras se decide qué hacer con un borrador anterior no se
    // guarda nada, para no pisarlo antes de que el usuario elija.
    this.formulario.valueChanges.pipe(debounceTime(600)).subscribe(() => {
      if (!this.formularioAbierto() || this.borradorPendiente()) return;

      const datos = this.formulario.getRawValue();
      if (!datos.descripcionFalla.trim() && !datos.observacionesTecnicas.trim()) return;

      guardarBorrador<DatosDiagnostico>(this.auth.usuarioId(), this.claveBorrador(), datos);
    });

    this.cargar();
    this.vehiculosService
      .getAll(undefined, undefined, 1, 500)
      .subscribe((resultado) => this.vehiculos.set(resultado.items));

    // Diagnóstico asistido: apenas se redacta la falla (con algo de texto real),
    // se buscan casos históricos parecidos y se sugieren servicios/repuestos/precio.
    this.formulario.controls.descripcionFalla.valueChanges
      .pipe(
        map((texto) => texto.trim()),
        debounceTime(500),
        distinctUntilChanged(),
        switchMap((texto) => {
          if (!DIAGNOSTICO_ASISTIDO || texto.length < 8) {
            this.cargandoSugerencia.set(false);
            return of(null);
          }
          this.cargandoSugerencia.set(true);
          return this.servicio.sugerencias(texto).pipe(catchError(() => of(null)));
        }),
      )
      .subscribe((resultado) => {
        this.cargandoSugerencia.set(false);
        this.sugerencia.set(resultado && resultado.basadoEnCasos > 0 ? resultado : null);
      });

    // "Nuevo diagnóstico" desde Órdenes enlaza con ?nuevo=true: abre el alta directo.
    // Desde la ficha de un vehículo llega además ?vehiculoId=: queda ya elegido.
    const parametros = this.ruta.snapshot.queryParamMap;
    if (parametros.get('responder')) {
      this.responderPendiente = parametros.get('responder');
      void this.router.navigate([], {
        relativeTo: this.ruta,
        queryParams: { responder: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
    if (parametros.get('nuevo') === 'true') {
      this.abrirNuevo();
      const vehiculoId = parametros.get('vehiculoId');
      if (vehiculoId) this.formulario.controls.vehiculoId.setValue(vehiculoId);
      void this.router.navigate([], {
        relativeTo: this.ruta,
        queryParams: { nuevo: null, vehiculoId: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  /** Todos de una vez: la lista se filtra y se pagina en pantalla. */
  protected cargar(): void {
    this.cargando.set(true);

    this.servicio.getAll({ pagina: 1, tamanoPagina: 500 }).subscribe({
      next: (resultado) => {
        this.todos.set(resultado.items);
        this.cargando.set(false);

        // "Registrar respuesta" desde el Panel enlaza con ?responder=DIA-001.
        const pedido = this.responderPendiente;
        this.responderPendiente = null;
        const diagnostico = pedido ? resultado.items.find((d) => d.diagnosticoId === pedido) : null;
        if (diagnostico) this.abrirResponder(diagnostico);
      },
      error: () => this.cargando.set(false),
    });
  }

  protected elegirFiltro(filtro: FiltroRespuesta): void {
    this.filtro.set(filtro);
    this.pagina.set(1);
  }

  protected onBuscar(valor: string): void {
    this.buscar.set(valor);
    this.pagina.set(1);
  }

  /** "Ver los N" de la bandeja: el historial filtrado por ese estado. */
  protected verTodos(filtro: FiltroRespuesta): void {
    this.elegirFiltro(filtro);
    document.getElementById('historial-diag')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** Espera larga: se pinta en rojo para que no se olvide llamar al cliente. */
  protected esperaLarga(fecha: string): boolean {
    return (Date.now() - new Date(fecha).getTime()) / 86_400_000 >= DIAS_ESPERA_LARGA;
  }

  protected cambiarTamano(tamano: number): void {
    this.tamanoPagina.set(tamano);
    this.pagina.set(1);
  }

  /** Un anulado solo aparece en "Todos": ya no espera ni tiene respuesta que contar. */
  private pasaFiltro(d: Diagnostico, filtro: FiltroRespuesta): boolean {
    if (filtro === 'todos') return true;
    if (d.estado === EstadoDiag.Anulado) return false;

    switch (filtro) {
      // Con orden ya no espera nada (p. ej. una revisión sin presupuesto que pasó a orden).
      case 'sinDiagnostico':
        return (
          d.respuestaCliente === RespuestaCliente.Pendiente && d.montoEstimado == null && !d.ordenId &&
          !d.observacionesTecnicas?.trim()
        );
      case 'sinPresupuesto':
        return (
          d.respuestaCliente === RespuestaCliente.Pendiente && d.montoEstimado == null && !d.ordenId &&
          !!d.observacionesTecnicas?.trim()
        );
      case 'esperando':
        return d.respuestaCliente === RespuestaCliente.Pendiente && d.montoEstimado != null && !d.ordenId;
      case 'aprobados':
        return d.respuestaCliente === RespuestaCliente.Aprobado;
      default:
        return d.respuestaCliente === RespuestaCliente.Rechazado;
    }
  }

  /** Lo que dice la insignia de la columna Respuesta. */
  protected textoRespuesta(d: Diagnostico): string {
    if (d.estado === EstadoDiag.Anulado) return 'Anulado';
    if (d.respuestaCliente === RespuestaCliente.Aprobado) return 'Aprobado';
    if (d.respuestaCliente === RespuestaCliente.Rechazado) return 'Rechazado';
    return d.montoEstimado == null ? 'Sin presupuesto' : 'Esperando respuesta';
  }

  protected claseRespuesta(d: Diagnostico): string {
    if (d.estado === EstadoDiag.Anulado) return 'insignia-gris';
    if (d.respuestaCliente === RespuestaCliente.Aprobado) return 'insignia-verde';
    if (d.respuestaCliente === RespuestaCliente.Rechazado) return 'insignia-roja';
    return d.montoEstimado == null ? 'insignia-gris' : 'insignia-naranja';
  }

  /**
   * Posiciona el menú contextual (⋮) al abrirse. La lista vive dentro de un
   * contenedor con `overflow: hidden`: un menú `absolute` quedaría recortado.
   * Se lo pasa a `position: fixed`, que escapa cualquier contenedor, y se
   * decide arriba/abajo según el espacio libre en la ventana.
   */
  protected posicionarMenu(evento: Event): void {
    const detalle = evento.currentTarget as HTMLDetailsElement;
    const panel = detalle.querySelector<HTMLElement>('.menu-contextual-panel');
    if (!panel) return;

    // Al cerrar, se limpian los estilos en línea para volver al CSS por defecto.
    if (!detalle.open) {
      panel.style.cssText = '';
      return;
    }

    const boton = detalle.querySelector<HTMLElement>('summary');
    if (!boton) return;

    const r = boton.getBoundingClientRect();
    const ancho = panel.offsetWidth || 190;
    const alto = panel.offsetHeight || 200;
    const margen = 8;

    const izquierda = Math.max(margen, r.right - ancho);
    const cabeAbajo = r.bottom + alto + margen <= window.innerHeight;

    panel.style.position = 'fixed';
    panel.style.left = `${izquierda}px`;
    panel.style.right = 'auto';
    panel.style.top = `${cabeAbajo ? r.bottom + 4 : r.top - alto - 4}px`;
    panel.style.bottom = 'auto';
    panel.style.zIndex = '60';

    // Un menú fijo no acompaña el scroll de la fila: se cierra al desplazarse.
    window.addEventListener('scroll', () => (detalle.open = false), {
      once: true,
      capture: true,
    });
  }

  /**
   * Cierra el menú de "más acciones" al elegir una opción o al hacer clic fuera.
   * Antes quedaba abierto y, como es fijo, flotaba encima del panel de detalle.
   */
  protected cerrarMenus(evento: Event): void {
    const objetivo = evento.target as HTMLElement | null;
    document.querySelectorAll<HTMLDetailsElement>('details.menu-contextual[open]').forEach((menu) => {
      if (!objetivo || !menu.contains(objetivo) || objetivo.closest('.menu-contextual-panel button')) {
        menu.open = false;
      }
    });
  }

  protected invalido(control: string): boolean {
    const campo = this.formulario.get(control);
    return !!campo && campo.invalid && (campo.touched || campo.dirty);
  }

  /**
   * El backend solo deja editar los diagnósticos propios (salvo administrador)
   * y ninguno que esté anulado. Reflejarlo aquí evita ofrecer un botón que
   * terminaría en 401.
   */
  protected puedeEditar(diagnostico: Diagnostico): boolean {
    if (diagnostico.estado === EstadoDiag.Anulado) return false;
    // Una vez que el cliente respondió, el presupuesto queda sellado.
    if (diagnostico.respuestaCliente !== RespuestaCliente.Pendiente) return false;
    return this.esSuyoOAdmin(diagnostico);
  }

  /** El cliente solo puede responder si hay un monto estimado y aún no respondió. */
  protected puedeResponder(diagnostico: Diagnostico): boolean {
    return (
      diagnostico.estado !== EstadoDiag.Anulado &&
      diagnostico.respuestaCliente === RespuestaCliente.Pendiente &&
      diagnostico.montoEstimado != null
    );
  }

  /** La orden solo se genera desde un diagnóstico aprobado y sin orden previa. */
  protected puedeGenerarOrden(diagnostico: Diagnostico): boolean {
    return (
      diagnostico.respuestaCliente === RespuestaCliente.Aprobado &&
      !diagnostico.ordenId &&
      diagnostico.estado !== EstadoDiag.Anulado
    );
  }

  /** El presupuesto lo responde el Administrador o el mecánico que lo hizo. */
  protected esSuyoOAdmin(diagnostico: Diagnostico): boolean {
    return this.auth.esAdministrador() || diagnostico.mecanicoId === this.auth.sesion()?.usuarioId;
  }

  /** "hoy", "ayer" o "hace N días": cuánto lleva esperando la respuesta. */
  protected haceCuanto(fecha: string): string {
    const dia = new Date(fecha);
    const hoy = new Date();
    dia.setHours(0, 0, 0, 0);
    hoy.setHours(0, 0, 0, 0);

    const dias = Math.round((hoy.getTime() - dia.getTime()) / 86_400_000);
    if (dias <= 0) return 'hoy';
    if (dias === 1) return 'ayer';
    return `hace ${dias} días`;
  }

  /** Solo un panel abierto a la vez. */
  private cerrarPaneles(): void {
    this.formularioAbierto.set(false);
    this.editando.set(null);
    this.detalle.set(null);
    this.respondiendo.set(null);
  }

  // --- Alta (en tres pasos) y edición ------------------------------------------

  protected abrirNuevo(): void {
    this.cerrarPaneles();
    this.faltaElDiagnostico.set(false);
    this.formulario.reset();
    this.formulario.controls.vehiculoId.enable();
    this.sugerencia.set(null);
    this.paso.set(1);
    this.borradorPendiente.set(leerBorrador(this.auth.usuarioId(), this.claveBorrador()));
    this.formularioAbierto.set(true);
  }

  protected abrirEditar(diagnostico: Diagnostico): void {
    this.cerrarPaneles();
    this.faltaElDiagnostico.set(false);
    this.editando.set(diagnostico);
    this.sugerencia.set(null);
    this.formulario.reset({
      vehiculoId: diagnostico.vehiculoId,
      descripcionFalla: diagnostico.descripcionFalla,
      observacionesTecnicas: diagnostico.observacionesTecnicas ?? '',
      montoEstimado: diagnostico.montoEstimado ?? null,
    });

    // El vehículo no se reasigna: sería otro diagnóstico.
    this.formulario.controls.vehiculoId.disable();
    this.borradorPendiente.set(leerBorrador(this.auth.usuarioId(), this.claveBorrador()));
    this.formularioAbierto.set(true);
  }

  /** Desde "Falta diagnosticar": abre el diagnóstico con el cursor en lo del mecánico. */
  protected abrirParaDiagnosticar(diagnostico: Diagnostico): void {
    this.abrirEditar(diagnostico);
    setTimeout(() => document.getElementById('observacionesTecnicas')?.focus(), 150);
  }

  /** Vuelve a cargar en el formulario lo que había quedado escrito. */
  protected recuperarBorrador(): void {
    const borrador = this.borradorPendiente();
    if (!borrador) return;

    const { vehiculoId, ...resto } = borrador.datos;
    this.formulario.patchValue(this.editando() ? resto : { vehiculoId, ...resto });
    this.borradorPendiente.set(null);
  }

  protected descartarBorrador(): void {
    borrarBorrador(this.auth.usuarioId(), this.claveBorrador());
    this.borradorPendiente.set(null);
    if (!this.editando()) this.borradorEnPantalla.set(null);
  }

  /** Desde el aviso de la pantalla: abre el formulario con el borrador ya cargado. */
  protected continuarBorrador(): void {
    this.abrirNuevo();
    this.recuperarBorrador();
  }

  /**
   * Cancelar a propósito descarta el borrador del formulario; guardar también
   * (ya no hace falta). Si quedó un borrador anterior sin decidir, se conserva.
   */
  protected cerrarFormulario(): void {
    if (!this.borradorPendiente()) {
      borrarBorrador(this.auth.usuarioId(), this.claveBorrador());
      if (!this.editando()) this.borradorEnPantalla.set(null);
    }
    this.borradorPendiente.set(null);
    this.formularioAbierto.set(false);
    this.editando.set(null);
  }

  protected textoSiguiente(): string {
    if (this.guardando()) return 'Guardando…';
    if (this.editando()) return 'Guardar cambios';
    return this.formulario.controls.montoEstimado.value != null ? 'Guardar y generar PDF' : 'Guardar';
  }

  /** Hay diagnóstico del mecánico escrito: recién ahí se pone el presupuesto. */
  protected hayDiagnostico(): boolean {
    return !!this.formulario.controls.observacionesTecnicas.value?.trim();
  }

  /** Se pidió guardar sin el diagnóstico del mecánico: se marca el recuadro. */
  protected readonly faltaElDiagnostico = signal(false);

  protected siguiente(): void {
    this.guardar(false);
  }

  /** Recibir ahora y diagnosticar después: se guarda solo lo del cliente. */
  protected guardarSinDiagnosticar(): void {
    this.formulario.controls.montoEstimado.setValue(null);
    this.guardar(true);
  }

  protected atras(): void {
    this.cerrarFormulario();
  }

  protected guardar(sinDiagnostico = false): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    if (!sinDiagnostico && !this.hayDiagnostico()) {
      this.faltaElDiagnostico.set(true);
      this.notificacion.advertencia('Escriba el diagnóstico del mecánico, o use Guardar sin diagnosticar.');
      document.getElementById('observacionesTecnicas')?.focus();
      return;
    }

    this.guardando.set(true);
    const datos = this.formulario.getRawValue();
    const enEdicion = this.editando();

    const peticion = enEdicion
      ? this.servicio.actualizar(enEdicion.diagnosticoId, {
          descripcionFalla: datos.descripcionFalla,
          observacionesTecnicas: datos.observacionesTecnicas,
          montoEstimado: datos.montoEstimado,
        })
      : this.servicio.crear(datos);

    peticion.subscribe({
      next: (guardado) => {
        this.notificacion.exito(
          enEdicion ? 'Diagnóstico actualizado.' : 'Diagnóstico registrado correctamente.',
        );
        this.guardando.set(false);
        this.cerrarFormulario();
        this.cargar();

        // Con presupuesto, el PDF para el cliente sale en el acto.
        if (!enEdicion && guardado.montoEstimado != null) this.descargarPdf(guardado);
      },
      error: () => this.guardando.set(false),
    });
  }

  // --- Lo que cuenta el cliente: síntomas con un toque y dictado -------------

  protected readonly SINTOMAS = SINTOMAS;

  protected tieneSintoma(sintoma: string): boolean {
    return (this.formulario.controls.descripcionFalla.value ?? '').toLocaleLowerCase('es').includes(sintoma.toLocaleLowerCase('es'));
  }

  protected tocarSintoma(sintoma: string): void {
    if (this.tieneSintoma(sintoma)) return;
    const control = this.formulario.controls.descripcionFalla;
    control.setValue(sumarFrase(control.value ?? '', sintoma));
    control.markAsDirty();
    setTimeout(() => document.getElementById('descripcionFalla')?.focus());
  }

  protected readonly puedeDictar = dictadoDisponible();
  /** Qué recuadro está escuchando: lo del cliente o lo del mecánico. */
  protected readonly escuchando = signal<'descripcionFalla' | 'observacionesTecnicas' | null>(null);
  private detenerDictado: (() => void) | null = null;

  protected dictarEn(campo: 'descripcionFalla' | 'observacionesTecnicas'): void {
    if (this.escuchando()) {
      this.detenerDictado?.();
      return;
    }
    if (!this.puedeDictar) {
      this.notificacion.advertencia('Este navegador no permite dictar. Use Chrome o escriba el texto.');
      return;
    }
    const control = this.formulario.controls[campo];
    this.escuchando.set(campo);
    this.detenerDictado = dictar(
      (frase) => {
        control.setValue(sumarFrase(control.value ?? '', frase));
        control.markAsDirty();
        if (campo === 'observacionesTecnicas') this.faltaElDiagnostico.set(false);
      },
      (error) => {
        this.escuchando.set(null);
        if (error === 'not-allowed') this.notificacion.advertencia('Permita el micrófono para poder dictar.');
      },
    );
  }

  /** Escribir menos: usa una falla ya registrada antes tal cual, con un clic. */
  protected usarFallaSugerida(texto: string): void {
    this.formulario.controls.descripcionFalla.setValue(texto);
    this.formulario.controls.descripcionFalla.markAsDirty();
  }

  /** Toma el promedio sugerido y lo pone directo en "Monto estimado". */
  protected usarPrecioSugerido(): void {
    const monto = this.sugerencia()?.precioPromedio;
    if (monto == null) return;
    this.formulario.controls.montoEstimado.setValue(Math.round(monto));
    this.formulario.controls.montoEstimado.markAsDirty();
  }

  protected marcarRevisado(diagnostico: Diagnostico): void {
    this.servicio.cambiarEstado(diagnostico.diagnosticoId, EstadoDiag.Revisado).subscribe(() => {
      this.notificacion.exito('Diagnóstico marcado como revisado.');
      this.cargar();
    });
  }

  protected verDetalle(diagnostico: Diagnostico): void {
    this.cerrarPaneles();
    this.telefonoCliente.set(null);
    this.detalle.set(diagnostico);

    // El teléfono no viene con el diagnóstico: se pide al abrir el detalle.
    this.clientesService
      .getById(diagnostico.clienteId)
      .pipe(catchError(() => of(null)))
      .subscribe((cliente) => {
        if (this.detalle()?.diagnosticoId === diagnostico.diagnosticoId) {
          this.telefonoCliente.set(cliente?.telefono?.trim() || null);
        }
      });
  }

  /** Recibido → Presupuesto → Respuesta → Orden, con el paso actual marcado. */
  protected pasosDetalle(d: Diagnostico): { nombre: string; estado: 'hecho' | 'actual' | 'falta' | 'cortado' }[] {
    const conPresupuesto = d.montoEstimado != null;
    const respondio = d.respuestaCliente !== RespuestaCliente.Pendiente;
    const rechazado = d.respuestaCliente === RespuestaCliente.Rechazado;
    const anulado = d.estado === EstadoDiag.Anulado;
    const estado = (hecho: boolean, actual: boolean) => (hecho ? 'hecho' : actual && !anulado ? 'actual' : 'falta') as 'hecho' | 'actual' | 'falta';
    return [
      { nombre: 'Recibido', estado: 'hecho' },
      { nombre: 'Presupuesto', estado: estado(conPresupuesto, !conPresupuesto) },
      { nombre: rechazado ? 'No aceptó' : 'Respuesta', estado: rechazado ? 'cortado' : estado(respondio, conPresupuesto && !respondio) },
      { nombre: 'Orden', estado: rechazado ? 'falta' : estado(!!d.ordenId, respondio && !d.ordenId) },
    ];
  }

  protected inicialesDe(nombre: string | null | undefined): string {
    const partes = (nombre ?? '').trim().split(/\s+/).filter(Boolean);
    if (partes.length === 0) return '—';
    return partes.length === 1 ? partes[0].slice(0, 2).toUpperCase() : (partes[0][0] + partes[1][0]).toUpperCase();
  }

  // --- Respuesta del cliente y presupuesto en PDF ---------------------------

  protected abrirResponder(diagnostico: Diagnostico): void {
    this.cerrarPaneles();
    this.comentarioCliente = '';
    this.fechaEntrega = '';
    this.decision.set(null);
    this.motivo.set(null);
    this.telefonoCliente.set(null);
    this.respondiendo.set(diagnostico);

    // El teléfono no viene con el diagnóstico: se pide al abrir el panel.
    this.clientesService
      .getById(diagnostico.clienteId)
      .pipe(catchError(() => of(null)))
      .subscribe((cliente) => {
        if (this.respondiendo()?.diagnosticoId === diagnostico.diagnosticoId) {
          this.telefonoCliente.set(cliente?.telefono?.trim() || null);
        }
      });
  }

  /** wa.me necesita el número con el código de país (591 para un celular de 8 dígitos). */
  protected enlaceWhatsapp(telefono: string): string {
    const digitos = telefono.replace(/\D/g, '');
    return `https://wa.me/${digitos.length === 8 ? `591${digitos}` : digitos}`;
  }

  protected elegirMotivo(motivo: string): void {
    this.motivo.update((actual) => (actual === motivo ? null : motivo));
  }

  /** Hoy en formato yyyy-mm-dd, como mínimo para la fecha de entrega. */
  protected hoy(): string {
    const ahora = new Date();
    ahora.setMinutes(ahora.getMinutes() - ahora.getTimezoneOffset());
    return ahora.toISOString().slice(0, 10);
  }

  protected confirmarRespuesta(): void {
    const diagnostico = this.respondiendo();
    const respuesta = this.decision();
    if (!diagnostico || respuesta === null) return;

    // El motivo elegido con un toque va delante de lo que se escribió.
    const motivo =
      respuesta === RespuestaCliente.Rechazado && this.motivo() !== 'Otro motivo' ? this.motivo() : null;
    const comentario = [motivo, this.comentarioCliente.trim()].filter(Boolean).join('. ');
    const fechaEntrega =
      respuesta === RespuestaCliente.Aprobado && this.auth.esAdministrador() ? this.fechaEntrega : '';

    this.guardando.set(true);

    this.servicio
      .responder(diagnostico.diagnosticoId, {
        respuesta,
        comentarioCliente: comentario || null,
      })
      .subscribe({
        next: (actualizado) => {
          this.guardando.set(false);
          this.respondiendo.set(null);
          this.contadores.refrescar();

          if (respuesta === RespuestaCliente.Rechazado) {
            this.notificacion.exito('Presupuesto rechazado: el cliente retira el vehículo.');
            this.cargar();
            return;
          }

          // Aprobado con orden ya creada: se salta la lista y se va directo a
          // trabajarla, igual que hacía antes el flujo manual de "Generar orden".
          if (actualizado.ordenId) {
            const ordenId = actualizado.ordenId;
            this.notificacion.exito(`Presupuesto aprobado: se creó la orden ${ordenId}.`);

            if (!fechaEntrega) {
              void this.router.navigate(['/ordenes', ordenId]);
              return;
            }

            // La fecha estimada se guarda en la orden recién creada.
            this.ordenesService.actualizar(ordenId, { fechaEstimada: fechaEntrega }).subscribe({
              next: () => void this.router.navigate(['/ordenes', ordenId]),
              error: () => void this.router.navigate(['/ordenes', ordenId]),
            });
          } else {
            this.notificacion.advertencia(
              'Presupuesto aprobado, pero la orden no se pudo crear automáticamente. ' +
                'Revise el vehículo (puede tener otra orden en curso) y créela manualmente.',
            );
            this.cargar();
          }
        },
        error: () => this.guardando.set(false),
      });
  }

  /**
   * Fallback manual: solo aparece si el diagnóstico ya está Aprobado pero la
   * orden no se pudo crear sola (p. ej. el vehículo tenía otra orden en curso
   * en ese momento). No pide fecha estimada: rara vez se conoce de antemano.
   */
  protected generarOrdenManual(diagnostico: Diagnostico): void {
    this.guardandoOrden.set(true);

    this.ordenesService.crear({ diagnosticoId: diagnostico.diagnosticoId }).subscribe({
      next: (orden) => {
        this.notificacion.exito(`Orden ${orden.ordenId} creada.`);
        this.guardandoOrden.set(false);
        this.contadores.refrescar();
        void this.router.navigate(['/ordenes', orden.ordenId]);
      },
      error: () => this.guardandoOrden.set(false),
    });
  }

  protected descargarPdf(diagnostico: Diagnostico): void {
    this.descargando.set(diagnostico.diagnosticoId);

    this.servicio.pdf(diagnostico.diagnosticoId).subscribe({
      next: ({ blob, nombreArchivo }) => {
        descargarArchivo(blob, nombreArchivo);
        this.descargando.set(null);
      },
      error: () => this.descargando.set(null),
    });
  }

  protected anular(): void {
    const diagnostico = this.porAnular();
    if (!diagnostico) return;

    this.guardando.set(true);

    this.servicio.cambiarEstado(diagnostico.diagnosticoId, EstadoDiag.Anulado).subscribe({
      next: () => {
        this.notificacion.exito('Diagnóstico anulado.');
        this.guardando.set(false);
        this.porAnular.set(null);
        this.cerrarPaneles();
        this.cargar();
      },
      error: () => {
        this.guardando.set(false);
        this.porAnular.set(null);
      },
    });
  }
}
