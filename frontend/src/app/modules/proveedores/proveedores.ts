import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { Proveedor } from '../../core/models/inventario.model';
import { ProveedoresService } from '../../core/services/inventario.service';
import { NotificacionService } from '../../core/services/notificacion.service';
import { Confirmacion } from '../../shared/components/confirmacion';
import { EstadoTabla } from '../../shared/components/estado-tabla';
import { Modal } from '../../shared/components/modal';
import { Atajo } from '../../shared/directives/atajo';

/** USU028 — gestión de proveedores. */
@Component({
  selector: 'app-proveedores',
  imports: [ReactiveFormsModule, Modal, Confirmacion, EstadoTabla, Atajo],
  template: `
    <div class="fila-entre envuelve mb-2">
      <div>
        <h1>Proveedores</h1>
        <p class="texto-tenue texto-sm mb-0">Abastecedores de repuestos del taller</p>
      </div>
      <button
        type="button"
        class="btn btn-primario"
        appAtajo="n"
        title="Atajo: tecla N"
        (click)="abrirNuevo()"
      >
        + Nuevo proveedor
      </button>
    </div>

    <div class="tarjeta">
      <div class="tarjeta-encabezado">
        <input
          type="search"
          placeholder="Buscar por nombre o contacto…"
          style="max-width: 320px"
          [value]="buscar()"
          (input)="onBuscar($any($event.target).value)"
        />
        <span class="texto-tenue texto-sm">{{ proveedores().length }} registro(s)</span>
      </div>

      @if (cargando() || proveedores().length === 0) {
        <app-estado-tabla
          [cargando]="cargando()"
          [hayFiltro]="buscar().length > 0"
          titulo="Sin proveedores registrados"
          descripcion="Registre un proveedor para poder cargar compras de repuestos."
        />
      } @else {
        <div class="tabla-contenedor">
          <table class="tabla">
            <thead>
              <tr>
                <th>Código</th>
                <th>Proveedor</th>
                <th>Contacto</th>
                <th>Teléfono</th>
                <th>Email</th>
                <th class="num">Repuestos</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (proveedor of proveedores(); track proveedor.proveedorId) {
                <tr>
                  <td class="codigo">{{ proveedor.proveedorId }}</td>
                  <td class="texto-fuerte">{{ proveedor.nombre }}</td>
                  <td>{{ proveedor.contacto || '—' }}</td>
                  <td>{{ proveedor.telefono || '—' }}</td>
                  <td class="texto-sm">{{ proveedor.email || '—' }}</td>
                  <td class="num">{{ proveedor.cantidadRepuestos }}</td>
                  <td>
                    <div class="acciones">
                      <button type="button" class="btn-enlace" (click)="abrirEditar(proveedor)">
                        Editar
                      </button>
                      <button
                        type="button"
                        class="btn-enlace texto-rojo"
                        (click)="porEliminar.set(proveedor)"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>

    @if (formularioAbierto()) {
      <app-modal
        [titulo]="editando() ? 'Editar proveedor' : 'Nuevo proveedor'"
        (cerrar)="cerrarFormulario()"
      >
        <form [formGroup]="formulario" id="form-proveedor" (ngSubmit)="guardar()">
          <div class="campo">
            <label for="nombre">Nombre <span class="obligatorio">*</span></label>
            <input id="nombre" formControlName="nombre" [class.invalido]="invalido('nombre')" />
            @if (invalido('nombre')) {
              <span class="campo-error">El nombre es obligatorio.</span>
            }
          </div>

          <div class="rejilla">
            <div class="campo">
              <label for="contacto">Persona de contacto</label>
              <input id="contacto" formControlName="contacto" />
            </div>

            <div class="campo">
              <label for="telefono">Teléfono</label>
              <input id="telefono" formControlName="telefono" />
            </div>
          </div>

          <div class="campo">
            <label for="email">Email</label>
            <input
              id="email"
              type="email"
              formControlName="email"
              [class.invalido]="invalido('email')"
            />
            @if (invalido('email')) {
              <span class="campo-error">El formato del email no es válido.</span>
            }
          </div>

          <div class="campo">
            <label for="direccion">Dirección</label>
            <input id="direccion" formControlName="direccion" />
          </div>
        </form>

        <div pie>
          <button type="button" class="btn btn-secundario" (click)="cerrarFormulario()">
            Cancelar
          </button>
          <button
            type="submit"
            form="form-proveedor"
            class="btn btn-primario"
            [disabled]="guardando()"
          >
            {{ guardando() ? 'Guardando…' : 'Guardar' }}
          </button>
        </div>
      </app-modal>
    }

    @if (porEliminar(); as proveedor) {
      <app-confirmacion
        titulo="Eliminar proveedor"
        [mensaje]="'¿Eliminar a ' + proveedor.nombre + '?'"
        advertencia="Solo se puede eliminar si no tiene repuestos ni compras asociadas."
        textoConfirmar="Eliminar"
        [peligroso]="true"
        [procesando]="guardando()"
        (confirmar)="eliminar()"
        (cancelar)="porEliminar.set(null)"
      />
    }
  `,
})
export class Proveedores {
  private readonly servicio = inject(ProveedoresService);
  private readonly fb = inject(FormBuilder);
  private readonly notificacion = inject(NotificacionService);

