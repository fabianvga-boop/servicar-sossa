import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

import { Proveedor, Repuesto } from '../../core/models/inventario.model';
import { urlArchivo } from '../../core/services/api-base';
import { AuthService } from '../../core/services/auth.service';
import { ContadoresService } from '../../core/services/contadores.service';
import { ProveedoresService, RepuestosService } from '../../core/services/inventario.service';
import { NotificacionService } from '../../core/services/notificacion.service';
import { PreferenciasService } from '../../core/services/preferencias.service';
import { EstadoTabla } from '../../shared/components/estado-tabla';
import { Modal } from '../../shared/components/modal';
import { OpcionSelector, SelectorBusqueda } from '../../shared/components/selector-busqueda';
import { Atajo } from '../../shared/directives/atajo';
import { BolivianosPipe } from '../../shared/pipes/bolivianos.pipe';

const CLAVE_BUSCAR = 'repuestos.buscar';
const CLAVE_STOCK_BAJO = 'repuestos.stockBajo';

/** USU026, USU027, USU030 — inventario de repuestos. */
@Component({
  selector: 'app-repuestos',
  imports: [
    ReactiveFormsModule,
    Modal,
    EstadoTabla,
    SelectorBusqueda,
    Atajo,
    BolivianosPipe,
  ],
  templateUrl: './repuestos.html',
  styleUrl: './repuestos.css',
})
export class Repuestos {
  private readonly servicio = inject(RepuestosService);
  private readonly proveedoresService = inject(ProveedoresService);
  private readonly fb = inject(FormBuilder);
  private readonly notificacion = inject(NotificacionService);
  private readonly preferencias = inject(PreferenciasService);
  private readonly contadores = inject(ContadoresService);
  private readonly ruta = inject(ActivatedRoute);
  protected readonly auth = inject(AuthService);

  protected readonly repuestos = signal<Repuesto[]>([]);
  protected readonly proveedores = signal<Proveedor[]>([]);
  protected readonly cargando = signal(true);
  protected readonly buscar = signal('');
  protected readonly soloStockBajo = signal(false);
  protected readonly guardando = signal(false);

  protected readonly editando = signal<Repuesto | null>(null);
  protected readonly formularioAbierto = signal(false);
  protected readonly ajustando = signal<Repuesto | null>(null);
  protected readonly nuevoStock = signal(0);

  // Foto del producto (opcional).
  protected readonly fotoDe = signal<Repuesto | null>(null);
  protected readonly subiendoFoto = signal(false);
  protected readonly urlArchivo = urlArchivo;

  // Foto elegida en el propio formulario de alta/edición, antes de guardar.
  protected readonly archivoFoto = signal<File | null>(null);
  protected readonly previsualizacionFoto = signal<string | null>(null);

