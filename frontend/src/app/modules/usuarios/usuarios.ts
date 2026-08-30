import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { EstadoUsuario } from '../../core/models/enums';
import { Rol, Usuario } from '../../core/models/personas.model';
import { NotificacionService } from '../../core/services/notificacion.service';
import { UsuariosService } from '../../core/services/usuarios.service';
import { Confirmacion } from '../../shared/components/confirmacion';
import { EstadoTabla } from '../../shared/components/estado-tabla';
import { InsigniaEstado } from '../../shared/components/insignia-estado';
import { Modal } from '../../shared/components/modal';
import { Atajo } from '../../shared/directives/atajo';

/** USU001-USU005 — gestión de usuarios del sistema. */
@Component({
  selector: 'app-usuarios',
  imports: [ReactiveFormsModule, Modal, Confirmacion, EstadoTabla, InsigniaEstado, Atajo],
  templateUrl: './usuarios.html',
})
export class Usuarios {
  private readonly servicio = inject(UsuariosService);
  private readonly fb = inject(FormBuilder);
  private readonly notificacion = inject(NotificacionService);

  protected readonly usuarios = signal<Usuario[]>([]);
  protected readonly roles = signal<Rol[]>([]);
  protected readonly cargando = signal(true);
  protected readonly buscar = signal('');
  protected readonly guardando = signal(false);

  protected readonly editando = signal<Usuario | null>(null);
  protected readonly formularioAbierto = signal(false);
  protected readonly porCambiarEstado = signal<Usuario | null>(null);

  protected readonly EstadoUsuario = EstadoUsuario;

  protected readonly formulario = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(100)]],
    apellido: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(150)]],
    username: ['', [Validators.required, Validators.maxLength(50)]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    rolId: ['', Validators.required],
    telefono: ['', Validators.maxLength(20)],
  });

  constructor() {
    this.cargar();
    this.servicio.getRoles().subscribe((roles) => this.roles.set(roles));
  }

  protected cargar(): void {
    this.cargando.set(true);

    this.servicio.getAll(this.buscar() || undefined).subscribe({
      next: (lista) => {
        this.usuarios.set(lista);
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
    // En alta la contraseña es obligatoria; al editar se cambia por su propio flujo.
    this.formulario.controls.password.enable();
    this.formulario.controls.username.enable();
    this.formularioAbierto.set(true);
  }

  protected abrirEditar(usuario: Usuario): void {
    this.editando.set(usuario);
    this.formulario.patchValue({
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      email: usuario.email,
      username: usuario.username,
      password: '',
      rolId: usuario.rolId,
      telefono: usuario.telefono ?? '',
    });

    // El backend no permite cambiar usuario ni contraseña desde este endpoint.
    this.formulario.controls.username.disable();
    this.formulario.controls.password.disable();
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
    const enEdicion = this.editando();
    const datos = this.formulario.getRawValue();

    const peticion = enEdicion
      ? this.servicio.actualizar(enEdicion.usuarioId, {
          nombre: datos.nombre,
          apellido: datos.apellido,
          email: datos.email,
          rolId: datos.rolId,
          telefono: datos.telefono,
        })
      : this.servicio.crear(datos);

    peticion.subscribe({
      next: () => {
        this.notificacion.exito(
          enEdicion ? 'Usuario actualizado.' : 'Usuario registrado correctamente.',
        );
        this.guardando.set(false);
        this.cerrarFormulario();
        this.cargar();
      },
      error: () => this.guardando.set(false),
    });
  }

  protected cambiarEstado(): void {
    const usuario = this.porCambiarEstado();
    if (!usuario) return;

    const nuevo =
      usuario.estado === EstadoUsuario.Activo ? EstadoUsuario.Inactivo : EstadoUsuario.Activo;

    this.guardando.set(true);

    this.servicio.cambiarEstado(usuario.usuarioId, nuevo).subscribe({
      next: () => {
        this.notificacion.exito(
          nuevo === EstadoUsuario.Activo ? 'Usuario activado.' : 'Usuario desactivado.',
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