  protected readonly proveedores = signal<Proveedor[]>([]);
  protected readonly cargando = signal(true);
  protected readonly buscar = signal('');
  protected readonly guardando = signal(false);

  protected readonly editando = signal<Proveedor | null>(null);
  protected readonly formularioAbierto = signal(false);
  protected readonly porEliminar = signal<Proveedor | null>(null);

  protected readonly formulario = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(150)]],
    contacto: ['', Validators.maxLength(100)],
    telefono: ['', Validators.maxLength(20)],
    email: ['', [Validators.email, Validators.maxLength(150)]],
    direccion: ['', Validators.maxLength(200)],
  });

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);

    this.servicio.getAll(this.buscar() || undefined).subscribe({
      next: (lista) => {
        this.proveedores.set(lista);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  protected onBuscar(valor: string): void {
    this.buscar.set(valor);
    this.cargar();
  }

  protected invalido(control: string): boolean {
    const campo = this.formulario.get(control);
    return !!campo && campo.invalid && campo.touched;
  }

  protected abrirNuevo(): void {
    this.editando.set(null);
    this.formulario.reset();
    this.formularioAbierto.set(true);
  }

  protected abrirEditar(proveedor: Proveedor): void {
    this.editando.set(proveedor);
    this.formulario.patchValue({
      nombre: proveedor.nombre,
      contacto: proveedor.contacto ?? '',
      telefono: proveedor.telefono ?? '',
      email: proveedor.email ?? '',
      direccion: proveedor.direccion ?? '',
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
      ? this.servicio.actualizar(enEdicion.proveedorId, datos)
      : this.servicio.crear(datos);

    peticion.subscribe({
      next: () => {
        this.notificacion.exito(
          enEdicion ? 'Proveedor actualizado.' : 'Proveedor registrado correctamente.',
        );
        this.guardando.set(false);
        this.cerrarFormulario();
        this.cargar();
      },
      error: () => this.guardando.set(false),
    });
  }

  protected eliminar(): void {
    const proveedor = this.porEliminar();
    if (!proveedor) return;

    this.guardando.set(true);

    this.servicio.eliminar(proveedor.proveedorId).subscribe({
      next: (respuesta) => {
        this.notificacion.exito(respuesta.mensaje ?? 'Proveedor eliminado.');
        this.guardando.set(false);
        this.porEliminar.set(null);
        this.cargar();
      },
      error: () => {
        this.guardando.set(false);
        this.porEliminar.set(null);
      },
    });
  }
}
