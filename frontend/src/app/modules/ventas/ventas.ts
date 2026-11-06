import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ConfirmarSalida } from '../../core/guards/confirmar-salida.guard';
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
import { Cajon } from '../../shared/components/cajon';
import { Paginador } from '../../shared/components/paginador';
import { OpcionSelector, SelectorBusqueda } from '../../shared/components/selector-busqueda';
import { detalleConNuevo } from '../../shared/recientes';
import { BolivianosPipe } from '../../shared/pipes/bolivianos.pipe';
import { coincideRepuesto } from '../../shared/busqueda-repuestos';

/** Una línea del carrito, antes de confirmar la venta. */
interface LineaCarrito {
  repuesto: Repuesto;
  cantidad: number;
  precioUnitario: number;
}

/**
 * Color del cuadro de un repuesto sin foto, según su categoría: el mismo para
 * todos los de la misma, así se reconocen de un vistazo. Sin rojos: el rojo
 * queda para el botón de cobrar.
 */
const TONOS = ['naranja', 'azul', 'verde', 'gris'] as const;

/**
 * Punto de venta — venta de repuestos en mostrador.
 *
 * Es un flujo distinto al del taller: no hay orden de trabajo ni vehículo, se
 * cobra completo en el acto y el stock baja al confirmar. El carrito se arma en
 * memoria y recién al cobrar se manda una sola petición al backend.
 *
 * Letra y botones grandes a propósito: se usa de pie, en el mostrador, a veces
 * desde una pantalla táctil.
 */
@Component({
  selector: 'app-ventas',
  imports: [
    FormsModule,
    DatePipe,
    NgTemplateOutlet,
    Cajon,
    Confirmacion,
    EstadoTabla,
    InsigniaEstado,
    Paginador,
    SelectorBusqueda,
    BolivianosPipe,
  ],
  templateUrl: './ventas.html',
  styleUrl: './ventas.css',
  host: {
    // Cierre de la pestaña/navegador: el guard de ruta no alcanza a interceptarlo.
    '(window:beforeunload)': 'alCerrarPestania($event)',
  },
})
export class Ventas implements ConfirmarSalida {
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

  protected readonly pagina = signal(1);
  protected readonly tamanoPagina = signal(20);

  /** Filtro por fechas del historial (vacío = todas). */
  protected readonly desde = signal('');
  protected readonly hasta = signal('');
  protected readonly rangosRapidos = [
    { clave: 'hoy', etiqueta: 'Hoy' },
    { clave: 'semana', etiqueta: 'Esta semana' },
    { clave: 'mes', etiqueta: 'Este mes' },
  ] as const;
  protected readonly rangoActivo = signal<string | null>(null);
  protected readonly totalRegistros = signal(0);
  protected readonly totalPaginas = signal(0);

  /** Carrito de la venta en curso. */
  protected readonly carrito = signal<LineaCarrito[]>([]);

  protected readonly detalleDe = signal<Venta | null>(null);
  protected readonly porAnular = signal<Venta | null>(null);

  /** Filtro de texto sobre la grilla de productos. */
  protected readonly buscarProducto = signal('');

  /** Categoría elegida en las píldoras; vacía = todas. */
  protected readonly categoriaActiva = signal('');

  /** Pestaña activa del terminal: solo presentación, no toca la venta ni la API. */
  protected readonly pestania = signal<'terminal' | 'historial'>('terminal');

  /** El buscador es el punto de partida del flujo: recibe el foco al entrar. */
  private readonly campoBusqueda = viewChild<ElementRef<HTMLInputElement>>('campoBusqueda');

  // --- Cobro ------------------------------------------------------------------
  protected readonly metodoPago = signal<MetodoPago>(MetodoPago.Efectivo);
  /** Cliente y observación son opcionales: quedan plegados hasta que se piden. */
  protected readonly extrasAbiertos = signal(false);
  protected cobro = { clienteId: '', observaciones: '' };

  protected readonly MetodoPago = MetodoPago;
  protected readonly EstadoVenta = EstadoVenta;
  protected readonly ETIQUETAS = ETIQUETAS;
  protected readonly urlArchivo = urlArchivo;

  /** Los cuatro de todos los días primero; "Otro" al final. */
  protected readonly metodosPago = [
    MetodoPago.Efectivo,
    MetodoPago.QR,
    MetodoPago.Transferencia,
    MetodoPago.Tarjeta,
    MetodoPago.Otro,
  ];

