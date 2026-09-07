import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { EstadoServicio } from '../../core/models/enums';
import { TipoServicio as TipoServicioModel } from '../../core/models/taller.model';
import { NotificacionService } from '../../core/services/notificacion.service';
import { TiposServicioService } from '../../core/services/taller.service';
import { EstadoTabla } from '../../shared/components/estado-tabla';
import { InsigniaEstado } from '../../shared/components/insignia-estado';
import { Modal } from '../../shared/components/modal';
import { Atajo } from '../../shared/directives/atajo';
import { SiTieneRol } from '../../shared/directives/si-tiene-rol';
import { BolivianosPipe } from '../../shared/pipes/bolivianos.pipe';

/** USU013 — catálogo de tipos de servicio y sus precios base. */
@Component({
  selector: 'app-tipos-servicio',
  imports: [
    ReactiveFormsModule,
    Modal,
    EstadoTabla,
    InsigniaEstado,
    Atajo,
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
  protected readonly cargando = signal(true);
  protected readonly buscar = signal('');
  protected readonly soloActivos = signal(true);
  protected readonly guardando = signal(false);

  protected readonly editando = signal<TipoServicioModel | null>(null);
  protected readonly formularioAbierto = signal(false);

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

    this.servicio.getAll(this.buscar() || undefined, this.soloActivos()).subscribe({
      next: (lista) => {
        this.servicios.set(lista);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  protected onBuscar(valor: string): void {
    this.buscar.set(valor);
    this.cargar();
  }

  protected alternarInactivos(): void {
    this.soloActivos.update((v) => !v);
    this.cargar();
  }

  protected invalido(control: string): boolean {
    const campo = this.formulario.get(control);
    return !!campo && campo.invalid && campo.touched;
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

  protected cambiarEstado(servicio: TipoServicioModel): void {
    const nuevo =
      servicio.estado === EstadoServicio.Activo
        ? EstadoServicio.Inactivo
        : EstadoServicio.Activo;

    this.servicio.cambiarEstado(servicio.servicioId, nuevo).subscribe(() => {
      this.notificacion.exito(
        nuevo === EstadoServicio.Activo ? 'Servicio reactivado.' : 'Servicio dado de baja.',
      );
      this.cargar();
    });
  }
}
