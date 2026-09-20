import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { EstadoServicio } from '../../core/models/enums';
import { TipoServicio as TipoServicioModel } from '../../core/models/taller.model';
import { NotificacionService } from '../../core/services/notificacion.service';
import { TiposServicioService } from '../../core/services/taller.service';
import { Confirmacion } from '../../shared/components/confirmacion';
import { EstadoTabla } from '../../shared/components/estado-tabla';
import { InsigniaEstado } from '../../shared/components/insignia-estado';
import { Modal } from '../../shared/components/modal';
import { Paginador } from '../../shared/components/paginador';
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

/** USU013 — catálogo de tipos de servicio y sus precios base. */
@Component({
  selector: 'app-tipos-servicio',
  imports: [
    ReactiveFormsModule,
    Modal,
    Confirmacion,
    EstadoTabla,
    InsigniaEstado,
    Paginador,
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

  protected readonly servicios = signal<TipoServicioModel[]>([]);
  protected readonly serviciosComunes = SERVICIOS_COMUNES;
  protected readonly cargando = signal(true);
  protected readonly buscar = signal('');
  protected readonly soloActivos = signal(true);
  protected readonly guardando = signal(false);

  protected readonly pagina = signal(1);
  protected readonly tamanoPagina = signal(20);
  protected readonly totalRegistros = signal(0);
  protected readonly totalPaginas = signal(0);

  protected readonly editando = signal<TipoServicioModel | null>(null);
  protected readonly formularioAbierto = signal(false);
  protected readonly porCambiarEstado = signal<TipoServicioModel | null>(null);

  protected readonly EstadoServicio = EstadoServicio;

  protected readonly formulario = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(100)]],
    descripcion: ['', Validators.maxLength(255)],
    precioBase: [0, [Validators.required, Validators.min(0)]],
  });

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);

    this.servicio
      .getAll(this.buscar() || undefined, this.soloActivos(), this.pagina(), this.tamanoPagina())
      .subscribe({
        next: (resultado) => {
          this.servicios.set(resultado.items);
          this.totalRegistros.set(resultado.totalRegistros);
          this.totalPaginas.set(resultado.totalPaginas);
          this.cargando.set(false);
        },
        error: () => this.cargando.set(false),
      });
  }

  protected onBuscar(valor: string): void {
    this.buscar.set(valor);
    this.pagina.set(1);
    this.cargar();
  }

  protected alternarInactivos(): void {
    this.soloActivos.update((v) => !v);
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
    if (campo.hasError('minlength')) {
      const { requiredLength } = campo.getError('minlength');
      return `Mínimo ${requiredLength} caracteres.`;
    }
    if (campo.hasError('maxlength')) {
      const { requiredLength } = campo.getError('maxlength');
      return `Máximo ${requiredLength} caracteres.`;
    }

    return 'Revise el valor ingresado.';
  }

  protected abrirNuevo(): void {
    this.editando.set(null);
    this.formulario.reset({ nombre: '', descripcion: '', precioBase: 0 });
    this.formularioAbierto.set(true);
  }

  protected abrirEditar(servicio: TipoServicioModel): void {
    this.editando.set(servicio);
    this.formulario.patchValue({
      nombre: servicio.nombre,
      descripcion: servicio.descripcion ?? '',
      precioBase: servicio.precioBase,
    });
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

  protected cambiarEstado(): void {
    const servicio = this.porCambiarEstado();
    if (!servicio) return;

    const nuevo =
      servicio.estado === EstadoServicio.Activo
        ? EstadoServicio.Inactivo
        : EstadoServicio.Activo;

    this.guardando.set(true);

    this.servicio.cambiarEstado(servicio.servicioId, nuevo).subscribe({
      next: () => {
        this.notificacion.exito(
          nuevo === EstadoServicio.Activo ? 'Servicio reactivado.' : 'Servicio dado de baja.',
        );
        this.guardando.set(false);
        this.porCambiarEstado.set(null);
        this.cargar();
      },
      error: () => {
        this.guardando.set(false);
        this.porCambiarEstado.set(null);
      },
    });
  }
}
