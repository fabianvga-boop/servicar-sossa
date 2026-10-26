import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

import { TipoAjusteStock, TipoAplicacionRepuesto } from '../../core/models/enums';
import {
  CompatibilidadRepuesto,
  ProcedenciaRepuesto,
  Proveedor,
  Repuesto,
} from '../../core/models/inventario.model';
import { PlantillaVehiculo, Vehiculo } from '../../core/models/personas.model';
import { urlArchivo } from '../../core/services/api-base';
import { AuthService } from '../../core/services/auth.service';
import { ContadoresService } from '../../core/services/contadores.service';
import { ProveedoresService, RepuestosService } from '../../core/services/inventario.service';
import { NotificacionService } from '../../core/services/notificacion.service';
import { PlantillasVehiculoService } from '../../core/services/plantillas-vehiculo.service';
import { PreferenciasService } from '../../core/services/preferencias.service';
import { VehiculosService } from '../../core/services/vehiculos.service';
import { EstadoTabla } from '../../shared/components/estado-tabla';
import { Modal } from '../../shared/components/modal';
import { Paginador } from '../../shared/components/paginador';
import { OpcionSelector, SelectorBusqueda } from '../../shared/components/selector-busqueda';
import { Atajo } from '../../shared/directives/atajo';
import { EnfocarError } from '../../shared/directives/enfocar-error';
import { SiTieneRol } from '../../shared/directives/si-tiene-rol';
import { BolivianosPipe } from '../../shared/pipes/bolivianos.pipe';
import {
  marcasSugeridas,
  modelosSugeridos,
  parecidoEnCatalogo,
} from '../../shared/vehiculo-sugerencias';

const CLAVE_BUSCAR = 'repuestos.buscar';
const CLAVE_STOCK_BAJO = 'repuestos.stockBajo';

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
    ReactiveFormsModule,
    FormsModule,
    DatePipe,
    Modal,
    EstadoTabla,
    Paginador,
    SelectorBusqueda,
    Atajo,
    EnfocarError,
    SiTieneRol,
    BolivianosPipe,
  ],
  templateUrl: './repuestos.html',
  styleUrl: './repuestos.css',
})
export class Repuestos {
  private readonly servicio = inject(RepuestosService);
  private readonly proveedoresService = inject(ProveedoresService);
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

  protected readonly pagina = signal(1);
  protected readonly tamanoPagina = signal(20);
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

  // Procedencia del stock (historial de compras del repuesto).
  protected readonly procedenciaDe = signal<Repuesto | null>(null);
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
    this.soloStockBajo.set(
      parametros.get('stockBajo') === 'true' ||
        (!parametros.has('stockBajo') && this.preferencias.leer(CLAVE_STOCK_BAJO, false)),
    );
    // El badge "Repuestos" de la ficha de un proveedor enlaza aquí con
    // ?proveedorId=…: es un filtro de paso, no se guarda como preferencia.
    this.proveedorFiltro.set(parametros.get('proveedorId') ?? '');

    this.vehiculoFiltro.set(parametros.get('vehiculoId') ?? '');

    this.cargar();

    this.vehiculosService
      .getAll(undefined, undefined, 1, 500)
      .subscribe((resultado) => this.vehiculos.set(resultado.items));

    if (this.auth.esAdministrador()) {
      this.plantillasService.getAll().subscribe((lista) => this.plantillas.set(lista));

      this.proveedoresService
        .getAll(undefined, 1, 500)
        .subscribe((resultado) => this.proveedores.set(resultado.items));
    }
  }

  protected cargar(): void {
    this.cargando.set(true);

    this.servicio
      .getAll({
        buscar: this.buscar() || undefined,
        soloStockBajo: this.soloStockBajo() || undefined,
        proveedorId: this.proveedorFiltro() || undefined,
        vehiculoId: this.vehiculoFiltro() || undefined,
        pagina: this.pagina(),
        tamanoPagina: this.tamanoPagina(),
      })
      .subscribe({
        next: (resultado) => {
          this.repuestos.set(resultado.items);
          this.totalRegistros.set(resultado.totalRegistros);
          this.totalPaginas.set(resultado.totalPaginas);
          this.cargando.set(false);
        },
        error: () => this.cargando.set(false),
      });
  }

  protected onBuscar(valor: string): void {
    this.buscar.set(valor);
    this.preferencias.guardar(CLAVE_BUSCAR, valor);
    this.pagina.set(1);
    this.cargar();
  }

  protected alternarStockBajo(): void {
    this.soloStockBajo.update((v) => !v);
    this.preferencias.guardar(CLAVE_STOCK_BAJO, this.soloStockBajo());
    this.pagina.set(1);
    this.cargar();
  }

  protected filtrarPorVehiculo(vehiculoId: string | null): void {
    this.vehiculoFiltro.set(vehiculoId ?? '');
    this.pagina.set(1);
    this.cargar();
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
      this.errorCompat.set('Agregue al menos un vehículo compatible, o marque el repuesto como Universal.');
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
        this.errorCompat.set(`En ${f.marca} ${f.modelo}: el año «desde» es mayor que «hasta».`);
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
          tipoAplicacion,
          compatibilidades,
        })
      : this.servicio.crear({
          ...datos,
          proveedorId: datos.proveedorId || null,
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