  protected readonly total = computed(() =>
    this.carrito().reduce((suma, l) => suma + l.cantidad * l.precioUnitario, 0),
  );

  protected readonly articulos = computed(() =>
    this.carrito().reduce((suma, l) => suma + l.cantidad, 0),
  );

  /**
   * Las categorías del inventario con más repuestos, como píldoras para
   * filtrar con un toque. Salen de los repuestos cargados: una categoría sin
   * repuestos no aparece.
   */
  protected readonly categoriasVenta = computed(() => {
    const conteo = new Map<string, number>();
    for (const r of this.repuestos()) {
      const nombre = r.nombreCategoria?.trim();
      if (nombre) conteo.set(nombre, (conteo.get(nombre) ?? 0) + 1);
    }

    return [...conteo.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 8)
      .map(([nombre]) => nombre);
  });

  /**
   * Grilla de productos para vender, filtrada por texto y categoría y
   * ordenada alfabéticamente. El filtro busca por nombre y también por el
   * código interno (REP-012): en mostrador el código suele estar en la
   * etiqueta del repuesto y es más rápido de tipear que el nombre completo.
   */
  protected readonly productosFiltrados = computed<Repuesto[]>(() => {
    const filtro = this.buscarProducto();
    const categoria = this.categoriaActiva();

    // Por palabras: "filtro aceite" encuentra "Filtro de aceite", y "Corolla"
    // las piezas indicadas para ese modelo.
    return this.repuestos()
      .filter(
        (r) =>
          (!categoria || r.nombreCategoria?.trim() === categoria) && coincideRepuesto(filtro, r),
      )
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  });

  protected readonly opcionesCliente = computed<OpcionSelector[]>(() =>
    this.clientes().map((c) => ({
      valor: c.clienteId,
      etiqueta: c.razonSocial?.trim() || `${c.nombre} ${c.apellido ?? ''}`.trim(),
      detalle: detalleConNuevo(c.ciNit, c.fechaRegistro),
    })),
  );

  constructor() {
    // El cajero entra a vender: el cursor ya está en el buscador.
    afterNextRender(() => this.enfocarBusqueda());

    this.cargar();
    this.cargarRepuestos();

    this.clientesService
      .getAll(undefined, 1, 500)
      .subscribe((resultado) =>
        this.clientes.set(resultado.items.filter((c) => c.estado === EstadoCliente.Activo)),
      );
  }

  protected cargar(): void {
    this.cargando.set(true);

    this.servicio
      .getAll({
        desde: this.desde() || undefined,
        hasta: this.hasta() || undefined,
        pagina: this.pagina(),
        tamanoPagina: this.tamanoPagina(),
      })
      .subscribe({
        next: (resultado) => {
          this.ventas.set(resultado.items);
          this.totalRegistros.set(resultado.totalRegistros);
          this.totalPaginas.set(resultado.totalPaginas);
          this.cargando.set(false);
        },
        error: () => this.cargando.set(false),
      });
  }

  protected cambiarPagina(pagina: number): void {
    this.pagina.set(pagina);
    this.cargar();
  }

  protected onFecha(campo: 'desde' | 'hasta', valor: string): void {
    this.rangoActivo.set(null);
    (campo === 'desde' ? this.desde : this.hasta).set(valor);
    this.pagina.set(1);
    this.cargar();
  }

  /** Hoy, esta semana (desde el lunes) o este mes, hasta hoy. */
  protected aplicarRango(clave: 'hoy' | 'semana' | 'mes'): void {
    this.rangoActivo.set(clave);
    const ahora = new Date();
    let inicio = new Date(ahora);
    if (clave === 'semana') inicio.setDate(ahora.getDate() - ((ahora.getDay() + 6) % 7));
    if (clave === 'mes') inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

    this.desde.set(fechaLocal(inicio));
    this.hasta.set(fechaLocal(ahora));
    this.pagina.set(1);
    this.cargar();
  }

  protected limpiarFechas(): void {
    this.rangoActivo.set(null);
    this.desde.set('');
    this.hasta.set('');
    this.pagina.set(1);
    this.cargar();
  }

