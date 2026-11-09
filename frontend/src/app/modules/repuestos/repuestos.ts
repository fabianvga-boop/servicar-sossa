import { Placa } from '../../shared/components/placa';
import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

import {
  TipoAjusteStock,
  TipoAplicacionRepuesto,
  TipoMovimientoInventario,
} from '../../core/models/enums';
import {
  CategoriaRepuesto,
  CompatibilidadRepuesto,
  ProcedenciaRepuesto,
  Proveedor,
  Repuesto,
} from '../../core/models/inventario.model';
import { PlantillaVehiculo, Vehiculo } from '../../core/models/personas.model';
import { urlArchivo } from '../../core/services/api-base';
import { AuthService } from '../../core/services/auth.service';
import { ContadoresService } from '../../core/services/contadores.service';
import {
  CategoriasRepuestoService,
  ProveedoresService,
  RepuestosService,
} from '../../core/services/inventario.service';
import { NotificacionService } from '../../core/services/notificacion.service';
import { PlantillasVehiculoService } from '../../core/services/plantillas-vehiculo.service';
import { PreferenciasService } from '../../core/services/preferencias.service';
import { VehiculosService } from '../../core/services/vehiculos.service';
import { ElegirFoto } from '../../shared/components/elegir-foto';
import { EstadoTabla } from '../../shared/components/estado-tabla';
import { GestionCategorias } from '../../shared/components/gestion-categorias';
import { Modal } from '../../shared/components/modal';
import { Cajon } from '../../shared/components/cajon';
import { Paginador } from '../../shared/components/paginador';
import { PaginacionLocal, TODOS_LOS_REGISTROS } from '../../shared/paginacion-local';
import { OpcionSelector, SelectorBusqueda } from '../../shared/components/selector-busqueda';
import { Atajo } from '../../shared/directives/atajo';
import { EnfocarError } from '../../shared/directives/enfocar-error';
import { SiTieneRol } from '../../shared/directives/si-tiene-rol';
import { BolivianosPipe } from '../../shared/pipes/bolivianos.pipe';
import { SIN_CATEGORIA, sugerirCategoriaRepuesto } from '../../shared/categorias-repuesto';
import {
  marcasSugeridas,
  modelosSugeridos,
  parecidoEnCatalogo,
} from '../../shared/vehiculo-sugerencias';

const CLAVE_BUSCAR = 'repuestos.buscar';
const CLAVE_STOCK_BAJO = 'repuestos.stockBajo';

/** Vista rápida de la lista: todos, por reponer, agotados o solo para ciertos vehículos. */
type VistaRepuestos = 'todos' | 'minimo' | 'agotados' | 'especificos';

/** Una fila editable de "Vehículos compatibles" en el formulario. */
interface FilaCompatibilidad {
  marca: string;
  modelo: string;
  anioDesde: number | null;
  anioHasta: number | null;
}

/** Marca o modelo fuera del catálogo que se parece mucho a uno que sí está. */
interface AvisoCatalogo {
  campo: 'marca' | 'modelo';
  escrito: string;
  sugerido: string;
}

const SIN_OPCIONES: OpcionSelector[] = [];

/** USU026, USU027, USU030 — inventario de repuestos. */
@Component({
  selector: 'app-repuestos',
  imports: [
    Placa,
    ReactiveFormsModule,
    FormsModule,
    DatePipe,
    Modal,
    ElegirFoto,
    EstadoTabla,
    GestionCategorias,
    Cajon,
    Paginador,
    SelectorBusqueda,
    Atajo,
    EnfocarError,
    SiTieneRol,
    BolivianosPipe,
  ],
  templateUrl: './repuestos.html',
  styleUrls: ['./repuestos.css', './repuesto-ficha.css'],
})
export class Repuestos {
  private readonly servicio = inject(RepuestosService);
  private readonly proveedoresService = inject(ProveedoresService);
  private readonly categoriasService = inject(CategoriasRepuestoService);
  private readonly vehiculosService = inject(VehiculosService);
  private readonly plantillasService = inject(PlantillasVehiculoService);
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
  /** Llega por URL desde la ficha de un proveedor (?proveedorId=…), sin selector propio. */
  protected readonly proveedorFiltro = signal('');
  protected readonly guardando = signal(false);

  // --- Categoría del repuesto ------------------------------------------------
  protected readonly categorias = signal<CategoriaRepuesto[]>([]);
  /** Filtro de la lista: una categoría, SIN_CATEGORIA o vacío (todas). */
  protected readonly categoriaFiltro = signal('');
  protected readonly gestionCategorias = signal(false);

  protected readonly opcionesCategoria = computed<OpcionSelector[]>(() =>
    this.categorias().map((c) => ({
      valor: c.categoriaId,
      etiqueta: c.nombre,
      detalle: `${c.cantidadRepuestos} repuesto(s)`,
    })),
  );

  protected readonly opcionesFiltroCategoria = computed<OpcionSelector[]>(() => [
    { valor: SIN_CATEGORIA, etiqueta: 'Sin categoría', detalle: 'para completarla' },
    ...this.categorias().map((c) => ({ valor: c.categoriaId, etiqueta: c.nombre })),
  ]);

  protected readonly totalRegistros = signal(0);
  protected readonly totalPaginas = signal(0);

  protected readonly editando = signal<Repuesto | null>(null);
  protected readonly formularioAbierto = signal(false);
  protected readonly ajustando = signal<Repuesto | null>(null);
  protected readonly nuevoStock = signal(0);
  protected readonly tipoAjuste = signal<TipoAjusteStock>(TipoAjusteStock.ConteoFisico);
  protected readonly motivoAjuste = signal('');

