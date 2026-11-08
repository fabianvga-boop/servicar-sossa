import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { Compra, Proveedor } from '../../core/models/inventario.model';
import { ComprasService, ProveedoresService } from '../../core/services/inventario.service';
import { NotificacionService } from '../../core/services/notificacion.service';
import { coincidePorPalabras } from '../../shared/busqueda';
import { Confirmacion } from '../../shared/components/confirmacion';
import { EstadoTabla } from '../../shared/components/estado-tabla';
import { Cajon } from '../../shared/components/cajon';
import { Paginador } from '../../shared/components/paginador';
import { PaginacionLocal, TODOS_LOS_REGISTROS } from '../../shared/paginacion-local';
import { BolivianosPipe } from '../../shared/pipes/bolivianos.pipe';
import { Atajo } from '../../shared/directives/atajo';
import { EnfocarError } from '../../shared/directives/enfocar-error';
import { unicosOrdenados } from '../../shared/sugerencias-texto';

type Filtro = 'todos' | 'mes' | 'sinTelefono';
type Orden = 'nombre' | 'total' | 'ultima' | 'repuestos';

/** Un proveedor con lo que se le compró, calculado de las compras. */
interface FilaProveedor {
  proveedor: Proveedor;
  total: number;
  compras: number;
  ultima: string | null;
}

/**
 * USU028 — gestión de proveedores, en tabla: se ordena por columna y se
 * compara de un vistazo (quién vende más, a quién se le compró hace poco).
 * Tocar una fila abre la ficha; editar, sus repuestos y eliminar van en ⋯.
 */
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
  host: {
    '(document:click)': 'menuDe.set(null)',
  },
})
export class Proveedores {
  private readonly servicio = inject(ProveedoresService);
  private readonly comprasService = inject(ComprasService);
  private readonly fb = inject(FormBuilder);
  private readonly notificacion = inject(NotificacionService);

  protected readonly proveedores = signal<Proveedor[]>([]);
  protected readonly direccionesSugeridas = computed(() =>
    unicosOrdenados(this.proveedores().map((p) => p.direccion)),
  );
  protected readonly cargando = signal(true);
  protected readonly buscar = signal('');
  protected readonly guardando = signal(false);
  protected readonly filtro = signal<Filtro>('todos');
  protected readonly orden = signal<Orden>('nombre');

  /** Compras del taller, para saber cuánto se le compró a cada uno y cuándo. */
  private readonly compras = signal<Compra[]>([]);

  private readonly mesActual = new Date().toISOString().slice(0, 7);
  protected readonly nombreMes = new Date().toLocaleDateString('es-BO', { month: 'long' });

  /** Cada proveedor con su total comprado, cantidad de compras y la última. */
  protected readonly filas = computed<FilaProveedor[]>(() => {
    const resumen = new Map<string, { total: number; compras: number; ultima: string | null }>();
    for (const c of this.compras()) {
      if (!c.proveedorId) continue;
      const actual = resumen.get(c.proveedorId) ?? { total: 0, compras: 0, ultima: null };
      actual.total += c.total;
      actual.compras++;
      if (!actual.ultima || c.fecha > actual.ultima) actual.ultima = c.fecha;
      resumen.set(c.proveedorId, actual);
    }
    return this.proveedores().map((proveedor) => ({
      proveedor,
      ...(resumen.get(proveedor.proveedorId) ?? { total: 0, compras: 0, ultima: null }),
    }));
  });

  private compraEsteMes(f: FilaProveedor): boolean {
    return !!f.ultima && new Date(f.ultima).toISOString().slice(0, 7) === this.mesActual;
  }

  protected readonly indicadores = computed(() => {
    const filas = this.filas();
    return {
      cantidad: filas.length,
      total: filas.reduce((suma, f) => suma + f.total, 0),
      esteMes: filas.filter((f) => this.compraEsteMes(f)).length,
      sinTelefono: filas.filter((f) => !f.proveedor.telefono?.trim()).length,
    };
  });

  protected readonly visibles = computed(() => {
    const texto = this.buscar();
    const filtro = this.filtro();
    const orden = this.orden();
    const lista = this.filas().filter(
      (f) =>
        (filtro === 'todos' ||
          (filtro === 'mes' && this.compraEsteMes(f)) ||
          (filtro === 'sinTelefono' && !f.proveedor.telefono?.trim())) &&
        coincidePorPalabras(texto, f.proveedor.nombre, f.proveedor.contacto, f.proveedor.telefono, f.proveedor.proveedorId),
    );
    return [...lista].sort((a, b) => {
      switch (orden) {
        case 'total':
          return b.total - a.total;
        case 'ultima':
          return (b.ultima ?? '').localeCompare(a.ultima ?? '');
        case 'repuestos':
          return b.proveedor.cantidadRepuestos - a.proveedor.cantidadRepuestos;
        default:
          return a.proveedor.nombre.localeCompare(b.proveedor.nombre, 'es');
      }
    });
  });

