import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

import { PlantillaVehiculo, Vehiculo } from '../../core/models/personas.model';
import { urlArchivo } from '../../core/services/api-base';
import { NotificacionService } from '../../core/services/notificacion.service';
import { PlantillasVehiculoService } from '../../core/services/plantillas-vehiculo.service';
import { VehiculosService } from '../../core/services/vehiculos.service';
import { Confirmacion } from '../../shared/components/confirmacion';
import { EstadoTabla } from '../../shared/components/estado-tabla';
import { EnfocarError } from '../../shared/directives/enfocar-error';
import { marcasSugeridas, modelosSugeridos } from '../../shared/vehiculo-sugerencias';

const TAMANIO_MAXIMO_BYTES = 512 * 1024;

/**
 * Biblioteca de diagramas vectoriales por Marca+Modelo: cuando existe una
 * plantilla para el Marca+Modelo exacto de un vehículo, el diagrama de
 * zonas usa ESE SVG (fiel al vehículo real) en vez de la silueta genérica
 * por tipo de carrocería. Mantenimiento exclusivo del Administrador.
 */
@Component({
  selector: 'app-plantillas-vehiculo',
  imports: [ReactiveFormsModule, DatePipe, EstadoTabla, Confirmacion, EnfocarError],
  templateUrl: './plantillas-vehiculo.html',
  styleUrl: './plantillas-vehiculo.css',
})
export class PlantillasVehiculo {
  private readonly servicio = inject(PlantillasVehiculoService);
  private readonly vehiculosService = inject(VehiculosService);
  private readonly notificacion = inject(NotificacionService);
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly sanitizador = inject(DomSanitizer);

  protected readonly urlArchivo = urlArchivo;
  protected readonly plantillas = signal<PlantillaVehiculo[]>([]);

  /**
   * Miniatura por plantilla, con un estilo de zonas embebido en el propio SVG.
   *
   * El SVG subido no trae fill/stroke propios para sus zonas — el diagrama
   * real se los da vía CSS del componente `DiagramaVehiculo`, que solo existe
   * ahí. Mostrado como `<img src="...">` crudo (fuera de ese componente) cada
   * zona cae al valor por defecto de SVG (fill negro, sin borde) y el auto
   * se ve como una silueta sólida. Se arma acá una miniatura aparte con un
   * `<style>` embebido en el propio documento SVG — así se ve bien sin
   * depender del CSS de la app.
   */
  protected readonly vistaPrevia = signal<Record<string, SafeUrl>>({});
  protected readonly vehiculos = signal<Vehiculo[]>([]);
  protected readonly cargando = signal(true);
  protected readonly subiendo = signal(false);
  protected readonly archivoSeleccionado = signal<File | null>(null);
  protected readonly porEliminar = signal<PlantillaVehiculo | null>(null);
  protected readonly eliminando = signal(false);

  /** Espejo reactivo de la marca: acota los modelos sugeridos a esa marca. */
  protected readonly marcaActual = signal('');

  protected readonly formulario = this.fb.nonNullable.group({
    marca: ['', [Validators.required, Validators.maxLength(50)]],
    modelo: ['', [Validators.required, Validators.maxLength(50)]],
  });

  /** Escribir menos = elegir de la lista; mismas sugerencias que en Vehículos. */
  protected readonly marcasSugeridas = computed(() => marcasSugeridas(this.vehiculos()));
  protected readonly modelosSugeridos = computed(() =>
    modelosSugeridos(this.vehiculos(), this.marcaActual()),
  );

  constructor() {
    this.cargar();
    this.vehiculosService
      .getAll(undefined, undefined, 1, 500)
      .subscribe((resultado) => this.vehiculos.set(resultado.items));
  }

  protected onMarcaInput(valor: string): void {
    this.marcaActual.set(valor);
  }

  private cargar(): void {
    this.cargando.set(true);
    this.servicio.getAll().subscribe({
      next: (lista) => {
        this.plantillas.set(lista);
        this.cargando.set(false);
        lista.forEach((p) => this.cargarVistaPrevia(p));
      },
      error: () => this.cargando.set(false),
    });
  }