  /** Opciones del selector de motivo del ajuste. */
  protected readonly TIPOS_AJUSTE = [
    { valor: TipoAjusteStock.ConteoFisico, etiqueta: 'Conteo físico' },
    { valor: TipoAjusteStock.MermaRotura, etiqueta: 'Merma o rotura' },
    { valor: TipoAjusteStock.Correccion, etiqueta: 'Corrección de error' },
    { valor: TipoAjusteStock.Otro, etiqueta: 'Otro' },
  ];

  // Foto del producto (opcional).
  protected readonly fotoDe = signal<Repuesto | null>(null);
  protected readonly subiendoFoto = signal(false);
  protected readonly urlArchivo = urlArchivo;

  /** Cómo se ve cada tipo de movimiento del kárdex. */
  protected readonly ESTILO_MOVIMIENTO: Record<TipoMovimientoInventario, { texto: string; tono: string }> = {
    [TipoMovimientoInventario.SaldoInicial]: { texto: 'Saldo anterior', tono: 'gris' },
    [TipoMovimientoInventario.StockInicial]: { texto: 'Stock inicial', tono: 'gris' },
    [TipoMovimientoInventario.Compra]: { texto: 'Compra', tono: 'verde' },
    [TipoMovimientoInventario.SalidaOrden]: { texto: 'Orden', tono: 'azul' },
    [TipoMovimientoInventario.DevolucionOrden]: { texto: 'Devolución', tono: 'azul' },
    [TipoMovimientoInventario.Venta]: { texto: 'Venta', tono: 'azul' },
    [TipoMovimientoInventario.AnulacionVenta]: { texto: 'Venta anulada', tono: 'gris' },
    [TipoMovimientoInventario.Ajuste]: { texto: 'Ajuste', tono: 'naranja' },
  };

  /** Merma o rotura es pérdida: no puede subir el stock (la API también lo rechaza). */
  protected readonly ajusteInvalido = computed(() => {
    const repuesto = this.ajustando();
    return (
      !!repuesto &&
      this.tipoAjuste() === TipoAjusteStock.MermaRotura &&
      this.nuevoStock() > repuesto.stockActual
    );
  });

  // Procedencia del stock (historial de compras del repuesto).
  protected readonly procedenciaDe = signal<Repuesto | null>(null);
  /** Repuesto cuyo kárdex pidió abrir un enlace, hasta que llega la lista. */
  private procedenciaPendiente: string | null = null;
  protected readonly procedencia = signal<ProcedenciaRepuesto | null>(null);
  protected readonly cargandoProcedencia = signal(false);

  // Foto elegida en el propio formulario de alta/edición, antes de guardar.
  protected readonly archivoFoto = signal<File | null>(null);
  protected readonly previsualizacionFoto = signal<string | null>(null);

  // --- Precio de venta por margen: calcular en vez de teclear ---------------
  /** Márgenes de un clic sobre el precio de compra. */
  protected readonly MARGENES = [20, 30, 40, 50];
  /** Espejos reactivos de los precios para la lectura del margen. */
  protected readonly precioCompraActual = signal(0);
  protected readonly precioVentaActual = signal(0);

  /** Margen resultante (%) mientras ambos precios sean válidos; si no, null. */
  protected readonly margenActual = computed(() => {
    const compra = this.precioCompraActual();
    const venta = this.precioVentaActual();
    if (compra <= 0 || venta <= 0) return null;
    return Math.round(((venta - compra) / compra) * 100);
  });

  /** Nombres ya registrados para autocompletar y evitar duplicados. */
  protected readonly nombresSugeridos = computed(() => {
    const nombres = this.repuestos()
      .map((r) => r.nombre?.trim())
      .filter((n): n is string => !!n);
    return [...new Set(nombres)].sort((a, b) => a.localeCompare(b));
  });

  // --- Compatibilidad por vehículo ---------------------------------------------
  protected readonly TipoAplicacion = TipoAplicacionRepuesto;
  protected readonly TipoMovimiento = TipoMovimientoInventario;
  protected readonly tipoAplicacion = signal<TipoAplicacionRepuesto>(TipoAplicacionRepuesto.Universal);
  protected readonly filasCompat = signal<FilaCompatibilidad[]>([]);
  protected readonly errorCompat = signal('');

  /** Vehículos registrados: alimentan el catálogo de marca/modelo y el filtro. */
  private readonly vehiculos = signal<Vehiculo[]>([]);
  /** Plantillas de vehículo: otra fuente del catálogo (solo las ve el Administrador). */
  private readonly plantillas = signal<PlantillaVehiculo[]>([]);
  protected readonly anioMaximo = new Date().getFullYear() + 1;

  /**
   * Catálogo de marcas y modelos para los vehículos compatibles: los
   * frecuentes de vehiculo-sugerencias, más los de los vehículos registrados
   * y las plantillas. Así se elige en vez de escribir, con la misma escritura
   * que tendrán los vehículos contra los que luego se compara.
   */
  private readonly registrados = computed(() => [...this.vehiculos(), ...this.plantillas()]);
  private readonly marcasCatalogo = computed(() => marcasSugeridas(this.registrados()));
  protected readonly opcionesMarca = computed<OpcionSelector[]>(() =>
    this.marcasCatalogo().map((m) => ({ valor: m, etiqueta: m })),
  );

