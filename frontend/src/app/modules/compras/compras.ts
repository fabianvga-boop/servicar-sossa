import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import {
  Compra,
  CompraDetalle,
  Proveedor,
  Repuesto,
} from '../../core/models/inventario.model';
import {
  ComprasService,
  ProveedoresService,
  RepuestosService,
} from '../../core/services/inventario.service';
import { ContadoresService } from '../../core/services/contadores.service';
import { NotificacionService } from '../../core/services/notificacion.service';
import { EstadoTabla } from '../../shared/components/estado-tabla';
import { Modal } from '../../shared/components/modal';
import { OpcionSelector, SelectorBusqueda } from '../../shared/components/selector-busqueda';
import { Atajo } from '../../shared/directives/atajo';
import { BolivianosPipe } from '../../shared/pipes/bolivianos.pipe';

/** USU029 — registro de compras a proveedores. */
@Component({
  selector: 'app-compras',
  imports: [
    ReactiveFormsModule,
    DatePipe,
    Modal,
    EstadoTabla,
    SelectorBusqueda,
    Atajo,
    BolivianosPipe,
  ],
  templateUrl: './compras.html',
})
export class Compras {
  private readonly servicio = inject(ComprasService);
  private readonly proveedoresService = inject(ProveedoresService);
  private readonly repuestosService = inject(RepuestosService);
  private readonly fb = inject(FormBuilder);
  private readonly notificacion = inject(NotificacionService);
  private readonly contadores = inject(ContadoresService);

  protected readonly compras = signal<Compra[]>([]);
  protected readonly proveedores = signal<Proveedor[]>([]);
  protected readonly repuestos = signal<Repuesto[]>([]);
  protected readonly cargando = signal(true);
  protected readonly proveedorFiltro = signal('');
  protected readonly guardando = signal(false);

  protected readonly formularioAbierto = signal(false);
  protected readonly detalle = signal<CompraDetalle | null>(null);

  /** Espejo de las líneas, para calcular el total en vivo sin suscribirse al form. */
  protected readonly lineas = signal<{ cantidad: number; precioUnitario: number }[]>([]);

  protected readonly totalCompra = computed(() =>
    this.lineas().reduce((suma, l) => suma + (l.cantidad || 0) * (l.precioUnitario || 0), 0),
  );

  protected readonly formulario = this.fb.nonNullable.group({
    proveedorId: ['', Validators.required],
    detalles: this.fb.array<ReturnType<Compras['nuevaLinea']>>([]),
  });

  protected readonly opcionesProveedor = computed<OpcionSelector[]>(() =>
    this.proveedores().map((p) => ({
      valor: p.proveedorId,
      etiqueta: p.nombre,
      detalle: p.contacto ?? '',
    })),
  );

  /** Aquí sí conviene ver el stock actual: se está decidiendo cuánto reponer. */
  protected readonly opcionesRepuesto = computed<OpcionSelector[]>(() =>
    this.repuestos().map((r) => ({
      valor: r.repuestoId,
      etiqueta: r.nombre,
      detalle: `stock ${r.stockActual}`,
    })),
  );

  constructor() {
    this.cargar();
    this.proveedoresService.getAll().subscribe((lista) => this.proveedores.set(lista));
    this.repuestosService.getAll().subscribe((lista) => this.repuestos.set(lista));
  }

  protected get detalles(): FormArray {
    return this.formulario.controls.detalles as unknown as FormArray;
  }

  protected cargar(): void {
    this.cargando.set(true);

    this.servicio.getAll({ proveedorId: this.proveedorFiltro() || undefined }).subscribe({
      next: (lista) => {
        this.compras.set(lista);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  protected onFiltrarProveedor(valor: string): void {
    this.proveedorFiltro.set(valor);
    this.cargar();
  }

  private nuevaLinea() {
    return this.fb.nonNullable.group({
      repuestoId: ['', Validators.required],
      cantidad: [1, [Validators.required, Validators.min(1)]],
      precioUnitario: [0, [Validators.required, Validators.min(0)]],
    });
  }

  protected abrirNuevo(): void {
    this.formulario.reset({ proveedorId: '' });
    this.detalles.clear();
    this.agregarLinea();
    this.formularioAbierto.set(true);
  }

  protected agregarLinea(): void {
    this.detalles.push(this.nuevaLinea());
    this.sincronizarTotales();
  }

  protected quitarLinea(indice: number): void {
    this.detalles.removeAt(indice);
    this.sincronizarTotales();
  }

  /**
   * Al elegir un repuesto se propone su precio actual como precio de compra,
   * que es lo habitual; el usuario puede corregirlo si el proveedor cambió.
   */
  protected onRepuestoSeleccionado(indice: number, repuestoId: string): void {
    const repuesto = this.repuestos().find((r) => r.repuestoId === repuestoId);
    if (!repuesto) return;

    this.detalles.at(indice).patchValue({ precioUnitario: repuesto.precioCompra });
    this.sincronizarTotales();
  }

  /** Se llama en cada cambio de cantidad o precio para refrescar el total. */
  protected sincronizarTotales(): void {
    this.lineas.set(
      this.detalles.controls.map((control) => ({
        cantidad: control.value.cantidad ?? 0,
        precioUnitario: control.value.precioUnitario ?? 0,
      })),
    );
  }

  protected guardar(): void {
    if (this.formulario.invalid || this.detalles.length === 0) {
      this.formulario.markAllAsTouched();
      this.notificacion.advertencia('Complete el proveedor y al menos una línea de detalle.');
      return;
    }

    this.guardando.set(true);

    this.servicio.crear(this.formulario.getRawValue() as never).subscribe({
      next: () => {
        this.notificacion.exito('Compra registrada y stock actualizado.');
        this.guardando.set(false);
        this.formularioAbierto.set(false);
        this.cargar();
        // El stock cambió: recargamos el catálogo para las próximas compras.
        this.repuestosService.getAll().subscribe((lista) => this.repuestos.set(lista));
        // Una compra puede sacar repuestos de la alerta de stock bajo.
        this.contadores.refrescar();
      },
      error: () => this.guardando.set(false),
    });
  }

  protected verDetalle(compra: Compra): void {
    this.servicio.getById(compra.compraId).subscribe((completa) => this.detalle.set(completa));
  }
}
