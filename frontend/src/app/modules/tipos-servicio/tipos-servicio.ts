import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { EstadoServicio } from '../../core/models/enums';
import { TipoServicio as TipoServicioModel } from '../../core/models/taller.model';
import { AuthService } from '../../core/services/auth.service';
import { NotificacionService } from '../../core/services/notificacion.service';
import { TiposServicioService } from '../../core/services/taller.service';
import { EstadoTabla } from '../../shared/components/estado-tabla';
import { InsigniaEstado } from '../../shared/components/insignia-estado';
import { Modal } from '../../shared/components/modal';
import { Atajo } from '../../shared/directives/atajo';
import { BolivianosPipe } from '../../shared/pipes/bolivianos.pipe';

/** USU013 — catálogo de tipos de servicio y sus precios base. */
@Component({
  selector: 'app-tipos-servicio',
  imports: [ReactiveFormsModule, Modal, EstadoTabla, InsigniaEstado, Atajo, BolivianosPipe],
  template: `
    <div class="fila-entre envuelve mb-2">
      <div>
        <h1>Catálogo de servicios</h1>
        <p class="texto-tenue texto-sm mb-0">
          Servicios que ofrece el taller y su precio de referencia
        </p>
      </div>
      @if (auth.esAdministrador()) {
        <button
          type="button"
          class="btn btn-primario"
          appAtajo="n"
          title="Atajo: tecla N"
          (click)="abrirNuevo()"
        >
          + Nuevo servicio
        </button>
      }
    </div>

    <div class="tarjeta">
      <div class="tarjeta-encabezado">
        <div class="fila envuelve">
          <input
            type="search"
            placeholder="Buscar servicio…"
            style="max-width: 280px"
            [value]="buscar()"
            (input)="onBuscar($any($event.target).value)"
          />
          <label class="fila texto-sm" style="gap: 6px">
            <input
              type="checkbox"
              style="width: auto"
              [checked]="!soloActivos()"
              (change)="alternarInactivos()"
            />
            Mostrar dados de baja
          </label>
        </div>
        <span class="texto-tenue texto-sm">{{ servicios().length }} servicio(s)</span>
      </div>

      @if (cargando() || servicios().length === 0) {
        <app-estado-tabla
          [cargando]="cargando()"
          [hayFiltro]="buscar().length > 0"
          titulo="Sin servicios en el catálogo"
          descripcion="Registre los servicios que ofrece el taller para poder cargarlos en las órdenes."
        />
      } @else {
        <div class="tabla-contenedor">
          <table class="tabla">
            <thead>
              <tr>
                <th>Código</th>
                <th>Servicio</th>
                <th>Descripción</th>
                <th class="num">Precio base</th>
                <th>Estado</th>
                @if (auth.esAdministrador()) { <th></th> }
              </tr>
            </thead>
            <tbody>
              @for (servicio of servicios(); track servicio.servicioId) {
                <tr>
                  <td class="codigo">{{ servicio.servicioId }}</td>
                  <td class="texto-fuerte">{{ servicio.nombre }}</td>
                  <td class="texto-sm texto-tenue">{{ servicio.descripcion || '—' }}</td>
                  <td class="num">{{ servicio.precioBase | bs }}</td>
                  <td><app-insignia-estado familia="activo" [valor]="servicio.estado" /></td>
                  @if (auth.esAdministrador()) {
                    <td>
                      <div class="acciones">
                        <button type="button" class="btn-enlace" (click)="abrirEditar(servicio)">
                          Editar
                        </button>
                        <button
                          type="button"
                          class="btn-enlace"
                          (click)="cambiarEstado(servicio)"
                        >
                          {{ servicio.estado === EstadoServicio.Activo ? 'Dar de baja' : 'Reactivar' }}
                        </button>
                      </div>
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>

    @if (formularioAbierto()) {
      <app-modal
        [titulo]="editando() ? 'Editar servicio' : 'Nuevo servicio'"
        (cerrar)="cerrarFormulario()"
      >
        <form [formGroup]="formulario" id="form-servicio" (ngSubmit)="guardar()">
          <div class="campo">
            <label for="nombre">Nombre del servicio <span class="obligatorio">*</span></label>
            <input
              id="nombre"
              formControlName="nombre"
              placeholder="Ej. Cambio de aceite"
              [class.invalido]="invalido('nombre')"
            />
            @if (invalido('nombre')) {
              <span class="campo-error">El nombre es obligatorio.</span>
            }
          </div>

          <div class="campo">
            <label for="descripcion">Descripción</label>
            <textarea id="descripcion" formControlName="descripcion" rows="3"></textarea>
          </div>

          <div class="campo">
            <label for="precioBase">Precio base (Bs) <span class="obligatorio">*</span></label>
            <input
              id="precioBase"
              type="number"
              min="0"
              step="0.01"
              formControlName="precioBase"
              [class.invalido]="invalido('precioBase')"
            />
            <span class="texto-tenue texto-sm">
              Es solo referencia: al cargar el servicio en una orden se puede ajustar.
            </span>
          </div>
        </form>

        <div pie>
          <button type="button" class="btn btn-secundario" (click)="cerrarFormulario()">
            Cancelar
          </button>
          <button
            type="submit"
            form="form-servicio"
            class="btn btn-primario"
            [disabled]="guardando()"
          >
            {{ guardando() ? 'Guardando…' : 'Guardar' }}
          </button>
        </div>
      </app-modal>
    }
  `,
})
export class TiposServicio {
  private readonly servicio = inject(TiposServicioService);
  private readonly fb = inject(FormBuilder);
  private readonly notificacion = inject(NotificacionService);
  protected readonly auth = inject(AuthService);

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