  /** Modelos por marca, calculados una vez por cambio y no en cada detección. */
  private readonly modelosPorMarca = computed(() => {
    const mapa = new Map<string, OpcionSelector[]>();
    for (const fila of this.filasCompat()) {
      const clave = fila.marca.trim().toLowerCase();
      if (!clave || mapa.has(clave)) continue;
      mapa.set(
        clave,
        modelosSugeridos(this.registrados(), fila.marca).map((m) => ({ valor: m, etiqueta: m })),
      );
    }
    return mapa;
  });

  /** Por fila: aviso si la marca o el modelo parece un error de tipeo. */
  protected readonly avisosCatalogo = computed<(AvisoCatalogo | null)[]>(() =>
    this.filasCompat().map((f): AvisoCatalogo | null => {
      const marca = parecidoEnCatalogo(f.marca, this.marcasCatalogo());
      if (marca) return { campo: 'marca', escrito: f.marca, sugerido: marca };

      const modelos = this.opcionesModelo(f.marca).map((o) => o.valor);
      const modelo = parecidoEnCatalogo(f.modelo, modelos);
      return modelo ? { campo: 'modelo', escrito: f.modelo, sugerido: modelo } : null;
    }),
  );

  /** Filtro "Para el vehículo…": deja solo universales y compatibles. */
  protected readonly vehiculoFiltro = signal('');
  /** Con un vehículo elegido: solo los marcados para él, o también los de uso general. */
  protected readonly soloCompatibles = signal(false);

  protected readonly opcionesVehiculo = computed<OpcionSelector[]>(() =>
    this.vehiculos().map((v) => ({
      valor: v.vehiculoId,
      etiqueta: `${v.placa} · ${v.marca} ${v.modelo}${v.anio ? ' ' + v.anio : ''}`,
      detalle: v.nombreCliente,
    })),
  );

  protected opcionesModelo(marca: string): OpcionSelector[] {
    return this.modelosPorMarca().get(marca.trim().toLowerCase()) ?? SIN_OPCIONES;
  }

