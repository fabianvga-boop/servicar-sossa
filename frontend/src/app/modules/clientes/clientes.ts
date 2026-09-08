import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { EstadoCliente } from '../../core/models/enums';
import { Cliente, Vehiculo } from '../../core/models/personas.model';
import { ClientesService } from '../../core/services/clientes.service';
import { NotificacionService } from '../../core/services/notificacion.service';
import { PreferenciasService } from '../../core/services/preferencias.service';
import { VehiculosService } from '../../core/services/vehiculos.service';
import { Confirmacion } from '../../shared/components/confirmacion';
import { EstadoTabla } from '../../shared/components/estado-tabla';
import { InsigniaEstado } from '../../shared/components/insignia-estado';
import { Modal } from '../../shared/components/modal';
import { Placa } from '../../shared/components/placa';
import { Atajo } from '../../shared/directives/atajo';
import { EnfocarError } from '../../shared/directives/enfocar-error';
import {
  COLORES_RAPIDOS,
  colorPunto,
  coloresSugeridos,
  marcasSugeridas,
  modelosSugeridos,
} from '../../shared/vehiculo-sugerencias';

const CLAVE_BUSCAR = 'clientes.buscar';

/** Placas que se muestran antes de resumir el resto en un "+N". */
const MAX_PLACAS = 2;

