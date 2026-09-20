import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';

import { ETIQUETAS, EstadoDiag, RespuestaCliente } from '../../core/models/enums';
import { Vehiculo } from '../../core/models/personas.model';
import { Diagnostico, SugerenciaDiagnostico } from '../../core/models/taller.model';
import { unicosOrdenados } from '../../shared/sugerencias-texto';
import { AuthService } from '../../core/services/auth.service';
import { ContadoresService } from '../../core/services/contadores.service';
import { descargarArchivo } from '../../core/services/descarga';
import { NotificacionService } from '../../core/services/notificacion.service';
import { OrdenesService } from '../../core/services/ordenes.service';
import { PreferenciasService } from '../../core/services/preferencias.service';
import { DiagnosticosService } from '../../core/services/taller.service';
import { VehiculosService } from '../../core/services/vehiculos.service';
import { Confirmacion } from '../../shared/components/confirmacion';
import { EstadoTabla } from '../../shared/components/estado-tabla';
import { InsigniaEstado } from '../../shared/components/insignia-estado';
import { Modal } from '../../shared/components/modal';
import { Paginador } from '../../shared/components/paginador';
import { Placa } from '../../shared/components/placa';
import { OpcionSelector, SelectorBusqueda } from '../../shared/components/selector-busqueda';
import { Atajo } from '../../shared/directives/atajo';
import { EnfocarError } from '../../shared/directives/enfocar-error';
import { BolivianosPipe } from '../../shared/pipes/bolivianos.pipe';

const CLAVE_FILTRO = 'diagnosticos.estado';

/**
 * USU012, USU014-USU016 — diagnósticos de vehículos.
 *
 * Es el punto de entrada del flujo de taller: toda orden de trabajo nace de
 * un diagnóstico. El cliente aprueba o rechaza el presupuesto aproximado, y
 * al aprobar el backend abre la orden en el acto — no hay paso manual salvo
 * el caso raro en que la creación automática falle (fallback abajo).
 */