  protected readonly formulario = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(150)]],
    descripcion: ['', Validators.maxLength(255)],
    stockActual: [0, [Validators.required, Validators.min(0)]],
    stockMinimo: [0, [Validators.required, Validators.min(0)]],
    precioCompra: [0, [Validators.required, Validators.min(0)]],
    precioVenta: [0, [Validators.required, Validators.min(0)]],
    proveedorId: [''],
  });

  protected readonly opcionesProveedor = computed<OpcionSelector[]>(() =>
    this.proveedores().map((p) => ({
      valor: p.proveedorId,
      etiqueta: p.nombre,
      detalle: `${p.cantidadRepuestos} repuesto(s)`,
    })),
  );

  constructor() {
    // El panel enlaza aquí con ?stockBajo=true desde la alerta de reposición, y
    // el buscador global con ?buscar=… Si no viene nada por URL se restaura el
    // último filtro que el usuario dejó puesto.
    const parametros = this.ruta.snapshot.queryParamMap;

    this.buscar.set(parametros.get('buscar') ?? this.preferencias.leer(CLAVE_BUSCAR, ''));
    this.soloStockBajo.set(
      parametros.get('stockBajo') === 'true' ||
        (!parametros.has('stockBajo') && this.preferencias.leer(CLAVE_STOCK_BAJO, false)),
    );

    this.cargar();

    if (this.auth.esAdministrador()) {
      this.proveedoresService.getAll().subscribe((lista) => this.proveedores.set(lista));
    }
  }

  protected cargar(): void {
    this.cargando.set(true);

    this.servicio
      .getAll({
        buscar: this.buscar() || undefined,
        soloStockBajo: this.soloStockBajo() || undefined,
      })
      .subscribe({
        next: (lista) => {
          this.repuestos.set(lista);
          this.cargando.set(false);
        },
        error: () => this.cargando.set(false),
      });
  }

  protected onBuscar(valor: string): void {
    this.buscar.set(valor);
    this.preferencias.guardar(CLAVE_BUSCAR, valor);
    this.cargar();
  }

  protected alternarStockBajo(): void {
    this.soloStockBajo.update((v) => !v);
    this.preferencias.guardar(CLAVE_STOCK_BAJO, this.soloStockBajo());
    this.cargar();
  }

  protected invalido(control: string): boolean {
    const campo = this.formulario.get(control);
    return !!campo && campo.invalid && (campo.touched || campo.dirty);
  }

  /** Mensaje de error concreto por campo, en vez de un "revise el formulario". */
  protected error(control: string): string {
    const campo = this.formulario.get(control);
    if (!campo || !this.invalido(control)) return '';

    if (campo.hasError('required')) return 'Este campo es obligatorio.';
    if (campo.hasError('min')) return 'No puede ser un número negativo.';
    if (campo.hasError('maxlength')) {
      const { requiredLength } = campo.getError('maxlength');
      return `Máximo ${requiredLength} caracteres.`;
    }

    return 'Revise el valor ingresado.';
  }

  protected abrirNuevo(): void {
    this.editando.set(null);
    this.formulario.reset({
      stockActual: 0,
      stockMinimo: 0,
      precioCompra: 0,
      precioVenta: 0,
      proveedorId: '',
    });
    this.formulario.controls.stockActual.enable();
    this.archivoFoto.set(null);
    this.previsualizacionFoto.set(null);
    this.formularioAbierto.set(true);
  }

  protected abrirEditar(repuesto: Repuesto): void {
    this.editando.set(repuesto);
    this.formulario.patchValue({
      nombre: repuesto.nombre,
      descripcion: repuesto.descripcion ?? '',
      stockActual: repuesto.stockActual,
      stockMinimo: repuesto.stockMinimo,
      precioCompra: repuesto.precioCompra,
      precioVenta: repuesto.precioVenta,
      proveedorId: repuesto.proveedorId ?? '',
    });

    // El stock no se edita aquí: se mueve por compras y órdenes, o por ajuste.
    this.formulario.controls.stockActual.disable();
    this.archivoFoto.set(null);
    this.previsualizacionFoto.set(repuesto.fotoUrl ? this.urlArchivo(repuesto.fotoUrl) : null);
    this.formularioAbierto.set(true);
  }

  protected cerrarFormulario(): void {
    this.formularioAbierto.set(false);
    this.editando.set(null);
    this.archivoFoto.set(null);
    this.previsualizacionFoto.set(null);
  }

  /** Foto elegida al crear/editar el repuesto, antes de tener un ID asignado. */
  protected onFotoFormularioSeleccionada(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0];
    if (!archivo) return;

    if (archivo.size > 8 * 1024 * 1024) {
      this.notificacion.advertencia('La foto no puede superar los 8 MB.');
      input.value = '';
      return;
    }

    this.archivoFoto.set(archivo);
    this.previsualizacionFoto.set(URL.createObjectURL(archivo));
  }

  protected quitarFotoFormulario(): void {
    this.archivoFoto.set(null);
    this.previsualizacionFoto.set(null);
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
      ? this.servicio.actualizar(enEdicion.repuestoId, {
          nombre: datos.nombre,
          descripcion: datos.descripcion,
          stockMinimo: datos.stockMinimo,
          precioCompra: datos.precioCompra,
          precioVenta: datos.precioVenta,
          proveedorId: datos.proveedorId || null,
        })
      : this.servicio.crear({ ...datos, proveedorId: datos.proveedorId || null });

    peticion.subscribe({
      next: (repuesto) => {
        const archivo = this.archivoFoto();

        // Si se eligió una foto en el mismo formulario, se sube encadenada:
        // recién acá tenemos el repuestoId que exige el endpoint de foto.
        if (archivo) {
          this.servicio.subirFoto(repuesto.repuestoId, archivo).subscribe({
            next: () => this.finalizarGuardado(enEdicion !== null),
            error: () => {
              this.notificacion.advertencia(
                'El repuesto se guardó, pero la foto no se pudo subir. Intente subirla de nuevo desde "Foto".',
              );
              this.finalizarGuardado(enEdicion !== null);
            },
          });
        } else {
          this.finalizarGuardado(enEdicion !== null);
        }
      },
      error: () => this.guardando.set(false),
    });
  }

  private finalizarGuardado(actualizando: boolean): void {
    this.notificacion.exito(
      actualizando ? 'Repuesto actualizado.' : 'Repuesto registrado correctamente.',
    );
    this.guardando.set(false);
    this.cerrarFormulario();
    this.cargar();
    // El stock mínimo pudo cambiar: la insignia del menú debe seguirlo.
    this.contadores.refrescar();
  }

  protected abrirAjuste(repuesto: Repuesto): void {
    this.ajustando.set(repuesto);
    this.nuevoStock.set(repuesto.stockActual);
  }

  protected confirmarAjuste(): void {
    const repuesto = this.ajustando();
    if (!repuesto) return;

    this.guardando.set(true);

    this.servicio.ajustarStock(repuesto.repuestoId, this.nuevoStock()).subscribe({
      next: () => {
        this.notificacion.exito('Stock ajustado correctamente.');
        this.guardando.set(false);
        this.ajustando.set(null);
        this.cargar();
        this.contadores.refrescar();
      },
      error: () => this.guardando.set(false),
    });
  }

  // --- Foto del producto (opcional) ------------------------------------------

  protected abrirFoto(repuesto: Repuesto): void {
    this.fotoDe.set(repuesto);
  }

  protected onFotoSeleccionada(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0];
    const repuesto = this.fotoDe();
    if (!archivo || !repuesto) return;

    if (archivo.size > 8 * 1024 * 1024) {
      this.notificacion.advertencia('La foto no puede superar los 8 MB.');
      input.value = '';
      return;
    }

    this.subiendoFoto.set(true);

    this.servicio.subirFoto(repuesto.repuestoId, archivo).subscribe({
      next: (actualizado) => {
        this.fotoDe.set(actualizado);
        this.subiendoFoto.set(false);
        input.value = '';
        this.cargar();
      },
      error: () => {
        this.subiendoFoto.set(false);
        input.value = '';
      },
    });
  }

  protected quitarFoto(): void {
    const repuesto = this.fotoDe();
    if (!repuesto) return;

    this.subiendoFoto.set(true);

    this.servicio.eliminarFoto(repuesto.repuestoId).subscribe({
      next: (actualizado) => {
        this.fotoDe.set(actualizado);
        this.subiendoFoto.set(false);
        this.cargar();
      },
      error: () => this.subiendoFoto.set(false),
    });
  }
}
