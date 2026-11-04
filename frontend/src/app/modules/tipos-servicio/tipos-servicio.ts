import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';

import { EstadoServicio } from '../../core/models/enums';
import { CategoriaRepuesto, CategoriaResumen } from '../../core/models/inventario.model';
import { TipoServicio as TipoServicioModel } from '../../core/models/taller.model';
import { AuthService } from '../../core/services/auth.service';
import { CategoriasRepuestoService } from '../../core/services/inventario.service';
import { NotificacionService } from '../../core/services/notificacion.service';
import { TiposServicioService } from '../../core/services/taller.service';
import { coincidePorPalabras } from '../../shared/busqueda';
import { sugerirCategoriasServicio } from '../../shared/categorias-repuesto';
import { Cajon } from '../../shared/components/cajon';
import { EstadoTabla } from '../../shared/components/estado-tabla';
import { OpcionSelector, SelectorBusqueda } from '../../shared/components/selector-busqueda';
import { Atajo } from '../../shared/directives/atajo';
import { EnfocarError } from '../../shared/directives/enfocar-error';
import { SiTieneRol } from '../../shared/directives/si-tiene-rol';
import { BolivianosPipe } from '../../shared/pipes/bolivianos.pipe';

/**
 * Nombres de servicio típicos de un taller: solo el punto de partida del
 * autocompletado al dar de alta el catálogo por primera vez — escribir menos,
 * no una lista cerrada (el nombre sigue siendo texto libre).
 */
const SERVICIOS_COMUNES = [
  'Cambio de aceite y filtro',
  'Alineación y balanceo',
  'Cambio de pastillas de freno',
  'Cambio de discos de freno',
  'Cambio de batería',
  'Cambio de correa de distribución',
  'Cambio de bujías',
  'Revisión de frenos',
  'Cambio de amortiguadores',
  'Cambio de llantas',
  'Diagnóstico computarizado',
  'Cambio de filtro de aire',
  'Cambio de filtro de combustible',
  'Cambio de líquido de frenos',
  'Cambio de refrigerante',
  'Reparación de embrague',
  'Cambio de aceite de transmisión',
  'Revisión de suspensión',
  'Alineación de dirección',
  'Cambio de banda de accesorios',
];

/** Las pestañas del catálogo: todo, lo que lleva repuestos o solo mano de obra. */
type Vista = 'todos' | 'repuestos' | 'mano';

/**
 * USU013 — catálogo de tipos de servicio y sus precios base.
 *
 * El catálogo de un taller es corto: se trae entero y se filtra en pantalla,
 * así las pestañas muestran sus cantidades y la búsqueda responde al tipear.
 * Los dados de baja siguen en la lista, apagados, para volver a encenderlos
 * con el interruptor sin buscarlos aparte.
 */
@Component({
  selector: 'app-tipos-servicio',
  imports: [
    ReactiveFormsModule,
    FormsModule,
    Cajon,
    EstadoTabla,
    SelectorBusqueda,
    Atajo,
    EnfocarError,
    SiTieneRol,
    BolivianosPipe,
  ],
  templateUrl: './tipos-servicio.html',
  styleUrl: './tipos-servicio.css',
})
export class TiposServicio {
  private readonly servicio = inject(TiposServicioService);
  private readonly fb = inject(FormBuilder);
  private readonly notificacion = inject(NotificacionService);
  private readonly categoriasService = inject(CategoriasRepuestoService);
  protected readonly auth = inject(AuthService);

  protected readonly servicios = signal<TipoServicioModel[]>([]);
  protected readonly serviciosComunes = SERVICIOS_COMUNES;
  protected readonly cargando = signal(true);
  protected readonly buscar = signal('');
  protected readonly vista = signal<Vista>('todos');
  protected readonly guardando = signal(false);

  /** Servicio cuyo interruptor se está cambiando, para no tocarlo dos veces. */
  protected readonly cambiandoEstado = signal<string | null>(null);

  protected readonly editando = signal<TipoServicioModel | null>(null);
  protected readonly formularioAbierto = signal(false);

  protected readonly EstadoServicio = EstadoServicio;

