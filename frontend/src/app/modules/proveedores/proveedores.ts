import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { Compra, Proveedor } from '../../core/models/inventario.model';
import { ComprasService, ProveedoresService } from '../../core/services/inventario.service';
import { NotificacionService } from '../../core/services/notificacion.service';
import { Confirmacion } from '../../shared/components/confirmacion';
import { EstadoTabla } from '../../shared/components/estado-tabla';
import { Cajon } from '../../shared/components/cajon';
import { Paginador } from '../../shared/components/paginador';
import { TODOS_LOS_REGISTROS } from '../../shared/paginacion-local';
import { BolivianosPipe } from '../../shared/pipes/bolivianos.pipe';
import { Atajo } from '../../shared/directives/atajo';
import { EnfocarError } from '../../shared/directives/enfocar-error';
import { unicosOrdenados } from '../../shared/sugerencias-texto';

/** USU028 — gestión de proveedores. */
@Component({
  selector: 'app-proveedores',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    DatePipe,
    Cajon,
    Paginador,
    Confirmacion,
    EstadoTabla,
    BolivianosPipe,
    Atajo,
    EnfocarError,
  ],
  templateUrl: './proveedores.html',
  styleUrl: './proveedores.css',
})
export class Proveedores {
  private readonly servicio = inject(ProveedoresService);
  private readonly comprasService = inject(ComprasService);
  private readonly fb = inject(FormBuilder);
  private readonly notificacion = inject(NotificacionService);

  protected readonly proveedores = signal<Proveedor[]>([]);
  /** Solo para el autocompletado de "Dirección": no reemplaza la tabla paginada. */
  protected readonly direccionesSugeridas = signal<string[]>([]);
  protected readonly cargando = signal(true);
  protected readonly buscar = signal('');
  protected readonly guardando = signal(false);

  /** Compras del taller, para saber cuánto se le compró a cada uno y cuándo. */
  private readonly compras = signal<Compra[]>([]);

  protected readonly resumenCompras = computed(() => {
    const mapa = new Map<string, { total: number; ultima: string | null }>();
    for (const c of this.compras()) {
      if (!c.proveedorId) continue;
      const actual = mapa.get(c.proveedorId) ?? { total: 0, ultima: null };
      actual.total += c.total;
      if (!actual.ultima || c.fecha > actual.ultima) actual.ultima = c.fecha;
      mapa.set(c.proveedorId, actual);
    }
    return mapa;
  });

  protected iniciales(nombre: string): string {
    const palabras = nombre.split(/\s+/).filter((p) => p.length > 2);
    return (palabras.length ? palabras : [nombre]).slice(0, 2).map((p) => p[0] ?? '').join('').toUpperCase();
  }

  protected enlaceLlamada(telefono: string): string {
    return 'tel:' + telefono.replace(/[^\d+]/g, '');
  }

  protected readonly pagina = signal(1);
  protected readonly tamanoPagina = signal(20);
  protected readonly totalRegistros = signal(0);
  protected readonly totalPaginas = signal(0);

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
    this.comprasService
      .getAll({ tamanoPagina: TODOS_LOS_REGISTROS })
      .subscribe({ next: (r) => this.compras.set(r.items), error: () => this.compras.set([]) });

    // Solo para el autocompletado de "Dirección": no reemplaza la tabla paginada.
    this.servicio
      .getAll(undefined, 1, TODOS_LOS_REGISTROS)
      .subscribe((resultado) =>
        this.direccionesSugeridas.set(unicosOrdenados(resultado.items.map((p) => p.direccion))),
      );
  }

  protected cargar(): void {
    this.cargando.set(true);

    this.servicio
      .getAll(this.buscar() || undefined, this.pagina(), this.tamanoPagina())
      .subscribe({
        next: (resultado) => {
          this.proveedores.set(resultado.items);
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
    if (campo.hasError('email')) return 'Ingrese un email válido.';
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

  /**
   * Enlace directo a un chat de WhatsApp para pedir repuestos al instante. El
   * teléfono se guarda como texto libre: acá solo se limpia para armar la
   * URL — si no trae código de país se asume Bolivia (+591).
   */
  protected linkWhatsapp(telefono: string): string {
    const digitos = telefono.replace(/\D/g, '');
    const conCodigo = digitos.startsWith('591') ? digitos : `591${digitos}`;
    return `https://wa.me/${conCodigo}`;
  }

  /** Cuando está activo, tras guardar se limpia el formulario en vez de cerrarlo. */
  private crearOtro = false;

  protected abrirNuevo(): void {
    this.editando.set(null);
    this.formulario.reset();
    this.formularioAbierto.set(true);
  }

  /** Marca que, al guardar, el modal siga abierto para cargar otro proveedor. */
  protected marcarCrearOtro(): void {
    this.crearOtro = true;
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
      this.crearOtro = false;
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
        // "Crear otro" solo aplica a un alta; en edición siempre se cierra.
        const seguir = this.crearOtro && !enEdicion;
        this.crearOtro = false;
        this.notificacion.exito(
          enEdicion ? 'Proveedor actualizado.' : 'Proveedor registrado correctamente.',
        );
        this.guardando.set(false);
        if (seguir) {
          // El modal sigue abierto y listo para el siguiente proveedor.
          this.editando.set(null);
          this.formulario.reset();
        } else {
          this.cerrarFormulario();
        }
        this.cargar();
      },
      error: () => {
        this.crearOtro = false;
        this.guardando.set(false);
      },
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
