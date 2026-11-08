import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import {
  CategoriaRepuesto,
  Compra,
  CompraDetalle,
  Proveedor,
  Repuesto,
} from '../../core/models/inventario.model';
import {
  CategoriasRepuestoService,
  ComprasService,
  ProveedoresService,
  RepuestosService,
} from '../../core/services/inventario.service';
import { ContadoresService } from '../../core/services/contadores.service';
import { NotificacionService } from '../../core/services/notificacion.service';
import { Cajon } from '../../shared/components/cajon';
import { EstadoTabla } from '../../shared/components/estado-tabla';
import { Modal } from '../../shared/components/modal';
import { Paginador } from '../../shared/components/paginador';
import { OpcionSelector, SelectorBusqueda } from '../../shared/components/selector-busqueda';
import { Atajo } from '../../shared/directives/atajo';
import { EnfocarError } from '../../shared/directives/enfocar-error';
import { BolivianosPipe } from '../../shared/pipes/bolivianos.pipe';
import { coincidePorPalabras } from '../../shared/busqueda';
import { sugerirCategoriaRepuesto } from '../../shared/categorias-repuesto';

/** USU029 — registro de compras a proveedores. */
@Component({
  selector: 'app-compras',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    DatePipe,
    Cajon,
    Modal,
    EstadoTabla,
    Paginador,
    SelectorBusqueda,
    Atajo,
    EnfocarError,
    BolivianosPipe,
  ],
  templateUrl: './compras.html',
  styleUrl: './compras.css',
})
export class Compras {
  private readonly servicio = inject(ComprasService);
  private readonly proveedoresService = inject(ProveedoresService);
  private readonly repuestosService = inject(RepuestosService);
  private readonly categoriasService = inject(CategoriasRepuestoService);
  private readonly fb = inject(FormBuilder);
  private readonly notificacion = inject(NotificacionService);
  private readonly contadores = inject(ContadoresService);

  protected readonly compras = signal<Compra[]>([]);
  /** Universo completo, sin los filtros de la tabla: alimenta solo los KPIs. */
  protected readonly comprasTodas = signal<Compra[]>([]);
  protected readonly proveedores = signal<Proveedor[]>([]);
  protected readonly repuestos = signal<Repuesto[]>([]);
  protected readonly cargando = signal(true);
  protected readonly proveedorFiltro = signal('');
  protected readonly desde = signal('');
  protected readonly hasta = signal('');
  /** Filtro de texto por código de compra: es local, sobre lo ya cargado. */
  protected readonly buscarTexto = signal('');
  protected readonly guardando = signal(false);

  protected readonly pagina = signal(1);
  protected readonly tamanoPagina = signal(20);
  protected readonly totalRegistros = signal(0);
  protected readonly totalPaginas = signal(0);

  protected readonly rangosRapidos = [
    { clave: 'hoy', etiqueta: 'Hoy' },
    { clave: 'semana', etiqueta: 'Esta semana' },
    { clave: 'mes', etiqueta: 'Este mes' },
  ] as const;
  protected readonly rangoActivo = signal<string | null>(null);

  protected readonly formularioAbierto = signal(false);
  /** El formulario abierto es de una compra ocasional (sin proveedor). */
  protected readonly ocasional = signal(false);
  protected readonly detalle = signal<CompraDetalle | null>(null);

  /**
   * Detalle de cada compra ya consultada: alimenta la columna "Repuestos", la
   * búsqueda por repuesto y las unidades del mes. Se pide solo lo que falta.
   */
  protected readonly detallesCompra = signal<ReadonlyMap<string, CompraDetalle>>(new Map());

  /** Nombre del mes en curso, para el indicador "Comprado en …". */
  protected readonly nombreMes = new Date().toLocaleDateString('es-BO', { month: 'long' });