  protected cambiarTamano(tamano: number): void {
    this.tamanoPagina.set(tamano);
    this.pagina.set(1);
    this.cargar();
  }

  private cargarRepuestos(): void {
    this.repuestosService
      .getAll({ tamanoPagina: 500 })
      .subscribe((resultado) => this.repuestos.set(resultado.items));
  }

  // --- Tarjeta de producto -------------------------------------------------------

  protected tono(repuesto: Repuesto): (typeof TONOS)[number] {
    const nombre = repuesto.nombreCategoria?.trim();
    if (!nombre) return 'gris';

    let suma = 0;
    for (const letra of nombre) suma = (suma * 31 + letra.charCodeAt(0)) >>> 0;
    return TONOS[suma % TONOS.length];
  }

  /** "Aceite 10w40" → "A1"; "Pastillas de freno" → "PF". */
  protected iniciales(nombre: string): string {
    const palabras = nombre.split(/\s+/).filter((p) => p.length > 2);
    return (palabras.length ? palabras : [nombre])
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase();
  }

  protected cantidadEnCarrito(repuesto: Repuesto): number {
    return this.carrito().find((l) => l.repuesto.repuestoId === repuesto.repuestoId)?.cantidad ?? 0;
  }

  // --- Carrito ---------------------------------------------------------------

  /** Stock disponible descontando lo que ya está en el carrito. */
  protected disponible(repuesto: Repuesto): number {
    return repuesto.stockActual - this.cantidadEnCarrito(repuesto);
  }

  /** Toque en una tarjeta del catálogo: suma una unidad al carrito. */
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

  /** "−" en la línea: con una sola unidad, la quita de la venta. */
  protected restarUno(linea: LineaCarrito): void {
    if (linea.cantidad <= 1) {
      this.quitarDelCarrito(linea.repuesto.repuestoId);
      return;
    }
    this.cambiarCantidad(linea.repuesto.repuestoId, linea.cantidad - 1);
  }

  protected quitarDelCarrito(repuestoId: string): void {
    this.carrito.update((lineas) => lineas.filter((l) => l.repuesto.repuestoId !== repuestoId));
  }

  protected cambiarCantidad(repuestoId: string, cantidad: number): void {
    if (!Number.isFinite(cantidad) || cantidad < 1) return;

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
    if (!Number.isFinite(precio) || precio < 0) return;

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

  /**
   * Cobrar registra la venta en el acto, con el método de pago elegido en el
   * panel: el total y el método ya están a la vista, no hace falta otra
   * ventana. Si fue un error, la venta se anula desde el historial y el stock
   * vuelve al inventario.
   */
  protected cobrar(): void {
    if (this.carrito().length === 0) {
      this.notificacion.advertencia('Agregue al menos un repuesto a la venta.');
      return;
    }

    this.procesando.set(true);

    this.servicio
      .crear({
        clienteId: this.cobro.clienteId || null,
        metodoPago: this.metodoPago(),
        observaciones: this.cobro.observaciones.trim() || null,
        detalles: this.carrito().map((l) => ({
          repuestoId: l.repuesto.repuestoId,
          cantidad: l.cantidad,
          precioUnitario: l.precioUnitario,
        })),
      })
      .subscribe({
        next: (venta) => {
          this.notificacion.exito(
            `Venta ${venta.ventaId} registrada: ${new BolivianosPipe().transform(venta.total)}.`,
          );
          this.procesando.set(false);
          this.cobro = { clienteId: '', observaciones: '' };
          this.extrasAbiertos.set(false);
          this.metodoPago.set(MetodoPago.Efectivo);
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

  // --- Protección de salida (CAPA 1.3) --------------------------------------

  /** El carrito vive solo en memoria: navegar afuera con ítems adentro los pierde. */
  hayCambiosSinGuardar(): boolean {
    return this.carrito().length > 0;
  }

  protected alCerrarPestania(evento: BeforeUnloadEvent): void {
    if (!this.hayCambiosSinGuardar()) return;

    // Ambas líneas son necesarias: distintos navegadores leen una u otra
    // para decidir si muestran el diálogo nativo de "¿Salir del sitio?".
    evento.preventDefault();
    evento.returnValue = '';
  }
}

/** Fecha local yyyy-mm-dd (no UTC: en Bolivia, desde las 20:00 el UTC ya es mañana). */
function fechaLocal(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}
