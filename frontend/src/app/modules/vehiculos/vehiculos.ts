import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { EstadoCliente } from '../../core/models/enums';
import {
  Cliente,
  HistorialVehiculo,
  Vehiculo,
  VehiculoFoto,
} from '../../core/models/personas.model';
import { AuthService } from '../../core/services/auth.service';
import { ClientesService } from '../../core/services/clientes.service';
import { NotificacionService } from '../../core/services/notificacion.service';
import { PreferenciasService } from '../../core/services/preferencias.service';
import { urlArchivo } from '../../core/services/api-base';
import { VehiculosService } from '../../core/services/vehiculos.service';
import { Esqueleto } from '../../shared/components/esqueleto';
import { EstadoTabla } from '../../shared/components/estado-tabla';
import { Modal } from '../../shared/components/modal';
import { OpcionSelector, SelectorBusqueda } from '../../shared/components/selector-busqueda';
import { Atajo } from '../../shared/directives/atajo';
import { BolivianosPipe } from '../../shared/pipes/bolivianos.pipe';

const CLAVE_BUSCAR = 'vehiculos.buscar';

/** USU009-USU011 — gestión de vehículos. */
@Component({
  selector: 'app-vehiculos',
  imports: [
    ReactiveFormsModule,
    DatePipe,
    Modal,
    EstadoTabla,
    SelectorBusqueda,
    Atajo,
    Esqueleto,
    BolivianosPipe,
  ],
  templateUrl: './vehiculos.html',
  styleUrl: './vehiculos.css',
})
export class Vehiculos {
  private readonly servicio = inject(VehiculosService);
  private readonly clientesService = inject(ClientesService);
  private readonly fb = inject(FormBuilder);
  private readonly notificacion = inject(NotificacionService);
  private readonly preferencias = inject(PreferenciasService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);

  protected readonly vehiculos = signal<Vehiculo[]>([]);
  protected readonly clientes = signal<Cliente[]>([]);
  protected readonly cargando = signal(true);
  protected readonly buscar = signal('');
  protected readonly clienteFiltro = signal('');
  protected readonly guardando = signal(false);

  protected readonly editando = signal<Vehiculo | null>(null);
  protected readonly formularioAbierto = signal(false);

  protected readonly historialDe = signal<Vehiculo | null>(null);
  protected readonly historial = signal<HistorialVehiculo | null>(null);
  protected readonly cargandoHistorial = signal(false);

  // Galería de fotos (opcional).
  protected readonly galeriaDe = signal<Vehiculo | null>(null);
  protected readonly fotos = signal<VehiculoFoto[]>([]);
  protected readonly cargandoFotos = signal(false);
  protected readonly subiendoFoto = signal(false);
  protected readonly eliminandoFoto = signal<string | null>(null);
  protected readonly urlArchivo = urlArchivo;

  protected readonly formulario = this.fb.nonNullable.group({
    clienteId: ['', Validators.required],
    placa: ['', [Validators.required, Validators.maxLength(15)]],
    marca: ['', [Validators.required, Validators.maxLength(50)]],
    modelo: ['', [Validators.required, Validators.maxLength(50)]],
    anio: [null as number | null, [Validators.min(1900), Validators.max(2100)]],
    color: ['', Validators.maxLength(30)],
    numMotor: ['', Validators.maxLength(50)],
    numChasis: ['', Validators.maxLength(50)],
    kilometraje: [0, Validators.min(0)],
  });

  /** El taller puede tener cientos de clientes: un `<select>` no escala. */
  protected readonly opcionesCliente = computed<OpcionSelector[]>(() =>
    this.clientes().map((c) => ({
      valor: c.clienteId,
      etiqueta: c.razonSocial?.trim() || `${c.nombre} ${c.apellido ?? ''}`.trim(),
      detalle: c.ciNit,
    })),
  );