/** USU006-USU008 — gestión de clientes. */
@Component({
  selector: 'app-clientes',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    Modal,
    Confirmacion,
    EstadoTabla,
    InsigniaEstado,
    Placa,
    Atajo,
    EnfocarError,
  ],
  templateUrl: './clientes.html',
  styleUrl: './clientes.css',
})
export class Clientes {
  private readonly servicio = inject(ClientesService);
  private readonly vehiculosService = inject(VehiculosService);
  private readonly fb = inject(FormBuilder);
  private readonly notificacion = inject(NotificacionService);
  private readonly preferencias = inject(PreferenciasService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly clientes = signal<Cliente[]>([]);
  protected readonly cargando = signal(true);
  protected readonly buscar = signal('');
  protected readonly guardando = signal(false);

  /** Cliente en edición; null significa "alta nueva". */
  protected readonly editando = signal<Cliente | null>(null);
  protected readonly formularioAbierto = signal(false);
  protected readonly porCambiarEstado = signal<Cliente | null>(null);

  /** Solo aplica al alta nueva: registrar el primer vehículo en el mismo paso. */
  protected readonly registrarVehiculo = signal(false);

  protected readonly EstadoCliente = EstadoCliente;

  // --- Alta rápida de vehículo: escribir menos (ver vehiculo-sugerencias) ---
  /** Vehículos ya registrados, solo para alimentar las listas de sugerencias. */
  private readonly vehiculosExistentes = signal<Vehiculo[]>([]);
  /** Espejo reactivo de la placa: alimenta la vista previa en vivo. */
  protected readonly placaActual = signal('');
  /** Espejo reactivo de la marca: acota los modelos sugeridos a esa marca. */
  protected readonly marcaActual = signal('');

  protected readonly COLORES_RAPIDOS = COLORES_RAPIDOS;
  protected readonly colorPunto = colorPunto;

  protected readonly marcasSugeridas = computed(() => marcasSugeridas(this.vehiculosExistentes()));
  protected readonly modelosSugeridos = computed(() =>
    modelosSugeridos(this.vehiculosExistentes(), this.marcaActual()),
  );
  protected readonly coloresSugeridos = computed(() =>
    coloresSugeridos(this.vehiculosExistentes()),
  );

  protected readonly formulario = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(100)]],
    apellido: ['', Validators.maxLength(100)],
    razonSocial: ['', Validators.maxLength(150)],
    ciNit: ['', [Validators.required, Validators.maxLength(30)]],
    telefono: ['', Validators.maxLength(20)],
    email: ['', [Validators.email, Validators.maxLength(150)]],
    direccion: ['', Validators.maxLength(200)],
  });

  /** Espeja los campos del alta de vehículo, menos el propietario (se deduce). */
  protected readonly formularioVehiculo = this.fb.nonNullable.group({
    placa: ['', Validators.maxLength(15)],
    marca: ['', Validators.maxLength(50)],
    modelo: ['', Validators.maxLength(50)],
    anio: [null as number | null, [Validators.min(1900), Validators.max(2100)]],
    color: ['', Validators.maxLength(30)],
    numMotor: ['', Validators.maxLength(50)],
    numChasis: ['', Validators.maxLength(50)],
    kilometraje: [0, Validators.min(0)],
  });

  constructor() {
    // El buscador global enlaza aquí con ?buscar=<CI/NIT>; sin parámetro se
    // restaura el último criterio que el usuario dejó puesto.
    const desdeUrl = this.ruta.snapshot.queryParamMap.get('buscar');
    this.buscar.set(desdeUrl ?? this.preferencias.leer(CLAVE_BUSCAR, ''));

    this.cargar();

    // Solo para las listas de sugerencias del alta rápida de vehículo.
    this.vehiculosService.getAll().subscribe((lista) => this.vehiculosExistentes.set(lista));
  }

  protected cargar(): void {
    this.cargando.set(true);

    this.servicio.getAll(this.buscar() || undefined).subscribe({
      next: (lista) => {
        this.clientes.set(lista);
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

  protected invalido(control: string): boolean {
    const campo = this.formulario.get(control);
    // `dirty` además de `touched`: el error se corrige mientras se escribe,
    // sin esperar a que el campo pierda el foco.
    return !!campo && campo.invalid && (campo.touched || campo.dirty);
  }

  /** Mensaje concreto por campo, en vez de un genérico "revise el formulario". */
  protected error(control: string): string {
    const campo = this.formulario.get(control);
    if (!campo || !this.invalido(control)) return '';

    if (campo.hasError('required')) return 'Este campo es obligatorio.';
    if (campo.hasError('email')) return 'El correo no tiene un formato válido.';
    if (campo.hasError('maxlength')) {
      const { requiredLength } = campo.getError('maxlength');
      return `Máximo ${requiredLength} caracteres.`;
    }

    return 'Revise el valor ingresado.';
  }

  /**
   * Se muestran las primeras placas y el resto se resume en un "+N": con
   * varias, la celda crecería más que la fila y rompería el ritmo de la tabla.
   */
  protected placasVisibles(cliente: Cliente): string[] {
    // `?? []` cubre la ventana de un despliegue: el frontend puede quedar
    // arriba antes que la API y recibir todavía respuestas sin `placas`.
    return (cliente.placas ?? []).slice(0, MAX_PLACAS);
  }

  protected placasRestantes(cliente: Cliente): number {
    return Math.max(0, (cliente.placas ?? []).length - MAX_PLACAS);
  }

  /**
   * Enlace directo a un chat de WhatsApp. El teléfono se guarda como texto
   * libre en el sistema: acá solo se limpia para armar la URL — si no trae
   * código de país se asume Bolivia (+591). El dato guardado no se toca.
   */
  protected linkWhatsapp(telefono: string): string {
    const digitos = telefono.replace(/\D/g, '');
    const conCodigo = digitos.startsWith('591') ? digitos : `591${digitos}`;
    return `https://wa.me/${conCodigo}`;
  }

  /** Cuando está activo, tras guardar se limpia el formulario en vez de cerrarlo. */
  private crearOtro = false;

  /** Deja el formulario listo para un alta nueva, sin abrir ni cerrar el modal. */
  private reiniciarFormulario(): void {
    this.editando.set(null);
    this.formulario.reset();
    this.registrarVehiculo.set(false);
    // El año casi siempre es el actual: se ofrece hecho y solo se corrige si no.
    this.formularioVehiculo.reset({ kilometraje: 0, anio: new Date().getFullYear() });
    this.placaActual.set('');
    this.marcaActual.set('');
  }

  protected abrirNuevo(): void {
    this.reiniciarFormulario();
    this.formularioAbierto.set(true);
  }

  /** Marca que, al guardar, el modal siga abierto para cargar otro cliente. */
  protected marcarCrearOtro(): void {
    this.crearOtro = true;
  }

  /** Cierra el modal, o lo reinicia si se pidió "crear otro" (solo en alta). */
  private finalizarExito(mensaje: string): void {
    const seguir = this.crearOtro && !this.editando();
    this.crearOtro = false;
    this.notificacion.exito(mensaje);
    this.guardando.set(false);
    if (seguir) {
      this.reiniciarFormulario();
    } else {
      this.cerrarFormulario();
    }
    this.cargar();
  }

  /** Las placas bolivianas van en mayúsculas: se normaliza al escribir. */
  protected onPlacaInput(valor: string): void {
    const mayus = valor.toUpperCase();
    this.formularioVehiculo.controls.placa.setValue(mayus);
    this.placaActual.set(mayus);
  }

  protected onMarcaInput(valor: string): void {
    this.marcaActual.set(valor);
  }

  /** Color de un clic, sin teclear. */
  protected elegirColor(color: string): void {
    const control = this.formularioVehiculo.controls.color;
    // Volver a tocar el mismo color lo quita: sigue siendo un campo opcional.
    control.setValue(control.value === color ? '' : color);
    control.markAsDirty();
  }

  protected abrirEditar(cliente: Cliente): void {
    this.editando.set(cliente);
    this.registrarVehiculo.set(false);
    this.formulario.patchValue({
      nombre: cliente.nombre,
      apellido: cliente.apellido ?? '',
      razonSocial: cliente.razonSocial ?? '',
      ciNit: cliente.ciNit,
      telefono: cliente.telefono ?? '',
      email: cliente.email ?? '',
      direccion: cliente.direccion ?? '',
    });
    this.formularioAbierto.set(true);
  }

  protected cerrarFormulario(): void {
    this.formularioAbierto.set(false);
    this.editando.set(null);
  }

  /** Ir directo a registrar otro vehículo de este cliente, sin volver a buscarlo. */
  protected agregarVehiculo(cliente: Cliente): void {
    void this.router.navigate(['/vehiculos'], {
      queryParams: { clienteId: cliente.clienteId, nuevo: true },
    });
  }

  protected guardar(): void {
    if (this.formulario.invalid) {
      this.crearOtro = false;
      this.formulario.markAllAsTouched();
      return;
    }

    // Solo se pide completo cuando el checkbox "Registrar vehículo ahora" está
    // marcado: en la edición, o si no se tildó, el vehículo ni se toca.
    const conVehiculo = this.registrarVehiculo() && !this.editando();
    const datosVehiculo = this.formularioVehiculo.getRawValue();

    if (conVehiculo && (!datosVehiculo.placa || !datosVehiculo.marca || !datosVehiculo.modelo)) {
      this.crearOtro = false;
      this.formularioVehiculo.markAllAsTouched();
      this.notificacion.advertencia('Complete placa, marca y modelo del vehículo, o desmarque la opción.');
      return;
    }

    this.guardando.set(true);
    const datos = this.formulario.getRawValue();
    const enEdicion = this.editando();

    const peticion = enEdicion
      ? this.servicio.actualizar(enEdicion.clienteId, datos)
      : this.servicio.crear(datos);

    peticion.subscribe({
      next: (cliente) => {
        if (!conVehiculo) {
          this.finalizarExito(
            enEdicion ? 'Cliente actualizado.' : 'Cliente registrado correctamente.',
          );
          return;
        }

        // Encadenado: el vehículo se crea recién con el ID que acaba de asignar el backend.
        this.vehiculosService.crear({ clienteId: cliente.clienteId, ...datosVehiculo }).subscribe({
          next: () => {
            this.finalizarExito('Cliente y vehículo registrados correctamente.');
          },
          error: () => {
            // El cliente sí quedó creado: avisar para que complete el vehículo aparte.
            this.crearOtro = false;
            this.notificacion.advertencia(
              `Cliente ${cliente.clienteId} registrado, pero el vehículo no se pudo guardar. Agréguelo desde Vehículos.`,
            );
            this.guardando.set(false);
            this.cerrarFormulario();
            this.cargar();
          },
        });
      },
      error: () => {
        this.crearOtro = false;
        this.guardando.set(false);
      },
    });
  }

  protected confirmarCambioEstado(cliente: Cliente): void {
    this.porCambiarEstado.set(cliente);
  }

  protected cambiarEstado(): void {
    const cliente = this.porCambiarEstado();
    if (!cliente) return;

    const nuevo =
      cliente.estado === EstadoCliente.Activo ? EstadoCliente.Inactivo : EstadoCliente.Activo;

    this.guardando.set(true);

    this.servicio.cambiarEstado(cliente.clienteId, nuevo).subscribe({
      next: () => {
        this.notificacion.exito(
          nuevo === EstadoCliente.Activo ? 'Cliente activado.' : 'Cliente desactivado.',
        );
        this.guardando.set(false);
        this.porCambiarEstado.set(null);
        this.cargar();
      },
      error: () => {
        this.guardando.set(false);
        this.porCambiarEstado.set(null);
      },
    });
  }
}