  private cargarVistaPrevia(plantilla: PlantillaVehiculo): void {
    // La misma URL también se carga como <img> en el diagrama del vehículo
    // (modo no-cors). Si el navegador cachea esa respuesta opaca, esta
    // petición en modo cors la reutiliza y falla como si fuera un error de
    // CORS aunque el servidor responda bien — ver diagrama-vehiculo.ts.
    const urlSinCacheCompartida = `${urlArchivo(plantilla.url)}?v=cors`;

    this.http.get(urlSinCacheCompartida, { responseType: 'text' }).subscribe({
      next: (texto) => {
        const dataUri = construirVistaPreviaSvg(texto);
        if (!dataUri) return;
        this.vistaPrevia.update((mapa) => ({
          ...mapa,
          [plantilla.plantillaId]: this.sanitizador.bypassSecurityTrustUrl(dataUri),
        }));
      },
      // Si no se puede leer el SVG, la fila simplemente queda sin miniatura.
      error: () => {},
    });
  }

  protected invalido(control: string): boolean {
    const campo = this.formulario.get(control);
    return !!campo && campo.invalid && (campo.touched || campo.dirty);
  }

  protected onArchivoSeleccionado(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0] ?? null;

    if (archivo && !archivo.name.toLowerCase().endsWith('.svg')) {
      this.notificacion.advertencia('El archivo debe ser un SVG.');
      input.value = '';
      this.archivoSeleccionado.set(null);
      return;
    }

    if (archivo && archivo.size > TAMANIO_MAXIMO_BYTES) {
      this.notificacion.advertencia('El SVG no puede superar los 512 KB.');
      input.value = '';
      this.archivoSeleccionado.set(null);
      return;
    }

    this.archivoSeleccionado.set(archivo);
  }

  protected subir(): void {
    const archivo = this.archivoSeleccionado();

    if (this.formulario.invalid || !archivo) {
      this.formulario.markAllAsTouched();
      if (!archivo) this.notificacion.advertencia('Seleccione el archivo .svg.');
      return;
    }

    this.subiendo.set(true);
    const { marca, modelo } = this.formulario.getRawValue();

    this.servicio.subir(marca, modelo, archivo).subscribe({
      next: (plantilla) => {
        this.plantillas.update((lista) => [
          plantilla,
          ...lista.filter(
            (p) =>
              p.marca.toLowerCase() !== plantilla.marca.toLowerCase() ||
              p.modelo.toLowerCase() !== plantilla.modelo.toLowerCase(),
          ),
        ]);
        this.subiendo.set(false);
        this.formulario.reset({ marca: '', modelo: '' });
        this.marcaActual.set('');
        this.archivoSeleccionado.set(null);
        this.cargarVistaPrevia(plantilla);
        this.notificacion.exito('Plantilla guardada correctamente.');
      },
      error: () => this.subiendo.set(false),
    });
  }

  protected confirmarEliminar(plantilla: PlantillaVehiculo): void {
    this.porEliminar.set(plantilla);
  }

  protected eliminar(): void {
    const plantilla = this.porEliminar();
    if (!plantilla) return;

    this.eliminando.set(true);
    this.servicio.eliminar(plantilla.plantillaId).subscribe({
      next: () => {
        this.plantillas.update((lista) =>
          lista.filter((p) => p.plantillaId !== plantilla.plantillaId),
        );
        this.eliminando.set(false);
        this.porEliminar.set(null);
        this.notificacion.exito('Plantilla eliminada.');
      },
      error: () => this.eliminando.set(false),
    });
  }
}

/**
 * Colores por defecto de `.zona`, calcados de `diagrama-vehiculo.css` (estado
 * "sin marcar"): así la miniatura se ve consistente con el diagrama real.
 */
const ESTILO_VISTA_PREVIA =
  '.zona{fill:#f1f2f4;stroke:#9aa1ab;stroke-width:1.5}';

/**
 * Inserta un `<style>` dentro del SVG (sirviendo de reemplazo del CSS del
 * componente, que no llega hasta acá) y lo devuelve como Data URI listo para
 * un `<img src>`. `<img>` renderiza SVG en un documento aislado: ni ejecuta
 * `<script>` ni deja que ese `<style>` se filtre a la página — es más
 * restrictivo, no menos, que insertar el SVG como nodos del DOM.
 */
function construirVistaPreviaSvg(svgTexto: string): string | null {
  const doc = new DOMParser().parseFromString(svgTexto, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg || doc.querySelector('parsererror')) return null;

  const estilo = doc.createElementNS('http://www.w3.org/2000/svg', 'style');
  estilo.textContent = ESTILO_VISTA_PREVIA;
  svg.insertBefore(estilo, svg.firstChild);

  const serializado = new XMLSerializer().serializeToString(svg);
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(serializado)))}`;
}