  constructor() {
    const parametros = this.ruta.snapshot.queryParamMap;

    // El panel de clientes enlaza aquí con ?clienteId=CLI-001 y el buscador
    // global con ?buscar=<placa>; sin parámetros se restaura el último criterio.
    this.clienteFiltro.set(parametros.get('clienteId') ?? '');
    this.buscar.set(parametros.get('buscar') ?? this.preferencias.leer(CLAVE_BUSCAR, ''));

    this.cargar();

    // Solo el administrador puede dar de alta, y necesita el selector de clientes.
    if (this.auth.esAdministrador()) {
      this.clientesService.getAll().subscribe((lista) =>
        this.clientes.set(lista.filter((c) => c.estado === EstadoCliente.Activo)),
      );
    }

    // "+ Vehículo" desde la ficha de un cliente enlaza con ?clienteId=...&nuevo=true:
    // abre el alta directo con el propietario ya elegido, sin buscarlo de nuevo.
    if (parametros.get('nuevo') === 'true') {
      this.abrirNuevo();
      void this.router.navigate([], {
        relativeTo: this.ruta,
        queryParams: { nuevo: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  protected cargar(): void {
    this.cargando.set(true);

    this.servicio
      .getAll(this.buscar() || undefined, this.clienteFiltro() || undefined)
      .subscribe({
        next: (lista) => {
          this.vehiculos.set(lista);
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

  protected onFiltrarCliente(valor: string): void {
    this.clienteFiltro.set(valor);
    this.cargar();
  }

  protected invalido(control: string): boolean {
    const campo = this.formulario.get(control);
    return !!campo && campo.invalid && (campo.touched || campo.dirty);
  }

  /** Mensaje concreto por campo, en vez de un genérico "revise el formulario". */
  protected error(control: string): string {
    const campo = this.formulario.get(control);
    if (!campo || !this.invalido(control)) return '';

    if (campo.hasError('required')) return 'Este campo es obligatorio.';
    if (campo.hasError('min') || campo.hasError('max'))
      return 'El año debe estar entre 1900 y 2100.';
    if (campo.hasError('maxlength')) {
      const { requiredLength } = campo.getError('maxlength');
      return `Máximo ${requiredLength} caracteres.`;
    }

    return 'Revise el valor ingresado.';
  }

  protected abrirNuevo(): void {
    this.editando.set(null);
    this.formulario.reset({ kilometraje: 0, clienteId: this.clienteFiltro() });
    this.formulario.controls.clienteId.enable();
    this.formularioAbierto.set(true);
  }

  protected abrirEditar(vehiculo: Vehiculo): void {
    this.editando.set(vehiculo);
    this.formulario.patchValue({
      clienteId: vehiculo.clienteId,
      placa: vehiculo.placa,
      marca: vehiculo.marca,
      modelo: vehiculo.modelo,
      anio: vehiculo.anio ?? null,
      color: vehiculo.color ?? '',
      numMotor: vehiculo.numMotor ?? '',
      numChasis: vehiculo.numChasis ?? '',
      kilometraje: vehiculo.kilometraje ?? 0,
    });

    // El propietario no se reasigna desde aquí: el backend no lo permite.
    this.formulario.controls.clienteId.disable();
    this.formularioAbierto.set(true);
  }

  protected cerrarFormulario(): void {
    this.formularioAbierto.set(false);
    this.editando.set(null);
  }

  // --- Historial (trazabilidad del vehículo) --------------------------------

  protected abrirHistorial(vehiculo: Vehiculo): void {
    this.historialDe.set(vehiculo);
    this.historial.set(null);
    this.cargandoHistorial.set(true);

    this.servicio.historial(vehiculo.vehiculoId).subscribe({
      next: (historial) => {
        this.historial.set(historial);
        this.cargandoHistorial.set(false);
      },
      error: () => this.cargandoHistorial.set(false),
    });
  }

  protected cerrarHistorial(): void {
    this.historialDe.set(null);
    this.historial.set(null);
  }

  // --- Fotos (galería opcional) ----------------------------------------------

  protected abrirGaleria(vehiculo: Vehiculo): void {
    this.galeriaDe.set(vehiculo);
    this.cargarFotos(vehiculo.vehiculoId);
  }

  protected cerrarGaleria(): void {
    this.galeriaDe.set(null);
    this.fotos.set([]);
  }

  private cargarFotos(vehiculoId: string): void {
    this.cargandoFotos.set(true);

    this.servicio.getFotos(vehiculoId).subscribe({
      next: (lista) => {
        this.fotos.set(lista);
        this.cargandoFotos.set(false);
      },
      error: () => this.cargandoFotos.set(false),
    });
  }

  protected onArchivoSeleccionado(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0];
    const vehiculo = this.galeriaDe();
    if (!archivo || !vehiculo) return;

    if (archivo.size > 8 * 1024 * 1024) {
      this.notificacion.advertencia('La foto no puede superar los 8 MB.');
      input.value = '';
      return;
    }

    this.subiendoFoto.set(true);

    this.servicio.subirFoto(vehiculo.vehiculoId, archivo).subscribe({
      next: (foto) => {
        this.fotos.update((lista) => [foto, ...lista]);
        this.subiendoFoto.set(false);
        input.value = '';
      },
      error: () => {
        this.subiendoFoto.set(false);
        input.value = '';
      },
    });
  }

  protected eliminarFoto(foto: VehiculoFoto): void {
    this.eliminandoFoto.set(foto.fotoId);

    this.servicio.eliminarFoto(foto.vehiculoId, foto.fotoId).subscribe({
      next: () => {
        this.fotos.update((lista) => lista.filter((f) => f.fotoId !== foto.fotoId));
        this.eliminandoFoto.set(null);
      },
      error: () => this.eliminandoFoto.set(null),
    });
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
      ? this.servicio.actualizar(enEdicion.vehiculoId, {
          placa: datos.placa,
          marca: datos.marca,
          modelo: datos.modelo,
          anio: datos.anio,
          color: datos.color,
          numMotor: datos.numMotor,
          numChasis: datos.numChasis,
          kilometraje: datos.kilometraje,
        })
      : this.servicio.crear(datos);

    peticion.subscribe({
      next: () => {
        this.notificacion.exito(
          enEdicion ? 'Vehículo actualizado.' : 'Vehículo registrado correctamente.',
        );
        this.guardando.set(false);
        this.cerrarFormulario();
        this.cargar();
      },
      error: () => this.guardando.set(false),
    });
  }
}
