import { DatePipe } from '@angular/common';
import { Component, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { EstadoCliente, EstadoVenta, ETIQUETAS, MetodoPago } from '../../core/models/enums';
import { Repuesto, Venta } from '../../core/models/inventario.model';
import { Cliente } from '../../core/models/personas.model';
import { urlArchivo } from '../../core/services/api-base';
import { ClientesService } from '../../core/services/clientes.service';
import { ContadoresService } from '../../core/services/contadores.service';
import { RepuestosService, VentasService } from '../../core/services/inventario.service';
import { NotificacionService } from '../../core/services/notificacion.service';
import { Confirmacion } from '../../shared/components/confirmacion';
import { EstadoTabla } from '../../shared/components/estado-tabla';
import { InsigniaEstado } from '../../shared/components/insignia-estado';
import { Modal } from '../../shared/components/modal';
import { OpcionSelector, SelectorBusqueda } from '../../shared/components/selector-busqueda';
import { BolivianosPipe } from '../../shared/pipes/bolivianos.pipe';

/** Una línea del carrito, antes de confirmar la venta. */
interface LineaCarrito {
  repuesto: Repuesto;
  cantidad: number;
  precioUnitario: number;
}

/**
 * Punto de venta — venta de repuestos en mostrador.
 *
 * Es un flujo distinto al del taller: no hay orden de trabajo ni vehículo, se
 * cobra completo en el acto y el stock baja al confirmar. El carrito se arma en
 * memoria y recién al cobrar se manda una sola petición al backend.
 */
@Component({
  selector: 'app-ventas',
  imports: [
    FormsModule,
    DatePipe,
    Modal,
    Confirmacion,
    EstadoTabla,
    InsigniaEstado,
    SelectorBusqueda,
    BolivianosPipe,
  ],
  templateUrl: './ventas.html',
  styleUrl: './ventas.css',
})
export class Ventas {
  private readonly servicio = inject(VentasService);
  private readonly repuestosService = inject(RepuestosService);
  private readonly clientesService = inject(ClientesService);
  private readonly notificacion = inject(NotificacionService);
  private readonly contadores = inject(ContadoresService);

  protected readonly ventas = signal<Venta[]>([]);
  protected readonly repuestos = signal<Repuesto[]>([]);
  protected readonly clientes = signal<Cliente[]>([]);
  protected readonly cargando = signal(true);
  protected readonly procesando = signal(false);

  /** Carrito de la venta en curso. */
  protected readonly carrito = signal<LineaCarrito[]>([]);

  protected readonly panelCobro = signal(false);
  protected readonly detalleDe = signal<Venta | null>(null);
  protected readonly porAnular = signal<Venta | null>(null);

  /** Filtro de texto sobre la grilla de productos. */
  protected readonly buscarProducto = signal('');

  /** El buscador es el punto de partida del flujo: recibe el foco al entrar. */
  private readonly campoBusqueda = viewChild<ElementRef<HTMLInputElement>>('campoBusqueda');

  protected cobro = {
    clienteId: '',
    metodoPago: MetodoPago.Efectivo,
    observaciones: '',
  };

  protected readonly MetodoPago = MetodoPago;
  protected readonly EstadoVenta = EstadoVenta;
  protected readonly ETIQUETAS = ETIQUETAS;
  protected readonly urlArchivo = urlArchivo;

  protected readonly metodosPago = [
    MetodoPago.Efectivo,
    MetodoPago.Transferencia,
    MetodoPago.Tarjeta,
    MetodoPago.QR,
    MetodoPago.Otro,
  ];

  protected readonly total = computed(() =>
    this.carrito().reduce((suma, l) => suma + l.cantidad * l.precioUnitario, 0),
  );

  protected readonly articulos = computed(() =>
    this.carrito().reduce((suma, l) => suma + l.cantidad, 0),
  );

  /**
   * Grilla de productos para vender, filtrada por texto y ordenada
   * alfabéticamente. El filtro busca por nombre y también por el código
   * interno (REP-012): en mostrador el código suele estar en la etiqueta
   * del repuesto y es más rápido de tipear que el nombre completo.
   */
  protected readonly productosFiltrados = computed<Repuesto[]>(() => {
    const filtro = this.buscarProducto().trim().toLowerCase();
    const lista = this.repuestos();

    const coincide = (r: Repuesto) =>
      r.nombre.toLowerCase().includes(filtro) || r.repuestoId.toLowerCase().includes(filtro);

    return [...(filtro ? lista.filter(coincide) : lista)].sort((a, b) =>
      a.nombre.localeCompare(b.nombre),
    );
  });

  protected readonly opcionesCliente = computed<OpcionSelector[]>(() =>
    this.clientes().map((c) => ({
      valor: c.clienteId,
      etiqueta: c.razonSocial?.trim() || `${c.nombre} ${c.apellido ?? ''}`.trim(),
      detalle: c.ciNit,
    })),
  );

  constructor() {
    // El cajero entra a vender: el cursor ya está en el buscador.
    afterNextRender(() => this.enfocarBusqueda());

    this.cargar();
    this.cargarRepuestos();

    this.clientesService
      .getAll()
      .subscribe((lista) =>
        this.clientes.set(lista.filter((c) => c.estado === EstadoCliente.Activo)),
      );
  }

  protected cargar(): void {
    this.cargando.set(true);

    this.servicio.getAll().subscribe({
      next: (lista) => {
        this.ventas.set(lista);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  private cargarRepuestos(): void {
    this.repuestosService.getAll().subscribe((lista) => this.repuestos.set(lista));
  }

  // --- Carrito ---------------------------------------------------------------

  /** Stock disponible descontando lo que ya está en el carrito. */
  protected disponible(repuesto: Repuesto): number {
    const enCarrito = this.carrito()
      .filter((l) => l.repuesto.repuestoId === repuesto.repuestoId)
      .reduce((suma, l) => suma + l.cantidad, 0);

    return repuesto.stockActual - enCarrito;
  }

  /** Click en una tarjeta del catálogo: suma una unidad al carrito. */
  protected agregarProducto(repuesto: Repuesto): void {
    if (this.disponible(repuesto) < 1) {
      this.notificacion.advertencia(`No quedan más unidades de '${repuesto.nombre}' disponibles.`);
      return;
    }

    // Si ya está en el carrito se suma a la línea existente, no se duplica.
    this.carrito.update((lineas) => {
      const existente = lineas.find((l) => l.repuesto.repuestoId === repuesto.repuestoId);

      return existente
        ? lineas.map((l) =>
            l.repuesto.repuestoId === repuesto.repuestoId ? { ...l, cantidad: l.cantidad + 1 } : l,
          )
        : [...lineas, { repuesto, cantidad: 1, precioUnitario: repuesto.precioVenta }];
    });
  }

  protected quitarDelCarrito(repuestoId: string): void {
    this.carrito.update((lineas) => lineas.filter((l) => l.repuesto.repuestoId !== repuestoId));
  }

  protected cambiarCantidad(repuestoId: string, cantidad: number): void {
    if (cantidad < 1) return;

    const repuesto = this.repuestos().find((r) => r.repuestoId === repuestoId);
    if (repuesto && cantidad > repuesto.stockActual) {
      this.notificacion.advertencia(
        `'${repuesto.nombre}' solo tiene ${repuesto.stockActual} unidad(es) en stock.`,
      );
      return;
    }

    this.carrito.update((lineas) =>
      lineas.map((l) => (l.repuesto.repuestoId === repuestoId ? { ...l, cantidad } : l)),
    );
  }

  protected cambiarPrecio(repuestoId: string, precio: number): void {
    if (precio < 0) return;

    this.carrito.update((lineas) =>
      lineas.map((l) =>
        l.repuesto.repuestoId === repuestoId ? { ...l, precioUnitario: precio } : l,
      ),
    );
  }

  protected vaciarCarrito(): void {
    this.carrito.set([]);
    this.enfocarBusqueda();
  }

  // --- Flujo de teclado ------------------------------------------------------

  /**
   * En mostrador se atiende con las dos manos ocupadas: Enter agrega cuando la
   * búsqueda dejó un solo producto (o cuando el texto es el código exacto), y
   * Escape limpia para el siguiente artículo. Así se vende sin soltar el teclado.
   */
  protected alTeclearBusqueda(evento: KeyboardEvent): void {
    if (evento.key === 'Escape') {
      this.buscarProducto.set('');
      return;
    }

    if (evento.key !== 'Enter') return;
    evento.preventDefault();

    const texto = this.buscarProducto().trim().toLowerCase();
    if (!texto) return;

    const coincidencias = this.productosFiltrados();

    // El código exacto gana aunque haya más coincidencias por nombre.
    const porCodigo = coincidencias.find((r) => r.repuestoId.toLowerCase() === texto);
    const elegido = porCodigo ?? (coincidencias.length === 1 ? coincidencias[0] : null);

    if (!elegido) {
      this.notificacion.advertencia(
        coincidencias.length === 0
          ? 'Ningún producto coincide con la búsqueda.'
          : 'Hay varios productos que coinciden: elija uno del catálogo.',
      );
      return;
    }

    this.agregarProducto(elegido);
    this.buscarProducto.set('');
  }

  /** Devuelve el foco al buscador para encadenar el siguiente artículo. */
  private enfocarBusqueda(): void {
    this.campoBusqueda()?.nativeElement.focus();
  }

  // --- Cobro -----------------------------------------------------------------

  protected abrirCobro(): void {
    if (this.carrito().length === 0) {
      this.notificacion.advertencia('Agregue al menos un repuesto al carrito.');
      return;
    }

    this.cobro = { clienteId: '', metodoPago: MetodoPago.Efectivo, observaciones: '' };
    this.panelCobro.set(true);
  }

  protected confirmarVenta(): void {
    this.procesando.set(true);

    this.servicio
      .crear({
        clienteId: this.cobro.clienteId || null,
        metodoPago: Number(this.cobro.metodoPago) as MetodoPago,
        observaciones: this.cobro.observaciones || null,
        detalles: this.carrito().map((l) => ({
          repuestoId: l.repuesto.repuestoId,
          cantidad: l.cantidad,
          precioUnitario: l.precioUnitario,
        })),
      })
      .subscribe({
        next: (venta) => {
          this.notificacion.exito(
            `Venta ${venta.ventaId} registrada por ${venta.total.toFixed(2)} Bs.`,
          );
          this.procesando.set(false);
          this.panelCobro.set(false);
          this.vaciarCarrito();
          this.cargar();
          // El stock bajó: la lista y el badge de stock bajo deben seguirlo.
          this.cargarRepuestos();
          this.contadores.refrescar();
        },
        error: () => this.procesando.set(false),
      });
  }

  protected anular(): void {
    const venta = this.porAnular();
    if (!venta) return;

    this.procesando.set(true);

    this.servicio.anular(venta.ventaId).subscribe({
      next: () => {
        this.notificacion.exito('Venta anulada: el stock volvió al inventario.');
        this.procesando.set(false);
        this.porAnular.set(null);
        this.cargar();
        this.cargarRepuestos();
        this.contadores.refrescar();
      },
      error: () => {
        this.procesando.set(false);
        this.porAnular.set(null);
      },
    });
  }
}