  // --- Repuestos que lleva el servicio ---------------------------------------
  protected readonly categorias = signal<CategoriaRepuesto[]>([]);
  /** Categorías elegidas en el formulario: en la orden solo se aceptan esas. */
  protected readonly categoriasElegidas = signal<CategoriaResumen[]>([]);
  /** "+ Agregar categoría" muestra el buscador de categorías. */
  protected readonly agregandoCategoria = signal(false);
  /** Cambia en cada alta: recrea el selector para dejarlo vacío otra vez. */
  protected readonly reinicioSelector = signal(0);

  protected readonly opcionesCategoria = computed<OpcionSelector[]>(() => {
    const elegidas = new Set(this.categoriasElegidas().map((c) => c.categoriaId));
    return this.categorias()
      .filter((c) => !elegidas.has(c.categoriaId))
      .map((c) => ({
        valor: c.categoriaId,
        etiqueta: c.nombre,
        detalle: `${c.cantidadRepuestos} repuesto(s) en inventario`,
      }));
  });

  // --- Lista ------------------------------------------------------------------

  /** Los activos primero y después por código, como se los nombra en el taller. */
  private readonly ordenados = computed(() =>
    [...this.servicios()].sort(
      (a, b) =>
        Number(a.estado !== EstadoServicio.Activo) - Number(b.estado !== EstadoServicio.Activo) ||
        a.servicioId.localeCompare(b.servicioId),
    ),
  );

  protected readonly cuentas = computed(() => {
    const lista = this.servicios();
    const repuestos = lista.filter((s) => s.requiereRepuesto).length;
    return { todos: lista.length, repuestos, mano: lista.length - repuestos };
  });

  protected readonly filtrados = computed(() => {
    const texto = this.buscar();
    const vista = this.vista();

    return this.ordenados().filter(
      (s) =>
        (vista === 'todos' || (vista === 'repuestos') === s.requiereRepuesto) &&
        coincidePorPalabras(texto, s.servicioId, s.nombre, s.descripcion ?? ''),
    );
  });