@Component({
  selector: 'app-diagnosticos',
  imports: [
    ReactiveFormsModule,
    FormsModule,
    RouterLink,
    DatePipe,
    Modal,
    Confirmacion,
    EstadoTabla,
    InsigniaEstado,
    Paginador,
    Placa,
    SelectorBusqueda,
    Atajo,
    EnfocarError,
    BolivianosPipe,
  ],
  templateUrl: './diagnosticos.html',
})
export class Diagnosticos {
  private readonly servicio = inject(DiagnosticosService);
  private readonly vehiculosService = inject(VehiculosService);
  private readonly ordenesService = inject(OrdenesService);
  private readonly fb = inject(FormBuilder);
  private readonly notificacion = inject(NotificacionService);
  private readonly preferencias = inject(PreferenciasService);
  private readonly contadores = inject(ContadoresService);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);

  protected readonly diagnosticos = signal<Diagnostico[]>([]);
  protected readonly vehiculos = signal<Vehiculo[]>([]);
  protected readonly cargando = signal(true);
  protected readonly estadoFiltro = signal<string>('');
  protected readonly buscar = signal('');
  protected readonly guardando = signal(false);

  protected readonly pagina = signal(1);
  protected readonly tamanoPagina = signal(20);
  protected readonly totalRegistros = signal(0);
  protected readonly totalPaginas = signal(0);

  protected readonly editando = signal<Diagnostico | null>(null);
  protected readonly formularioAbierto = signal(false);
  protected readonly porAnular = signal<Diagnostico | null>(null);
  protected readonly detalle = signal<Diagnostico | null>(null);

  /** Solo se usa como fallback si la orden no se creó sola al aprobar. */
  protected readonly guardandoOrden = signal(false);

  // Respuesta del cliente al presupuesto y descarga del PDF.
  protected readonly respondiendo = signal<Diagnostico | null>(null);
  protected comentarioCliente = '';
  protected readonly descargando = signal<string | null>(null);

  protected readonly EstadoDiag = EstadoDiag;
  protected readonly RespuestaCliente = RespuestaCliente;
  protected readonly ETIQUETAS = ETIQUETAS;

  protected readonly formulario = this.fb.nonNullable.group({
    vehiculoId: ['', Validators.required],
    descripcionFalla: ['', Validators.required],
    observacionesTecnicas: [''],
    montoEstimado: this.fb.control<number | null>(null),
  });

  // --- Diagnóstico asistido: sugerencias mientras se redacta la falla --------
  protected readonly sugerencia = signal<SugerenciaDiagnostico | null>(null);
  protected readonly cargandoSugerencia = signal(false);

  /** Fallas ya registradas: para no volver a escribir una que ya se tipeó antes. */
  protected readonly fallasSugeridas = signal<string[]>([]);

  protected readonly opcionesVehiculo = computed<OpcionSelector[]>(() =>
    this.vehiculos().map((v) => ({
      valor: v.vehiculoId,
      etiqueta: `${v.placa} — ${v.marca} ${v.modelo}`,
      detalle: v.nombreCliente,
    })),
  );

  constructor() {
    this.estadoFiltro.set(this.preferencias.leer(CLAVE_FILTRO, ''));

    this.cargar();
    this.vehiculosService
      .getAll(undefined, undefined, 1, 500)
      .subscribe((resultado) => this.vehiculos.set(resultado.items));

    // Solo para el autocompletado de "Descripción de la falla": no reemplaza
    // la tabla paginada de arriba.
    this.servicio
      .getAll({ pagina: 1, tamanoPagina: 500 })
      .subscribe((resultado) =>
        this.fallasSugeridas.set(unicosOrdenados(resultado.items.map((d) => d.descripcionFalla))),
      );

    // Diagnóstico asistido: apenas se redacta la falla (con algo de texto real),
    // se buscan casos históricos parecidos y se sugieren servicios/repuestos/precio.
    this.formulario.controls.descripcionFalla.valueChanges
      .pipe(
        map((texto) => texto.trim()),
        debounceTime(500),
        distinctUntilChanged(),
        switchMap((texto) => {
          if (texto.length < 8) {
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
  }

  protected cargar(): void {
    this.cargando.set(true);

    const estado = this.estadoFiltro();

    this.servicio
      .getAll({
        estado: estado === '' ? undefined : (Number(estado) as EstadoDiag),
        buscar: this.buscar() || undefined,
        pagina: this.pagina(),
        tamanoPagina: this.tamanoPagina(),
      })
      .subscribe({
        next: (resultado) => {
          this.diagnosticos.set(resultado.items);
          this.totalRegistros.set(resultado.totalRegistros);
          this.totalPaginas.set(resultado.totalPaginas);
          this.cargando.set(false);
        },
        error: () => this.cargando.set(false),
      });
  }

  protected onFiltrarEstado(valor: string): void {
    this.estadoFiltro.set(valor);
    this.preferencias.guardar(CLAVE_FILTRO, valor);
    this.pagina.set(1);
    this.cargar();
  }

  protected onBuscar(valor: string): void {
    this.buscar.set(valor);
    this.pagina.set(1);
    this.cargar();
  }

  protected cambiarPagina(pagina: number): void {
    this.pagina.set(pagina);
    this.cargar();
  }

  protected cambiarTamano(tamano: number): void {
    this.tamanoPagina.set(tamano);
    this.pagina.set(1);
    this.cargar();
  }

  /**
   * Posiciona el menú contextual (⋮) al abrirse. La tabla vive dentro de un
   * contenedor con `overflow-x: auto` que, por spec de CSS, también recorta en
   * vertical: un menú `absolute` quedaría atrapado (y con pocas filas obligaba
   * a hacer scroll dentro de la tarjeta para verlo entero). Se lo pasa a
   * `position: fixed`, que escapa cualquier contenedor con overflow, y se
   * decide arriba/abajo según el espacio libre en la ventana. Es solo
   * presentación: no toca datos ni la lógica del diagnóstico.
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
    return this.auth.esAdministrador() || diagnostico.mecanicoId === this.auth.sesion()?.usuarioId;
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

  protected abrirNuevo(): void {
    this.editando.set(null);
    this.formulario.reset();
    this.formulario.controls.vehiculoId.enable();
    this.sugerencia.set(null);
    this.formularioAbierto.set(true);
  }

  protected abrirEditar(diagnostico: Diagnostico): void {
    this.editando.set(diagnostico);
    this.sugerencia.set(null);
    this.formulario.patchValue({
      vehiculoId: diagnostico.vehiculoId,
      descripcionFalla: diagnostico.descripcionFalla,
      observacionesTecnicas: diagnostico.observacionesTecnicas ?? '',
      montoEstimado: diagnostico.montoEstimado ?? null,
    });

    // El vehículo no se reasigna: sería otro diagnóstico.
    this.formulario.controls.vehiculoId.disable();
    this.formularioAbierto.set(true);
  }

  protected cerrarFormulario(): void {
    this.formularioAbierto.set(false);
    this.editando.set(null);
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
      ? this.servicio.actualizar(enEdicion.diagnosticoId, {
          descripcionFalla: datos.descripcionFalla,
          observacionesTecnicas: datos.observacionesTecnicas,
          montoEstimado: datos.montoEstimado,
        })
      : this.servicio.crear(datos);

    peticion.subscribe({
      next: () => {
        this.notificacion.exito(
          enEdicion ? 'Diagnóstico actualizado.' : 'Diagnóstico registrado correctamente.',
        );
        this.guardando.set(false);
        this.cerrarFormulario();
        this.cargar();
      },
      error: () => this.guardando.set(false),
    });
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

  // --- Respuesta del cliente y presupuesto en PDF ---------------------------

  protected abrirResponder(diagnostico: Diagnostico): void {
    this.comentarioCliente = '';
    this.respondiendo.set(diagnostico);
  }

  protected confirmarRespuesta(respuesta: RespuestaCliente): void {
    const diagnostico = this.respondiendo();
    if (!diagnostico) return;

    this.guardando.set(true);

    this.servicio
      .responder(diagnostico.diagnosticoId, {
        respuesta,
        comentarioCliente: this.comentarioCliente || null,
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
            this.notificacion.exito(`Presupuesto aprobado: se creó la orden ${actualizado.ordenId}.`);
            void this.router.navigate(['/ordenes', actualizado.ordenId]);
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
        this.cargar();
      },
      error: () => {
        this.guardando.set(false);
        this.porAnular.set(null);
      },
    });
  }
}