  protected readonly formulario = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(150)]],
    descripcion: ['', Validators.maxLength(255)],
    stockActual: [0, [Validators.required, Validators.min(0)]],
    stockMinimo: [0, [Validators.required, Validators.min(0)]],
    precioCompra: [0, [Validators.required, Validators.min(0)]],
    precioVenta: [0, [Validators.required, Validators.min(0)]],
    proveedorId: [''],
    categoriaId: [''],
  });

  protected readonly opcionesProveedor = computed<OpcionSelector[]>(() =>
    this.proveedores().map((p) => ({
      valor: p.proveedorId,
      etiqueta: p.nombre,
      detalle: `${p.cantidadRepuestos} repuesto(s)`,
    })),
  );

  /** Nombre a mostrar en el chip de filtro activo; cae al código si aún no cargó el catálogo. */
  protected readonly nombreProveedorFiltro = computed(() => {
    const id = this.proveedorFiltro();
    if (!id) return '';
    return this.proveedores().find((p) => p.proveedorId === id)?.nombre ?? id;
  });

  constructor() {
    // El panel enlaza aquí con ?stockBajo=true desde la alerta de reposición, y
    // el buscador global con ?buscar=… Si no viene nada por URL se restaura el
    // último filtro que el usuario dejó puesto.
    const parametros = this.ruta.snapshot.queryParamMap;

    this.buscar.set(parametros.get('buscar') ?? this.preferencias.leer(CLAVE_BUSCAR, ''));
    const enMinimo =
      parametros.get('stockBajo') === 'true' ||
      (!parametros.has('stockBajo') && this.preferencias.leer(CLAVE_STOCK_BAJO, false));
    this.vista.set(enMinimo ? 'minimo' : 'todos');
    // El badge "Repuestos" de la ficha de un proveedor enlaza aquí con
    // ?proveedorId=…: es un filtro de paso, no se guarda como preferencia.
    this.proveedorFiltro.set(parametros.get('proveedorId') ?? '');

    this.vehiculoFiltro.set(parametros.get('vehiculoId') ?? '');
    this.soloCompatibles.set(parametros.get('soloCompatibles') === 'true');
    this.categoriaFiltro.set(parametros.get('categoriaId') ?? '');

    // El "Kárdex" del detalle de una compra enlaza con ?procedencia=REP-…: se
    // abre en cuanto llega la lista (que viene filtrada por ese código).
    this.procedenciaPendiente = parametros.get('procedencia');

    this.cargar();
    this.cargarCategorias();

    this.vehiculosService
      .getAll(undefined, undefined, 1, TODOS_LOS_REGISTROS)
      .subscribe((resultado) => this.vehiculos.set(resultado.items));

    if (this.auth.esAdministrador()) {
      this.plantillasService.getAll().subscribe((lista) => this.plantillas.set(lista));

      this.proveedoresService
        .getAll(undefined, 1, TODOS_LOS_REGISTROS)
        .subscribe((resultado) => this.proveedores.set(resultado.items));
    }
  }

  // --- Vista rápida por estado (sobre lo cargado) ------------------------------

  protected readonly vista = signal<VistaRepuestos>('todos');

  protected pasaVista(r: Repuesto, vista: VistaRepuestos): boolean {
    switch (vista) {
      case 'minimo':
        return r.stockBajo || r.stockActual <= 0;
      case 'agotados':
        return r.stockActual <= 0;
      case 'especificos':
        return r.tipoAplicacion === TipoAplicacionRepuesto.Especifico;
      default:
        return true;
    }
  }

  // --- Búsqueda guiada: vehículo → categoría → stock -------------------------

  /** Sin un vehículo registrado elegido, se puede ir por marca y modelo. */
  protected readonly marcaFiltro = signal('');
  protected readonly modeloFiltro = signal('');

  private static igual(a: string | null | undefined, b: string | null | undefined): boolean {
    return (a ?? '').trim().toLocaleLowerCase('es') === (b ?? '').trim().toLocaleLowerCase('es');
  }

  /** Marcas para las que hay repuestos marcados, con cuántos. */
  protected readonly marcasCompat = computed(() => {
    const cuenta = new Map<string, { nombre: string; cuenta: number }>();
    for (const r of this.repuestos()) {
      const vistas = new Set<string>();
      for (const c of r.compatibilidades ?? []) {
        const clave = c.marca.trim().toLocaleLowerCase('es');
        if (!clave || vistas.has(clave)) continue;
        vistas.add(clave);
        const actual = cuenta.get(clave);
        if (actual) actual.cuenta++;
        else cuenta.set(clave, { nombre: c.marca.trim(), cuenta: 1 });
      }
    }
    return [...cuenta.values()].sort((a, b) => b.cuenta - a.cuenta).slice(0, 10);
  });

  /** Modelos de la marca elegida, con cuántos repuestos. */
  protected readonly modelosCompat = computed(() => {
    const marca = this.marcaFiltro();
    if (!marca) return [];
    const cuenta = new Map<string, { nombre: string; cuenta: number }>();
    for (const r of this.repuestos()) {
      const vistas = new Set<string>();
      for (const c of r.compatibilidades ?? []) {
        if (!Repuestos.igual(c.marca, marca) || !c.modelo?.trim()) continue;
        const clave = c.modelo.trim().toLocaleLowerCase('es');
        if (vistas.has(clave)) continue;
        vistas.add(clave);
        const actual = cuenta.get(clave);
        if (actual) actual.cuenta++;
        else cuenta.set(clave, { nombre: c.modelo.trim(), cuenta: 1 });
      }
    }
    return [...cuenta.values()].sort((a, b) => b.cuenta - a.cuenta);
  });

  private pasaMarca(r: Repuesto): boolean {
    const marca = this.marcaFiltro();
    if (!marca || this.vehiculoFiltro()) return true;
    if (r.tipoAplicacion !== TipoAplicacionRepuesto.Especifico) return !this.soloCompatibles();
    const modelo = this.modeloFiltro();
    return (r.compatibilidades ?? []).some(
      (c) => Repuestos.igual(c.marca, marca) && (!modelo || !c.modelo?.trim() || Repuestos.igual(c.modelo, modelo)),
    );
  }

  private pasaCategoria(r: Repuesto): boolean {
    const categoria = this.categoriaFiltro();
    if (!categoria) return true;
    return categoria === SIN_CATEGORIA ? !r.categoriaId : r.categoriaId === categoria;
  }

  /** Lo que sirve para el vehículo (o marca/modelo) elegido, antes de la categoría. */
  private readonly delVehiculo = computed(() => this.repuestos().filter((r) => this.pasaMarca(r)));

  /** Las categorías de lo que sirve, con cuántos hay de cada una. */
  protected readonly categoriasConCuenta = computed(() => {
    const cuenta = new Map<string, number>();
    let sinCategoria = 0;
    for (const r of this.delVehiculo()) {
      if (r.categoriaId) cuenta.set(r.categoriaId, (cuenta.get(r.categoriaId) ?? 0) + 1);
      else sinCategoria++;
    }
    // La elegida se muestra siempre (aunque el vehículo no tenga ninguna), para poder quitarla.
    const elegida = this.categoriaFiltro();
    const lista = this.categorias()
      .filter((c) => cuenta.has(c.categoriaId) || c.categoriaId === elegida)
      .map((c) => ({ id: c.categoriaId, nombre: c.nombre, cuenta: cuenta.get(c.categoriaId) ?? 0 }))
      .sort((a, b) => b.cuenta - a.cuenta);
    if (sinCategoria > 0 || elegida === SIN_CATEGORIA) {
      lista.push({ id: SIN_CATEGORIA, nombre: 'Sin categoría', cuenta: sinCategoria });
    }
    return lista;
  });

  private readonly enCategoria = computed(() => this.delVehiculo().filter((r) => this.pasaCategoria(r)));

  protected readonly cuentasVista = computed(() => {
    const lista = this.enCategoria();
    return {
      todos: lista.length,
      minimo: lista.filter((r) => this.pasaVista(r, 'minimo')).length,
      agotados: lista.filter((r) => this.pasaVista(r, 'agotados')).length,
      especificos: lista.filter((r) => this.pasaVista(r, 'especificos')).length,
    };
  });

  protected readonly filtrados = computed(() => this.enCategoria().filter((r) => this.pasaVista(r, this.vista())));

  protected readonly paginacion = new PaginacionLocal(
    () => this.filtrados(),
    () => [
      this.vista(), this.buscar(), this.proveedorFiltro(), this.vehiculoFiltro(), this.categoriaFiltro(),
      this.marcaFiltro(), this.modeloFiltro(), this.soloCompatibles(),
    ],
    12,
  );

  /** El vehículo registrado elegido arriba a la derecha. */
  protected readonly vehiculoElegido = computed(
    () => this.vehiculos().find((v) => v.vehiculoId === this.vehiculoFiltro()) ?? null,
  );

  /** "Toyota Rav4 2018 › Pastillas de freno › Solo compatibles". */
  protected readonly miga = computed(() => {
    const partes: string[] = [];
    const v = this.vehiculoElegido();
    if (v) partes.push(`${v.marca} ${v.modelo}${v.anio ? ' ' + v.anio : ''}`);
    else if (this.marcaFiltro()) partes.push([this.marcaFiltro(), this.modeloFiltro()].filter(Boolean).join(' '));
    const cat = this.categoriaFiltro();
    if (cat) partes.push(cat === SIN_CATEGORIA ? 'Sin categoría' : (this.categorias().find((c) => c.categoriaId === cat)?.nombre ?? ''));
    if (v || this.marcaFiltro()) partes.push(this.soloCompatibles() ? 'Solo compatibles' : 'Con los de uso general');
    return partes.filter(Boolean);
  });

  /** Con "Solo compatibles": cuántos de uso general quedaron afuera. */
  protected readonly cantidadUsoGeneral = signal(0);

  protected elegirMarca(marca: string): void {
    const nueva = Repuestos.igual(this.marcaFiltro(), marca) ? '' : marca;
    this.marcaFiltro.set(nueva);
    this.modeloFiltro.set('');
    if (nueva) this.soloCompatibles.set(true);
    this.actualizarUsoGeneral();
  }

  protected elegirModelo(modelo: string): void {
    this.modeloFiltro.set(Repuestos.igual(this.modeloFiltro(), modelo) ? '' : modelo);
  }

  protected elegirCategoria(categoriaId: string): void {
    this.categoriaFiltro.set(this.categoriaFiltro() === categoriaId ? '' : categoriaId);
  }

  /** Cuenta los de uso general que sirven pero no se muestran. */
  private actualizarUsoGeneral(): void {
    if (!this.soloCompatibles()) {
      this.cantidadUsoGeneral.set(0);
      return;
    }
    if (this.vehiculoFiltro()) {
      this.servicio
        .getAll({ vehiculoId: this.vehiculoFiltro(), pagina: 1, tamanoPagina: 1 })
        .subscribe((r) => this.cantidadUsoGeneral.set(Math.max(0, r.totalRegistros - this.repuestos().length)));
    } else if (this.marcaFiltro()) {
      this.cantidadUsoGeneral.set(
        this.repuestos().filter((r) => r.tipoAplicacion !== TipoAplicacionRepuesto.Especifico).length,
      );
    }
  }

  protected elegirVista(vista: VistaRepuestos): void {
    this.vista.set(vista);
    this.preferencias.guardar(CLAVE_STOCK_BAJO, vista === 'minimo');
  }

  /** Barra de stock: el actual contra cuatro veces el mínimo (un nivel cómodo). */
  protected nivelStock(r: Repuesto): number {
    if (r.stockActual <= 0) return 3;
    return Math.min(100, Math.max(6, Math.round((r.stockActual / Math.max(r.stockMinimo * 4, 1)) * 100)));
  }

  protected inicialesRepuesto(nombre: string): string {
    const palabras = nombre.split(/\s+/).filter((p) => p.length > 2);
    return (palabras.length ? palabras : [nombre]).slice(0, 2).map((p) => p[0] ?? '').join('').toUpperCase();
  }

  /** Hay algo elegido en la búsqueda guiada o en el buscador: se ofrece quitarlo. */
  protected readonly hayFiltros = computed(
    () =>
      !!(this.vehiculoFiltro() || this.marcaFiltro() || this.categoriaFiltro() || this.proveedorFiltro() || this.buscar()) ||
      this.vista() !== 'todos',
  );

  /** "Quitar" del paso 1: el vehículo, o la marca y el modelo elegidos. */
  protected quitarVehiculoOMarca(): void {
    this.marcaFiltro.set('');
    this.modeloFiltro.set('');
    if (this.vehiculoFiltro()) this.filtrarPorVehiculo(null);
    else this.actualizarUsoGeneral();
  }

  protected limpiarFiltros(): void {
    this.vista.set('todos');
    this.marcaFiltro.set('');
    this.modeloFiltro.set('');
    this.vehiculoFiltro.set('');
    this.categoriaFiltro.set('');
    this.proveedorFiltro.set('');
    this.onBuscar('');
  }

  protected cargar(): void {
    this.cargando.set(true);

    // Todo lo que coincide de una vez: la vista por estado se filtra en pantalla.
    this.servicio
      .getAll({
        buscar: this.buscar() || undefined,
        proveedorId: this.proveedorFiltro() || undefined,
        vehiculoId: this.vehiculoFiltro() || undefined,
        soloCompatibles: (!!this.vehiculoFiltro() && this.soloCompatibles()) || undefined,
        pagina: 1,
        tamanoPagina: TODOS_LOS_REGISTROS,
      })
      .subscribe({
        next: (resultado) => {
          this.repuestos.set(resultado.items);
          this.actualizarUsoGeneral();
          // Con la ficha abierta (p. ej. tras ajustar el stock), se refresca con los datos nuevos.
          const enFicha = this.fichaDe() && resultado.items.find((r) => r.repuestoId === this.fichaDe()!.repuestoId);
          if (enFicha) this.abrirFicha(enFicha);
          this.totalRegistros.set(resultado.totalRegistros);
          this.totalPaginas.set(resultado.totalPaginas);
          this.cargando.set(false);

          const pendiente = resultado.items.find((r) => r.repuestoId === this.procedenciaPendiente);
          this.procedenciaPendiente = null;
          if (pendiente) this.abrirProcedencia(pendiente);
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

  protected filtrarPorVehiculo(vehiculoId: string | null): void {
    this.vehiculoFiltro.set(vehiculoId ?? '');
    // Al elegir un vehículo, primero lo que está marcado para él.
    if (vehiculoId) {
      this.soloCompatibles.set(true);
      this.marcaFiltro.set('');
      this.modeloFiltro.set('');
    }
    this.cargar();
  }


  protected elegirSoloCompatibles(valor: boolean): void {
    this.soloCompatibles.set(valor);
    if (this.vehiculoFiltro()) this.cargar();
    else this.actualizarUsoGeneral();
  }

  protected filtrarPorCategoria(categoriaId: string | null): void {
    this.categoriaFiltro.set(categoriaId ?? '');
  }

  protected cargarCategorias(): void {
    this.categoriasService.getAll().subscribe((lista) => this.categorias.set(lista));
  }

  /** Tras agregar, renombrar o borrar una categoría: la lista y las tarjetas cambian. */
  protected alCambiarCategorias(): void {
    this.cargarCategorias();
    this.cargar();
  }

  // --- Categoría en el formulario --------------------------------------------

  /**
   * Lo elegido en el selector de categoría. Si es un nombre nuevo escrito a
   * mano (“+ Escobillas”), primero se crea la categoría y después se elige.
   */
  protected onCategoriaElegida(valor: string): void {
    if (!valor || this.categorias().some((c) => c.categoriaId === valor)) return;

    this.categoriasService.crear(valor.trim()).subscribe({
      next: (creada) => {
        this.categorias.update((lista) =>
          [...lista, creada].sort((a, b) => a.nombre.localeCompare(b.nombre)),
        );
        this.formulario.controls.categoriaId.setValue(creada.categoriaId);
        this.notificacion.exito(`Categoría “${creada.nombre}” creada.`);
      },
      error: () => this.formulario.controls.categoriaId.setValue(''),
    });
  }

  /** Categoría que corresponde al nombre escrito, mientras no se haya elegido una. */
  protected sugerenciaCategoria(): CategoriaRepuesto | null {
    const { nombre, categoriaId } = this.formulario.getRawValue();
    return categoriaId ? null : sugerirCategoriaRepuesto(nombre, this.categorias());
  }

  protected usarSugerenciaCategoria(categoria: CategoriaRepuesto): void {
    this.formulario.controls.categoriaId.setValue(categoria.categoriaId);
  }

  // --- Edición de la compatibilidad ------------------------------------------

  protected elegirTipoAplicacion(tipo: TipoAplicacionRepuesto): void {
    this.tipoAplicacion.set(tipo);
    this.errorCompat.set('');
    // Al pasar a Específico se ofrece de entrada una fila para completar.
    if (tipo === TipoAplicacionRepuesto.Especifico && this.filasCompat().length === 0) {
      this.agregarFilaCompat();
    }
  }

  protected agregarFilaCompat(): void {
    this.filasCompat.update((filas) => [...filas, { marca: '', modelo: '', anioDesde: null, anioHasta: null }]);
  }

  protected quitarFilaCompat(indice: number): void {
    this.filasCompat.update((filas) => filas.filter((_, i) => i !== indice));
  }

  protected actualizarFilaCompat(
    indice: number,
    campo: keyof FilaCompatibilidad,
    valor: string | null,
  ): void {
    const limpio = (valor ?? '').trim();
    const dato = campo === 'anioDesde' || campo === 'anioHasta'
      ? (limpio === '' ? null : Number(limpio))
      : limpio;

    // Un modelo de otra marca no tiene sentido: al cambiar la marca se
    // conserva solo si también existe en la nueva.
    const modeloSigue = (fila: FilaCompatibilidad) =>
      !fila.modelo ||
      modelosSugeridos(this.registrados(), limpio).some(
        (m) => m.toLowerCase() === fila.modelo.trim().toLowerCase(),
      );

    this.filasCompat.update((filas) =>
      filas.map((f, i) => {
        if (i !== indice) return f;
        const nueva = { ...f, [campo]: dato };
        return campo === 'marca' && !modeloSigue(f) ? { ...nueva, modelo: '' } : nueva;
      }),
    );
    this.errorCompat.set('');
  }

  protected aplicarSugerencia(indice: number, aviso: AvisoCatalogo): void {
    this.actualizarFilaCompat(indice, aviso.campo, aviso.sugerido);
  }

  /**
   * Arma la compatibilidad a enviar y la valida con las mismas reglas que el
   * backend, para avisar antes de guardar. Devuelve null si hay un error.
   */
  private compatibilidadParaEnviar(): CompatibilidadRepuesto[] | null {
    if (this.tipoAplicacion() === TipoAplicacionRepuesto.Universal) return [];

    const filas = this.filasCompat().filter(
      (f) => f.marca.trim() || f.modelo.trim() || f.anioDesde !== null || f.anioHasta !== null,
    );

    if (filas.length === 0) {
      this.errorCompat.set('Agregue al menos un vehículo compatible, o marque el repuesto como de uso general.');
      return null;
    }

    for (const f of filas) {
      if (!f.marca.trim()) {
        this.errorCompat.set('Cada vehículo compatible debe indicar la marca.');
        return null;
      }
      for (const anio of [f.anioDesde, f.anioHasta]) {
        if (anio !== null && (!Number.isInteger(anio) || anio < 1950 || anio > this.anioMaximo)) {
          this.errorCompat.set(`Los años deben estar entre 1950 y ${this.anioMaximo}.`);
          return null;
        }
      }
      if (f.anioDesde !== null && f.anioHasta !== null && f.anioDesde > f.anioHasta) {
        this.errorCompat.set(`En ${f.marca} ${f.modelo}: el año “desde” es mayor que “hasta”.`);
        return null;
      }
    }

    return filas.map((f) => ({
      marca: f.marca.trim(),
      modelo: f.modelo.trim() || null,
      anioDesde: f.anioDesde,
      anioHasta: f.anioHasta,
    }));
  }

  protected limpiarFiltroProveedor(): void {
    this.proveedorFiltro.set('');
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

  /** Cuando está activo, tras guardar se limpia el formulario en vez de cerrarlo. */
  private crearOtro = false;

  /** Deja el formulario listo para un alta nueva, sin abrir ni cerrar el modal. */
  private reiniciarFormulario(): void {
    this.editando.set(null);
    this.formulario.reset({
      stockActual: 0,
      stockMinimo: 0,
      precioCompra: 0,
      precioVenta: 0,
      proveedorId: '',
      categoriaId: '',
    });
    this.formulario.controls.stockActual.enable();
    this.archivoFoto.set(null);
    this.previsualizacionFoto.set(null);
    this.precioCompraActual.set(0);
    this.precioVentaActual.set(0);
    this.tipoAplicacion.set(TipoAplicacionRepuesto.Universal);
    this.filasCompat.set([]);
    this.errorCompat.set('');
  }

  protected abrirNuevo(): void {
    this.reiniciarFormulario();
    this.formularioAbierto.set(true);
  }

  /** Marca que, al guardar, el modal siga abierto para cargar otro repuesto. */
  protected marcarCrearOtro(): void {
    this.crearOtro = true;
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
      categoriaId: repuesto.categoriaId ?? '',
    });

    // El stock no se edita aquí: se mueve por compras y órdenes, o por ajuste.
    this.formulario.controls.stockActual.disable();
    this.archivoFoto.set(null);
    this.previsualizacionFoto.set(repuesto.fotoUrl ? this.urlArchivo(repuesto.fotoUrl) : null);
    this.precioCompraActual.set(repuesto.precioCompra ?? 0);
    this.precioVentaActual.set(repuesto.precioVenta ?? 0);
    this.tipoAplicacion.set(repuesto.tipoAplicacion ?? TipoAplicacionRepuesto.Universal);
    this.filasCompat.set(
      (repuesto.compatibilidades ?? []).map((c) => ({
        marca: c.marca,
        modelo: c.modelo ?? '',
        anioDesde: c.anioDesde ?? null,
        anioHasta: c.anioHasta ?? null,
      })),
    );
    this.errorCompat.set('');
    this.formularioAbierto.set(true);
  }

  protected onPrecioCompraInput(valor: string): void {
    this.precioCompraActual.set(+valor || 0);
  }

  protected onPrecioVentaInput(valor: string): void {
    this.precioVentaActual.set(+valor || 0);
  }

  /** Calcula el precio de venta aplicando un margen sobre el de compra. */
  protected aplicarMargen(porcentaje: number): void {
    const compra = this.precioCompraActual();
    if (compra <= 0) {
      this.notificacion.advertencia('Ingrese primero el precio de compra.');
      return;
    }
    const venta = Math.round(compra * (1 + porcentaje / 100) * 100) / 100;
    this.formulario.controls.precioVenta.setValue(venta);
    this.formulario.controls.precioVenta.markAsDirty();
    this.precioVentaActual.set(venta);
  }

  protected cerrarFormulario(): void {
    this.formularioAbierto.set(false);
    this.editando.set(null);
    this.archivoFoto.set(null);
    this.previsualizacionFoto.set(null);
  }

  /** Foto elegida al crear/editar el repuesto, antes de tener un ID asignado. */
  /** La foto llega ya validada y achicada por app-elegir-foto. */
  protected onFotoFormularioSeleccionada(archivo: File): void {
    this.archivoFoto.set(archivo);
    this.previsualizacionFoto.set(URL.createObjectURL(archivo));
  }

  protected quitarFotoFormulario(): void {
    this.archivoFoto.set(null);
    this.previsualizacionFoto.set(null);
  }

  protected guardar(): void {
    const compatibilidades = this.compatibilidadParaEnviar();

    if (this.formulario.invalid || compatibilidades === null) {
      this.crearOtro = false;
      this.formulario.markAllAsTouched();
      return;
    }

    this.guardando.set(true);
    const datos = this.formulario.getRawValue();
    const enEdicion = this.editando();
    const tipoAplicacion = this.tipoAplicacion();

    const peticion = enEdicion
      ? this.servicio.actualizar(enEdicion.repuestoId, {
          nombre: datos.nombre,
          descripcion: datos.descripcion,
          stockMinimo: datos.stockMinimo,
          precioCompra: datos.precioCompra,
          precioVenta: datos.precioVenta,
          proveedorId: datos.proveedorId || null,
          categoriaId: datos.categoriaId || null,
          tipoAplicacion,
          compatibilidades,
        })
      : this.servicio.crear({
          ...datos,
          proveedorId: datos.proveedorId || null,
          categoriaId: datos.categoriaId || null,
          tipoAplicacion,
          compatibilidades,
        });

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
      error: () => {
        this.crearOtro = false;
        this.guardando.set(false);
      },
    });
  }

  private finalizarGuardado(actualizando: boolean): void {
    // "Crear otro" solo aplica a un alta; en edición siempre se cierra.
    const seguir = this.crearOtro && !actualizando;
    this.crearOtro = false;

    this.notificacion.exito(
      actualizando ? 'Repuesto actualizado.' : 'Repuesto registrado correctamente.',
    );
    this.guardando.set(false);

    if (seguir) {
      // El modal sigue abierto y listo para el siguiente repuesto.
      this.reiniciarFormulario();
    } else {
      this.cerrarFormulario();
    }

    this.cargar();
    // El stock mínimo pudo cambiar: la insignia del menú debe seguirlo.
    this.contadores.refrescar();
  }

  // --- Ficha del repuesto: todo lo que hay que saber, solo para ver -----------

  protected readonly fichaDe = signal<Repuesto | null>(null);
  protected readonly fichaDatos = signal<ProcedenciaRepuesto | null>(null);
  protected readonly cargandoFicha = signal(false);

  /** Al tocar la tarjeta: la ficha con sus últimos movimientos del kárdex. */
  protected abrirFicha(repuesto: Repuesto): void {
    this.fichaDe.set(repuesto);
    this.fichaDatos.set(null);
    this.cargandoFicha.set(true);
    this.servicio.procedencia(repuesto.repuestoId).subscribe({
      next: (datos) => {
        if (this.fichaDe()?.repuestoId === repuesto.repuestoId) this.fichaDatos.set(datos);
        this.cargandoFicha.set(false);
      },
      error: () => this.cargandoFicha.set(false),
    });
  }

  protected cerrarFicha(): void {
    this.fichaDe.set(null);
    this.fichaDatos.set(null);
  }

  /** Desde la ficha se va a Stock, Kárdex o Editar cerrándola primero. */
  protected desdeFicha(accion: 'stock' | 'kardex' | 'editar' | 'foto'): void {
    const repuesto = this.fichaDe();
    if (!repuesto) return;
    // Stock, Kárdex y Foto se abren encima: la ficha queda detrás. Editar sí la
    // reemplaza, porque es otro panel lateral.
    if (accion === 'editar') this.cerrarFicha();
    if (accion === 'stock') this.abrirAjuste(repuesto);
    else if (accion === 'kardex') this.abrirProcedencia(repuesto);
    else if (accion === 'foto') this.abrirFoto(repuesto);
    else this.abrirEditar(repuesto);
  }

  protected readonly ultimosMovimientos = computed(() => [...(this.fichaDatos()?.movimientos ?? [])].reverse().slice(0, 4));

  protected readonly ultimaCompra = computed(
    () => [...(this.fichaDatos()?.compras ?? [])].sort((a, b) => b.fecha.localeCompare(a.fecha))[0] ?? null,
  );

  /** "Toyota 4Runner 2019–2022", para la lista de compatibles. */
  protected textoCompat(c: CompatibilidadRepuesto): string {
    if (c.descripcion?.trim()) return c.descripcion.trim();
    const anios = this.aniosCompat(c);
    return [c.marca, c.modelo, anios === 'Todos los años' ? '' : anios].filter(Boolean).join(' ');
  }

  protected aniosCompat(c: CompatibilidadRepuesto): string {
    if (c.anioDesde && c.anioHasta) return c.anioDesde === c.anioHasta ? `${c.anioDesde}` : `${c.anioDesde}–${c.anioHasta}`;
    if (c.anioDesde) return `desde ${c.anioDesde}`;
    if (c.anioHasta) return `hasta ${c.anioHasta}`;
    return 'Todos los años';
  }

  /** "100 %": cuánto se gana sobre el costo. */
  protected gananciaDe(r: Repuesto): string {
    if (!r.precioCompra) return '—';
    return `${Math.round(((r.precioVenta - r.precioCompra) / r.precioCompra) * 100)} %`;
  }

  // --- Procedencia del stock -------------------------------------------------

  protected abrirProcedencia(repuesto: Repuesto): void {
    this.procedenciaDe.set(repuesto);
    this.procedencia.set(null);
    this.cargandoProcedencia.set(true);

    this.servicio.procedencia(repuesto.repuestoId).subscribe({
      next: (datos) => {
        this.procedencia.set(datos);
        this.cargandoProcedencia.set(false);
      },
      error: () => this.cargandoProcedencia.set(false),
    });
  }

  protected cerrarProcedencia(): void {
    this.procedenciaDe.set(null);
    this.procedencia.set(null);
  }

  protected abrirAjuste(repuesto: Repuesto): void {
    this.ajustando.set(repuesto);
    this.nuevoStock.set(repuesto.stockActual);
    this.tipoAjuste.set(TipoAjusteStock.ConteoFisico);
    this.motivoAjuste.set('');
  }

  protected confirmarAjuste(): void {
    const repuesto = this.ajustando();
    if (!repuesto) return;

    // El motivo es obligatorio: un ajuste de stock sin justificación no debería
    // poder registrarse (queda en la auditoría del repuesto).
    if (!this.motivoAjuste().trim()) {
      this.notificacion.advertencia('Indique el motivo del ajuste.');
      return;
    }

    this.guardando.set(true);

    this.servicio
      .ajustarStock(
        repuesto.repuestoId,
        this.nuevoStock(),
        this.tipoAjuste(),
        this.motivoAjuste().trim(),
      )
      .subscribe({
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

  protected onFotoSeleccionada(archivo: File): void {
    const repuesto = this.fotoDe();
    if (!repuesto) return;

    this.subiendoFoto.set(true);

    this.servicio.subirFoto(repuesto.repuestoId, archivo).subscribe({
      next: (actualizado) => {
        this.fotoDe.set(actualizado);
        this.subiendoFoto.set(false);
        this.cargar();
      },
      error: () => this.subiendoFoto.set(false),
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