  protected readonly formulario = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(100)]],
    descripcion: ['', Validators.maxLength(255)],
    precioBase: [0, [Validators.required, Validators.min(0)]],
    requiereRepuesto: [false],
  });

  constructor() {
    this.cargar();
    this.categoriasService.getAll().subscribe((lista) => this.categorias.set(lista));
  }

  protected cargar(): void {
    this.cargando.set(true);

    // Todos de una vez, también los dados de baja (soloActivos = false).
    this.servicio.getAll(undefined, false, 1, 500).subscribe({
      next: (resultado) => {
        this.servicios.set(resultado.items);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  protected invalido(control: string): boolean {
    const campo = this.formulario.get(control);
    return !!campo && campo.invalid && campo.touched;
  }

  /** Mensaje concreto por campo, en vez de un genérico "revise el formulario". */
  protected error(control: string): string {
    const campo = this.formulario.get(control);
    if (!campo || !this.invalido(control)) return '';

    if (campo.hasError('required')) return 'Este campo es obligatorio.';
    if (campo.hasError('min')) return `El valor mínimo es ${campo.getError('min').min}.`;
    if (campo.hasError('max')) return `El valor máximo es ${campo.getError('max').max}.`;
    if (campo.hasError('maxlength')) {
      const { requiredLength } = campo.getError('maxlength');
      return `Máximo ${requiredLength} caracteres.`;
    }

    return 'Revise el valor ingresado.';
  }

  // --- Formulario en el panel lateral ----------------------------------------

  protected abrirNuevo(): void {
    this.editando.set(null);
    // Un servicio nuevo casi siempre lleva repuestos: queda elegido y se cambia con un clic.
    this.formulario.reset({ nombre: '', descripcion: '', precioBase: 0, requiereRepuesto: true });
    this.categoriasElegidas.set([]);
    this.agregandoCategoria.set(false);
    this.formularioAbierto.set(true);
  }

  protected abrirEditar(servicio: TipoServicioModel): void {
    this.editando.set(servicio);
    this.formulario.reset({
      nombre: servicio.nombre,
      descripcion: servicio.descripcion ?? '',
      precioBase: servicio.precioBase,
      requiereRepuesto: servicio.requiereRepuesto,
    });
    this.categoriasElegidas.set([...(servicio.categorias ?? [])]);
    this.agregandoCategoria.set(false);
    this.formularioAbierto.set(true);
  }

  protected elegirRequiereRepuesto(lleva: boolean): void {
    this.formulario.controls.requiereRepuesto.setValue(lleva);
    this.formulario.controls.requiereRepuesto.markAsDirty();
  }

  /** Categorías que sugiere el nombre del servicio y todavía no están elegidas. */
  protected sugeridas(): CategoriaRepuesto[] {
    const elegidas = new Set(this.categoriasElegidas().map((c) => c.categoriaId));
    return sugerirCategoriasServicio(this.formulario.controls.nombre.value, this.categorias()).filter(
      (c) => !elegidas.has(c.categoriaId),
    );
  }

  protected mostrarAgregarCategoria(): void {
    this.agregandoCategoria.set(true);
    // Recién dibujado el buscador se le puede pasar el foco.
    setTimeout(() => document.getElementById('categoriaServicio')?.focus());
  }

  /**
   * Agrega la categoría elegida. Si es un nombre nuevo escrito a mano
   * (“+ Escobillas”), primero se crea y después se agrega.
   */
  protected agregarCategoria(valor: string | null): void {
    if (!valor) return;
    this.reinicioSelector.update((n) => n + 1);
    this.agregandoCategoria.set(false);

    const existente = this.categorias().find((c) => c.categoriaId === valor);
    if (existente) {
      this.sumarCategoria(existente);
      return;
    }

    this.categoriasService.crear(valor.trim()).subscribe((creada) => {
      this.categorias.update((lista) =>
        [...lista, creada].sort((a, b) => a.nombre.localeCompare(b.nombre)),
      );
      this.sumarCategoria(creada);
      this.notificacion.exito(`Categoría “${creada.nombre}” creada.`);
    });
  }

  protected sumarCategoria(categoria: CategoriaResumen): void {
    this.categoriasElegidas.update((lista) =>
      lista.some((c) => c.categoriaId === categoria.categoriaId)
        ? lista
        : [...lista, { categoriaId: categoria.categoriaId, nombre: categoria.nombre }],
    );
  }

  protected quitarCategoria(categoriaId: string): void {
    this.categoriasElegidas.update((lista) => lista.filter((c) => c.categoriaId !== categoriaId));
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
    const valores = this.formulario.getRawValue();
    const datos = {
      ...valores,
      // Solo mano de obra: no hay repuesto que controlar.
      categoriaIds: valores.requiereRepuesto
        ? this.categoriasElegidas().map((c) => c.categoriaId)
        : [],
    };
    const enEdicion = this.editando();

    const peticion = enEdicion
      ? this.servicio.actualizar(enEdicion.servicioId, datos)
      : this.servicio.crear(datos);

    peticion.subscribe({
      next: () => {
        this.notificacion.exito(
          enEdicion ? 'Servicio actualizado.' : 'Servicio agregado al catálogo.',
        );
        this.guardando.set(false);
        this.cerrarFormulario();
        this.cargar();
      },
      error: () => this.guardando.set(false),
    });
  }

  // --- Interruptor "Activo" ----------------------------------------------------

  /**
   * Encender o apagar un servicio es reversible, así que el interruptor actúa
   * en el acto, sin pedir confirmación: apagado, no se ofrece en órdenes
   * nuevas; las que ya lo tienen no cambian.
   */
  protected alternarActivo(servicio: TipoServicioModel): void {
    if (this.cambiandoEstado()) return;

    const nuevo =
      servicio.estado === EstadoServicio.Activo ? EstadoServicio.Inactivo : EstadoServicio.Activo;

    this.cambiandoEstado.set(servicio.servicioId);

    this.servicio.cambiarEstado(servicio.servicioId, nuevo).subscribe({
      next: (actualizado) => {
        this.servicios.update((lista) =>
          lista.map((s) => (s.servicioId === actualizado.servicioId ? actualizado : s)),
        );
        if (this.editando()?.servicioId === actualizado.servicioId) this.editando.set(actualizado);

        this.notificacion.exito(
          nuevo === EstadoServicio.Activo
            ? `${actualizado.nombre}: activo otra vez.`
            : `${actualizado.nombre}: apagado, ya no se ofrece en órdenes nuevas.`,
        );
        this.cambiandoEstado.set(null);
      },
      error: () => this.cambiandoEstado.set(null),
    });
  }
}