  // --- Repuesto nuevo desde la compra -----------------------------------------
  // Lo que se compra por primera vez no está en el inventario. Se pide solo el
  // nombre y la categoría (ya sugerida); los precios van en la fila, como en
  // cualquier compra. El repuesto se crea recién al registrar la compra, con el
  // stock que entra en ella: si se cancela, no queda nada a medias.

  protected readonly categorias = signal<CategoriaRepuesto[]>([]);
  /** Fila de la compra que espera el repuesto nuevo; null = formulario cerrado. */
  protected readonly filaRepuestoNuevo = signal<number | null>(null);
  /**
   * Repuestos nuevos de esta compra, por su clave provisoria (NUEVO-1…), que es
   * el valor que toma la fila hasta que se registra la compra.
   */
  protected readonly repuestosNuevos = signal<
    ReadonlyMap<string, { nombre: string; categoriaId: string }>
  >(new Map());
  private contadorNuevos = 0;

  protected readonly formRepuestoNuevo = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(150)]],
    categoriaId: [''],
  });

  protected readonly opcionesCategoria = computed<OpcionSelector[]>(() =>
    this.categorias().map((c) => ({ valor: c.categoriaId, etiqueta: c.nombre })),
  );

  /** Espejo de las líneas, para calcular el total en vivo sin suscribirse al form. */
  protected readonly lineas = signal<{ cantidad: number; precioUnitario: number }[]>([]);

  protected readonly totalCompra = computed(() =>
    this.lineas().reduce((suma, l) => suma + (l.cantidad || 0) * (l.precioUnitario || 0), 0),
  );

  /** Filtro de texto local, por palabras: código, proveedor y los repuestos comprados. */
  protected readonly comprasFiltradas = computed(() => {
    const filtro = this.buscarTexto();
    const detalles = this.detallesCompra();
    return this.compras().filter((c) =>
      coincidePorPalabras(
        filtro,
        c.compraId,
        c.nombreProveedor,
        c.referencia ?? '',
        ...(detalles.get(c.compraId)?.detalles.map((l) => l.nombreRepuesto) ?? []),
      ),
    );
  });

  /** Compras del mes en curso: de ellas se traen los repuestos para la búsqueda. */
  private comprasDelMes(): Compra[] {
    const ahora = new Date();
    return this.comprasTodas().filter((c) => {
      const fecha = new Date(c.fecha);
      return fecha.getFullYear() === ahora.getFullYear() && fecha.getMonth() === ahora.getMonth();
    });
  }

  protected readonly formulario = this.fb.nonNullable.group({
    proveedorId: ['', Validators.required],
    referencia: ['', Validators.maxLength(150)],
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
  protected readonly opcionesRepuesto = computed<OpcionSelector[]>(() => [
    ...this.repuestos().map((r) => ({
      valor: r.repuestoId,
      etiqueta: r.nombre,
      detalle: `stock ${r.stockActual}`,
    })),
    ...[...this.repuestosNuevos()].map(([clave, nuevo]) => ({
      valor: clave,
      etiqueta: nuevo.nombre,
      detalle: 'nuevo',
    })),
  ]);

  constructor() {
    this.cargar();
    this.proveedoresService
      .getAll(undefined, 1, 500)
      .subscribe((resultado) => this.proveedores.set(resultado.items));
    this.repuestosService
      .getAll({ tamanoPagina: 500 })
      .subscribe((resultado) => this.repuestos.set(resultado.items));
    this.categoriasService.getAll().subscribe((lista) => this.categorias.set(lista));

    // "Registrar compra" desde el Panel enlaza con ?nueva=true: abre el formulario.
    const ruta = inject(ActivatedRoute);
    if (ruta.snapshot.queryParamMap.get('nueva') === 'true') {
      this.abrirNuevo();
      // Desde Proveedores ("Compra") llega también ?proveedorId=: queda elegido.
      const proveedorId = ruta.snapshot.queryParamMap.get('proveedorId');
      if (proveedorId) this.formulario.controls.proveedorId.setValue(proveedorId);
      void inject(Router).navigate([], {
        relativeTo: ruta,
        queryParams: { nueva: null, proveedorId: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  protected get detalles(): FormArray {
    return this.formulario.controls.detalles as unknown as FormArray;
  }

  protected cargar(): void {
    this.cargando.set(true);

    this.servicio
      .getAll({
        proveedorId: this.proveedorFiltro() || undefined,
        desde: this.desde() || undefined,
        hasta: this.hasta() || undefined,
        pagina: this.pagina(),
        tamanoPagina: this.tamanoPagina(),
      })
      .subscribe({
        next: (resultado) => {
          this.compras.set(resultado.items);
          this.totalRegistros.set(resultado.totalRegistros);
          this.totalPaginas.set(resultado.totalPaginas);
          this.cargando.set(false);
          this.traerDetalles(resultado.items);
        },
        error: () => this.cargando.set(false),
      });

    // KPIs del mes: siempre sobre el universo completo, no la vista filtrada.
    // Ordenado por fecha descendente, así que el mes en curso siempre entra
    // en las primeras páginas aunque el histórico completo sea más grande.
    this.servicio.getAll({ tamanoPagina: 500 }).subscribe((resultado) => {
      this.comprasTodas.set(resultado.items);
      this.traerDetalles(this.comprasDelMes());
    });
  }

  /**
   * Pide el detalle de las compras que todavía no se consultaron (la página
   * visible y las del mes): una consulta por compra, todas a la vez. Si una
   * falla, su fila muestra la cantidad de ítems en vez de los nombres.
   */
  private traerDetalles(compras: Compra[]): void {
    const faltan = compras.filter((c) => !this.detallesCompra().has(c.compraId));
    if (faltan.length === 0) return;

    forkJoin(
      faltan.map((c) => this.servicio.getById(c.compraId).pipe(catchError(() => of(null)))),
    ).subscribe((lista) => {
      const mapa = new Map(this.detallesCompra());
      for (const detalle of lista) if (detalle) mapa.set(detalle.compraId, detalle);
      this.detallesCompra.set(mapa);
    });
  }

  /** "Aceite 10w40 ×20, Filtro de aceite": lo que se compró, en una línea. */
  protected resumenRepuestos(compra: Compra): string {
    const detalle = this.detallesCompra().get(compra.compraId);
    if (!detalle) return this.etiquetaLineas(compra.cantidadLineas);

    return detalle.detalles
      .map((l) => (l.cantidad > 1 ? `${l.nombreRepuesto} ×${l.cantidad}` : l.nombreRepuesto))
      .join(', ');
  }

  protected onFiltrarProveedor(valor: string): void {
    this.proveedorFiltro.set(valor);
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

  protected onBuscarTexto(valor: string): void {
    this.buscarTexto.set(valor);
  }

  protected onFecha(campo: 'desde' | 'hasta', valor: string): void {
    this.rangoActivo.set(null);
    (campo === 'desde' ? this.desde : this.hasta).set(valor);
    this.pagina.set(1);
    this.cargar();
  }

  /** Chips de rango rápido: calculan desde/hasta y reutilizan el filtro ya soportado por la API. */
  protected aplicarRango(clave: 'hoy' | 'semana' | 'mes'): void {
    this.rangoActivo.set(clave);
    const hoy = this.fechaIso(new Date());

    if (clave === 'hoy') {
      this.desde.set(hoy);
    } else if (clave === 'semana') {
      const ahora = new Date();
      const diasDesdeElLunes = (ahora.getDay() + 6) % 7; // 0 = lunes … 6 = domingo
      const inicio = new Date(ahora);
      inicio.setDate(ahora.getDate() - diasDesdeElLunes);
      this.desde.set(this.fechaIso(inicio));
    } else {
      const ahora = new Date();
      this.desde.set(this.fechaIso(new Date(ahora.getFullYear(), ahora.getMonth(), 1)));
    }

    this.hasta.set(hoy);
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

  /** Fecha local (no UTC): en Bolivia, desde las 20:00 el UTC ya es el día siguiente. */
  private fechaIso(fecha: Date): string {
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${fecha.getFullYear()}-${mes}-${dia}`;
  }

  /** Singular/plural para el badge de la columna "Líneas". */
  protected etiquetaLineas(cantidad: number): string {
    return cantidad === 1 ? '1 ítem' : `${cantidad} ítems`;
  }

  private nuevaLinea() {
    return this.fb.nonNullable.group({
      repuestoId: ['', Validators.required],
      cantidad: [1, [Validators.required, Validators.min(1)]],
      precioUnitario: [0, [Validators.required, Validators.min(0.01)]],
      /** Precio de venta del repuesto: viene con el actual y se puede cambiar acá. */
      precioVenta: [null as number | null, Validators.min(0)],
    });
  }

  protected abrirNuevo(): void {
    this.abrirFormulario(false);
  }

  /**
   * Compra a alguien de quien no se tienen o no conviene guardar los datos (un
   * vendedor de la feria, alguien cuyo nombre no se recuerda). Igual es una
   * compra: hay precio y cantidad, y el stock entra con ese respaldo.
   */
  protected abrirOcasional(): void {
    this.abrirFormulario(true);
  }

  /** Desde la compra común: pasa a ocasional sin perder los repuestos ya cargados. */
  protected pasarAOcasional(): void {
    this.ocasional.set(true);
    const proveedor = this.formulario.controls.proveedorId;
    proveedor.setValidators([]);
    proveedor.setValue('');
    proveedor.updateValueAndValidity();
  }

  /** Desde la compra ocasional: vuelve a pedir proveedor (los repuestos se conservan). */
  protected pasarAProveedor(): void {
    if (!this.ocasional()) return;
    this.ocasional.set(false);
    const proveedor = this.formulario.controls.proveedorId;
    proveedor.setValidators([Validators.required]);
    proveedor.updateValueAndValidity();
  }

  /** "Cambiar" en la tarjeta del proveedor: vuelve al buscador. */
  protected cambiarProveedor(): void {
    this.formulario.controls.proveedorId.setValue('');
  }

  /** El proveedor elegido, para mostrarlo como tarjeta en vez del buscador. */
  protected proveedorElegido(): Proveedor | null {
    const id = this.formulario.controls.proveedorId.value;
    return id ? (this.proveedores().find((p) => p.proveedorId === id) ?? null) : null;
  }

  protected contactoProveedor(p: Proveedor): string {
    return [p.contacto, p.telefono].filter((x) => !!x?.trim()).join(' · ') || 'Sin datos de contacto';
  }

  /** El repuesto ya existente de una fila (null si está vacía o es nuevo). */
  protected repuestoInfo(indice: number): Repuesto | null {
    const id = this.repuestoDeFila(indice);
    return id ? (this.repuestos().find((r) => r.repuestoId === id) ?? null) : null;
  }

  /** Botones − / + de la cantidad (mínimo 1). */
  protected cambiarCantidad(indice: number, delta: number): void {
    const control = this.detalles.at(indice).get('cantidad');
    if (!control) return;
    control.setValue(Math.max(1, (Number(control.value) || 0) + delta));
    this.sincronizarTotales();
  }

  /** "29 %" según los precios escritos en la fila, o '' si falta alguno. */
  protected gananciaFila(indice: number): string {
    const fila = this.detalles.at(indice)?.value as { precioUnitario?: number; precioVenta?: number | null };
    const compra = Number(fila?.precioUnitario) || 0;
    const venta = Number(fila?.precioVenta) || 0;
    return compra > 0 && venta > 0 ? this.ganancia(compra, venta) : '';
  }

  /** "2 repuestos · 6 unidades" con lo cargado hasta ahora. */
  protected resumenLineas(): string {
    const filas = this.lineas();
    const elegidas = this.detalles.controls.map((_, i) => !!this.repuestoDeFila(i) || this.esRepuestoNuevo(i));
    const conRepuesto = elegidas.filter(Boolean).length;
    if (conRepuesto === 0) return 'Todavía no hay repuestos elegidos';
    const unidades = filas.reduce((suma, f, i) => suma + (elegidas[i] ? f.cantidad || 0 : 0), 0);
    return `${conRepuesto === 1 ? '1 repuesto' : conRepuesto + ' repuestos'} · ${unidades === 1 ? '1 unidad' : unidades + ' unidades'}`;
  }

  private abrirFormulario(ocasional: boolean): void {
    this.ocasional.set(ocasional);

    const proveedor = this.formulario.controls.proveedorId;
    proveedor.setValidators(ocasional ? [] : [Validators.required]);
    this.formulario.reset({ proveedorId: '', referencia: '' });
    proveedor.updateValueAndValidity();

    this.detalles.clear();
    this.agregarLinea();
    this.repuestosNuevos.set(new Map());
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
    // Al quitar el repuesto (la X) se van también sus precios: quedaban los del
    // anterior y era fácil registrar otro repuesto con un precio que no era suyo.
    if (!repuestoId) {
      this.detalles.at(indice).patchValue({ precioUnitario: 0, precioVenta: null });
      this.sincronizarTotales();
      return;
    }

    const repuesto = this.repuestos().find((r) => r.repuestoId === repuestoId);
    if (!repuesto) return;

    this.detalles.at(indice).patchValue({
      precioUnitario: repuesto.precioCompra,
      precioVenta: repuesto.precioVenta,
    });
    this.sincronizarTotales();
  }

  /** Repuesto elegido en una fila ('' si todavía no tiene). */
  protected repuestoDeFila(indice: number): string {
    return this.detalles.at(indice)?.get('repuestoId')?.value ?? '';
  }

  protected esRepuestoNuevo(indice: number): boolean {
    return this.repuestosNuevos().has(this.repuestoDeFila(indice));
  }

  /** Categoría del repuesto nuevo de una fila, para mostrarla bajo su nombre. */
  protected categoriaDeNuevo(indice: number): string {
    const nuevo = this.repuestosNuevos().get(this.repuestoDeFila(indice));
    return this.categorias().find((c) => c.categoriaId === nuevo?.categoriaId)?.nombre ?? '';
  }

  /** Fila con repuesto nuevo y sin precio de venta: lo único que no puede quedar vacío. */
  protected faltaPrecioVentaNuevo(indice: number): boolean {
    return this.esRepuestoNuevo(indice) && this.detalles.at(indice).get('precioVenta')?.value == null;
  }

  /**
   * Abre el formulario corto con lo que ya se escribió en el buscador y la
   * categoría sugerida por el nombre: muchas veces basta con confirmar.
   * Si la fila ya tiene un repuesto nuevo, se abre para corregirlo.
   */
  protected abrirRepuestoNuevo(indice: number, nombre = ''): void {
    const actual = this.repuestosNuevos().get(this.repuestoDeFila(indice));
    const categoriaId = actual?.categoriaId
      ?? sugerirCategoriaRepuesto(nombre, this.categorias())?.categoriaId
      ?? '';
    this.formRepuestoNuevo.reset({ nombre: actual?.nombre ?? nombre, categoriaId });
    this.filaRepuestoNuevo.set(indice);
  }

  /** Categoría que corresponde al nombre escrito, mientras no se haya elegido una. */
  protected sugerenciaCategoria(): CategoriaRepuesto | null {
    const { nombre, categoriaId } = this.formRepuestoNuevo.getRawValue();
    return categoriaId ? null : sugerirCategoriaRepuesto(nombre, this.categorias());
  }

  protected usarSugerenciaCategoria(categoria: CategoriaRepuesto): void {
    this.formRepuestoNuevo.controls.categoriaId.setValue(categoria.categoriaId);
  }

  protected invalidoNuevo(): boolean {
    const campo = this.formRepuestoNuevo.controls.nombre;
    return campo.invalid && campo.touched;
  }

  /**
   * Deja el repuesto nuevo elegido en su fila. Todavía no se guarda: se crea
   * al registrar la compra, con stock mínimo 1 y de uso general (la foto, la
   * descripción y los vehículos compatibles se completan después en Repuestos).
   */
  protected crearRepuestoNuevo(): void {
    const indice = this.filaRepuestoNuevo();
    if (indice === null) return;

    const nombre = this.formRepuestoNuevo.controls.nombre.value.trim();
    if (!nombre) {
      this.formRepuestoNuevo.markAllAsTouched();
      this.notificacion.advertencia('Para crear el repuesto falta: el nombre.');
      return;
    }

    // Si ya existe, se elige ese: dos repuestos con el mismo nombre confunden el stock.
    const buscado = nombre.toLowerCase();
    const existente = this.repuestos().find((r) => r.nombre.trim().toLowerCase() === buscado);
    if (existente) {
      this.detalles.at(indice).patchValue({ repuestoId: existente.repuestoId });
      this.onRepuestoSeleccionado(indice, existente.repuestoId);
      this.filaRepuestoNuevo.set(null);
      this.notificacion.advertencia(`Ya existe un repuesto llamado “${existente.nombre}”: quedó elegido en la fila.`);
      return;
    }

    const claveActual = this.repuestoDeFila(indice);
    const clave = this.repuestosNuevos().has(claveActual) ? claveActual : `NUEVO-${++this.contadorNuevos}`;
    const categoriaId = this.formRepuestoNuevo.controls.categoriaId.value;

    this.repuestosNuevos.update((nuevos) => new Map(nuevos).set(clave, { nombre, categoriaId }));
    // Un repuesto nuevo no tiene precios: no hereda los de lo que hubiera en la fila.
    if (clave !== claveActual) {
      this.detalles.at(indice).patchValue({ precioUnitario: 0, precioVenta: null });
    }
    this.detalles.at(indice).patchValue({ repuestoId: clave });
    this.sincronizarTotales();
    this.filaRepuestoNuevo.set(null);
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

  /** Lo que impide registrar la compra, dicho en concreto (no "complete el formulario"). */
  private queFalta(): string {
    const faltan: string[] = [];

    if (!this.ocasional() && !this.formulario.controls.proveedorId.value) faltan.push('el proveedor');

    if (this.detalles.length === 0) {
      faltan.push('al menos un repuesto (botón “+ Agregar repuesto”)');
    } else {
      this.detalles.controls.forEach((linea, i) => {
        const fila = this.detalles.length > 1 ? ` de la fila ${i + 1}` : '';
        if (linea.get('repuestoId')?.invalid) faltan.push(`el repuesto${fila}`);
        else if (linea.get('cantidad')?.invalid) faltan.push(`la cantidad${fila} (1 o más)`);
        else if (linea.get('precioUnitario')?.invalid) faltan.push(`el precio de compra${fila} (mayor a 0)`);
        else if (linea.get('precioVenta')?.invalid) faltan.push(`un precio de venta válido${fila}`);
        else if (this.faltaPrecioVentaNuevo(i)) faltan.push(`el precio de venta${fila} (es un repuesto nuevo)`);
      });
    }

    if (faltan.length === 0) return 'Revise los datos de la compra.';

    // "el proveedor, el repuesto y la cantidad"
    const lista = faltan.length === 1
      ? faltan[0]
      : `${faltan.slice(0, -1).join(', ')} y ${faltan[faltan.length - 1]}`;
    return `Para registrar la compra falta: ${lista}.`;
  }

  /**
   * Enter en una casilla no registra la compra: quien elige un repuesto con
   * Enter y vuelve a presionarlo la registraba sin querer. Se registra solo con
   * el botón, que es una decisión que no se puede deshacer.
   */
  protected evitarEnvioConEnter(evento: Event): void {
    if ((evento.target as HTMLElement).tagName === 'INPUT') evento.preventDefault();
  }

  protected guardar(): void {
    const faltaPrecioNuevo = this.detalles.controls.some((_, i) => this.faltaPrecioVentaNuevo(i));
    if (this.formulario.invalid || this.detalles.length === 0 || faltaPrecioNuevo) {
      this.formulario.markAllAsTouched();
      this.notificacion.advertencia(this.queFalta());
      return;
    }

    this.guardando.set(true);

    const datos = this.formulario.getRawValue();
    const ocasional = this.ocasional();

    this.servicio.crear({
      ocasional,
      proveedorId: ocasional ? null : datos.proveedorId,
      referencia: datos.referencia.trim() || null,
      detalles: datos.detalles.map((d) => {
        const nuevo = this.repuestosNuevos().get(d.repuestoId);
        return {
          repuestoId: nuevo ? null : d.repuestoId,
          repuestoNuevo: nuevo ? { nombre: nuevo.nombre, categoriaId: nuevo.categoriaId || null } : null,
          cantidad: d.cantidad,
          precioUnitario: d.precioUnitario,
          precioVenta: d.precioVenta,
        };
      }),
    }).subscribe({
      next: () => {
        this.notificacion.exito(
          ocasional ? 'Compra ocasional registrada y stock actualizado.' : 'Compra registrada y stock actualizado.',
        );
        this.guardando.set(false);
        this.formularioAbierto.set(false);
        this.cargar();
        // El stock cambió: recargamos el catálogo para las próximas compras.
        this.repuestosService
          .getAll({ tamanoPagina: 500 })
          .subscribe((resultado) => this.repuestos.set(resultado.items));
        // Una compra puede sacar repuestos de la alerta de stock bajo.
        this.contadores.refrescar();
      },
      error: () => this.guardando.set(false),
    });
  }

  protected verDetalle(compra: Compra): void {
    const conocido = this.detallesCompra().get(compra.compraId);
    if (conocido) {
      this.detalle.set(conocido);
      return;
    }
    this.servicio.getById(compra.compraId).subscribe((completa) => this.detalle.set(completa));
  }

  /** Contacto del proveedor de la compra, o de dónde salió una ocasional. */
  protected contactoDe(compra: CompraDetalle): string {
    if (compra.ocasional) return 'Compra ocasional, sin proveedor registrado';

    const proveedor = this.proveedores().find((p) => p.proveedorId === compra.proveedorId);
    return [proveedor?.contacto, proveedor?.telefono].filter(Boolean).join(' · ') || 'Proveedor registrado';
  }

  /** Precio de venta actual del repuesto, para ver la ganancia de lo comprado. */
  protected ventaDe(repuestoId: string): number | null {
    return this.repuestos().find((r) => r.repuestoId === repuestoId)?.precioVenta ?? null;
  }

  /** "60 %" (o "-10 %" si se pierde): cuánto se gana sobre lo que costó. */
  protected ganancia(compra: number, venta: number): string {
    if (compra <= 0) return '';
    const porcentaje = Math.round(((venta - compra) / compra) * 100);
    return `${porcentaje} %`;
  }

  /** Color del avatar de la fila, fijo por código (estándar de tablas). */
  protected tono(id: string): string {
    return ['azul', 'verde', 'naranja', 'rojo'][Number(id.replace(/\D/g, '')) % 4];
  }

  /** "Aceite 10w40" → "AC"; las dos primeras palabras con sustancia. */
  protected iniciales(nombre: string): string {
    const palabras = nombre.split(/\s+/).filter((p) => p.length > 2);
    return (palabras.length ? palabras : [nombre])
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase();
  }

  /** "1 unidad" o "N unidades": lo que la compra sumó al stock. */
  protected unidades(compra: CompraDetalle): string {
    const total = compra.detalles.reduce((suma, linea) => suma + linea.cantidad, 0);
    return total === 1 ? '1 unidad' : `${total} unidades`;
  }
}