  protected readonly paginacion = new PaginacionLocal(
    () => this.visibles(),
    () => [this.buscar(), this.filtro(), this.orden()],
  );

  /** Clic en el título de una columna: ordena por ella. */
  protected ordenarPor(orden: Orden): void {
    this.orden.set(orden);
  }

  protected iniciales(nombre: string): string {
    const palabras = nombre.split(/\s+/).filter((p) => p.length > 2);
    return (palabras.length ? palabras : [nombre]).slice(0, 2).map((p) => p[0] ?? '').join('').toUpperCase();
  }

  /** Un color de avatar por proveedor, siempre el mismo. */
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
    return meses === 1 ? 'hace 1 mes' : `hace ${meses} meses`;
  }

  protected enlaceLlamada(telefono: string): string {
    return 'tel:' + telefono.replace(/[^\d+]/g, '');
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

  // --- Menú ⋯, ficha y atajos ---------------------------------------------------

  protected readonly menuDe = signal<string | null>(null);
  protected readonly ficha = signal<FilaProveedor | null>(null);

  protected alternarMenu(evento: Event, id: string): void {
    evento.stopPropagation();
    this.menuDe.set(this.menuDe() === id ? null : id);
  }

  protected abrirFicha(fila: FilaProveedor): void {
    this.menuDe.set(null);
    this.ficha.set(fila);
  }

  protected limpiarBusqueda(): void {
    this.buscar.set('');
    this.filtro.set('todos');
  }

  // --- Formulario ---------------------------------------------------------------

  protected readonly editando = signal<Proveedor | null>(null);
  protected readonly formularioAbierto = signal(false);
  protected readonly porEliminar = signal<FilaProveedor | null>(null);

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
  }

  /** Todos de una vez: la búsqueda, los filtros y el orden son en pantalla. */
  protected cargar(): void {
    this.cargando.set(true);
    this.servicio.getAll(undefined, 1, TODOS_LOS_REGISTROS).subscribe({
      next: (resultado) => {
        this.proveedores.set(resultado.items);
        this.cargando.set(false);
        // La ficha abierta se actualiza con los datos nuevos (tras editar).
        const abierta = this.ficha();
        if (abierta) this.ficha.set(this.filas().find((f) => f.proveedor.proveedorId === abierta.proveedor.proveedorId) ?? null);
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
    if (campo.hasError('email')) return 'Ingrese un email válido.';
    if (campo.hasError('maxlength')) {
      const { requiredLength } = campo.getError('maxlength');
      return `Máximo ${requiredLength} caracteres.`;
    }

    return 'Revise el valor ingresado.';
  }

  /** Cuando está activo, tras guardar se limpia el formulario en vez de cerrarlo. */
  private crearOtro = false;

  protected abrirNuevo(): void {
    this.ficha.set(null);
    this.editando.set(null);
    this.formulario.reset();
    this.formularioAbierto.set(true);
  }

  /** Marca que, al guardar, el panel siga abierto para cargar otro proveedor. */
  protected marcarCrearOtro(): void {
    this.crearOtro = true;
  }

  protected abrirEditar(proveedor: Proveedor): void {
    this.menuDe.set(null);
    this.ficha.set(null);
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
        this.notificacion.exito(enEdicion ? 'Proveedor actualizado.' : 'Proveedor registrado correctamente.');
        this.guardando.set(false);
        if (seguir) {
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

  // --- Eliminar -------------------------------------------------------------------

  /** Con repuestos o compras no se puede: se avisa antes de intentarlo. */
  protected eliminarBloqueado(f: FilaProveedor): boolean {
    return f.proveedor.cantidadRepuestos > 0 || f.compras > 0;
  }

  protected pedirEliminar(f: FilaProveedor): void {
    this.menuDe.set(null);
    this.ficha.set(null);
    this.porEliminar.set(f);
  }

  protected eliminar(): void {
    const fila = this.porEliminar();
    if (!fila || this.eliminarBloqueado(fila)) {
      this.porEliminar.set(null);
      return;
    }

    this.guardando.set(true);
    this.servicio.eliminar(fila.proveedor.proveedorId).subscribe({
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
