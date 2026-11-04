import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { EstadoFacturacion, Factura } from '../../core/models/finanzas.model';
import { descargarArchivo } from '../../core/services/descarga';
import { FacturasService } from '../../core/services/finanzas.service';
import { NotificacionService } from '../../core/services/notificacion.service';
import { EstadoTabla } from '../../shared/components/estado-tabla';
import { Paginador } from '../../shared/components/paginador';
import { BolivianosPipe } from '../../shared/pipes/bolivianos.pipe';

/** Quién tiene que hacer cada paso: el taller, el programador o ya está hecho. */
type TipoPaso = 'tramite' | 'programar' | 'listo';

interface PasoGuia {
  numero: number;
  tipo: TipoPaso;
  titulo: string;
  texto: string;
}

const ETIQUETA_TIPO: Record<TipoPaso, string> = {
  tramite: 'Trámite del taller',
  programar: 'Falta programarlo',
  listo: 'Ya está en el sistema',
};

/**
 * Lo que falta para facturar ante el SIN, en orden. Refleja el estado real
 * del backend: la estructura de la factura y el interruptor existen; la
 * conexión con el SIAT está separada en pasos pero sin programar
 * (EmisorSiatFacturacion), y los códigos del SIN existen en la base sin una
 * pantalla para cargarlos.
 */
const PASOS: PasoGuia[] = [
  {
    numero: 1,
    tipo: 'tramite',
    titulo: 'Confirmar la modalidad con el SIN',
    texto:
      'Ver en la Oficina Virtual del SIN si el taller debe facturar en línea y en qué modalidad: ' +
      'electrónica, con firma digital, o computarizada, sin firma.',
  },
  {
    numero: 2,
    tipo: 'tramite',
    titulo: 'Firma digital',
    texto: 'Solo para la modalidad electrónica: un certificado de una entidad autorizada, por ejemplo ADSIB.',
  },
  {
    numero: 3,
    tipo: 'tramite',
    titulo: 'Credenciales del sistema de facturación',
    texto:
      'El código del sistema y la clave de acceso que el SIN entrega al registrar el sistema, ' +
      'primero en su ambiente de pruebas.',
  },
  {
    numero: 4,
    tipo: 'programar',
    titulo: 'Completar la conexión con el SIAT',
    texto:
      'Pedir el código diario (CUFD), calcular el CUF, firmar la factura y enviarla. Los pasos ya ' +
      'están separados en el sistema; falta programarlos y probarlos en el ambiente de pruebas del ' +
      'SIN hasta que aprueben el sistema.',
  },
  {
    numero: 5,
    tipo: 'programar',
    titulo: 'Códigos del SIN en repuestos y servicios',
    texto:
      'La base de datos ya tiene dónde guardar el código de producto del SIN y la unidad de medida ' +
      'de cada repuesto y servicio. Falta la pantalla para cargarlos.',
  },
  {
    numero: 6,
    tipo: 'listo',
    titulo: 'Encender la facturación',
    texto:
      'Se activa en la configuración del servidor. Si falta algún dato del SIN, el servidor no ' +
      'arranca, para que nadie facture a medias.',
  },
];

const LISTO = [
  'La estructura de la factura: número, CUF, XML y su estado ante el SIN.',
  'Si el SIN no responde, la factura queda en contingencia en vez de perderse.',
  'Dónde guardar el código del SIN de cada repuesto y servicio.',
];

const FALTA = [
  'Los trámites del taller ante el SIN (pasos 1 a 3).',
  'Programar la comunicación con el SIAT y probarla (paso 4).',
  'La pantalla para cargar los códigos del SIN, y cargarlos (paso 5).',
];

/**
 * Facturación electrónica: el comprobante FISCAL ante el SIN, con su CUF y su
 * XML. Distinto del módulo de Proformas, que documenta el cobro del taller.
 *
 * Mientras el taller no tenga la facturación habilitada, la pantalla es una
 * guía de lo que falta y remite a Proformas: es preferible eso a un botón que
 * siempre falla. La tabla aparece cuando se puede emitir o si ya hay facturas.
 */
@Component({
  selector: 'app-facturas',
  imports: [RouterLink, DatePipe, EstadoTabla, Paginador, BolivianosPipe],
  templateUrl: './facturas.html',
  styleUrl: './facturas.css',
})
export class Facturas {
  private readonly servicio = inject(FacturasService);
  private readonly notificacion = inject(NotificacionService);

  protected readonly facturas = signal<Factura[]>([]);
  protected readonly cargando = signal(true);
  protected readonly estadoModulo = signal<EstadoFacturacion | null>(null);

  protected readonly pagina = signal(1);
  protected readonly tamanoPagina = signal(20);
  protected readonly totalRegistros = signal(0);
  protected readonly totalPaginas = signal(0);

  protected readonly PASOS = PASOS;
  protected readonly LISTO = LISTO;
  protected readonly FALTA = FALTA;
  protected readonly ETIQUETA_TIPO = ETIQUETA_TIPO;

  protected readonly habilitada = computed(() => this.estadoModulo()?.emisionHabilitada ?? false);

  constructor() {
    // Lo primero es saber si el módulo puede emitir: define toda la pantalla.
    this.servicio.estado().subscribe({
      next: (estado) => this.estadoModulo.set(estado),
      error: () => this.estadoModulo.set(null),
    });

    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);

    this.servicio
      .getAll({ pagina: this.pagina(), tamanoPagina: this.tamanoPagina() })
      .subscribe({
        next: (resultado) => {
          this.facturas.set(resultado.items);
          this.totalRegistros.set(resultado.totalRegistros);
          this.totalPaginas.set(resultado.totalPaginas);
          this.cargando.set(false);
        },
        error: () => this.cargando.set(false),
      });
  }

  protected cambiarPagina(nueva: number): void {
    this.pagina.set(nueva);
    this.cargar();
  }

  protected cambiarTamano(nuevo: number): void {
    this.tamanoPagina.set(nuevo);
    this.pagina.set(1);
    this.cargar();
  }

  /** Descarga el XML: el respaldo que el contribuyente debe archivar. */
  protected descargarXml(factura: Factura, firmado: boolean): void {
    this.servicio.xml(factura.facturaId, firmado).subscribe({
      next: ({ blob, nombreArchivo }) => descargarArchivo(blob, nombreArchivo),
      error: () =>
        this.notificacion.advertencia(
          `La factura ${factura.facturaId} todavía no tiene XML ${firmado ? 'firmado' : 'generado'}.`,
        ),
    });
  }
}
