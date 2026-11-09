import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { NivelCompatibilidad, RespuestaCliente } from '../../core/models/enums';
import { RepuestoParaVehiculo } from '../../core/models/inventario.model';
import {
  EventoHistorial,
  HistorialVehiculo,
  Vehiculo,
  VehiculoFoto,
  VehiculoZona,
} from '../../core/models/personas.model';
import { Diagnostico, Orden } from '../../core/models/taller.model';
import { urlArchivo } from '../../core/services/api-base';
import { AuthService } from '../../core/services/auth.service';
import { RepuestosService } from '../../core/services/inventario.service';
import { NotificacionService } from '../../core/services/notificacion.service';
import { OrdenesService } from '../../core/services/ordenes.service';
import { DiagnosticosService } from '../../core/services/taller.service';
import { VehiculosService } from '../../core/services/vehiculos.service';
import { Confirmacion } from '../../shared/components/confirmacion';
import { ElegirFoto } from '../../shared/components/elegir-foto';
import { Esqueleto } from '../../shared/components/esqueleto';
import { InspeccionVehiculo } from '../../shared/components/inspeccion-vehiculo';
import { Placa } from '../../shared/components/placa';
import { VisorFotos, aFotoVisor } from '../../shared/components/visor-fotos';
import { BolivianosPipe } from '../../shared/pipes/bolivianos.pipe';

type Pestania = 'historial' | 'fotos' | 'datos';

/** Fotos subidas el mismo día, juntas. */
interface GrupoFotos {
  dia: string;
  fotos: VehiculoFoto[];
}

/** Un punto de la línea de tiempo, ya redactado para mostrar. */
interface ItemLinea {
  clave: string;
  tipo: 'Diagnostico' | 'Orden';
  id: string;
  titulo: string;
  detalle: string;
  fecha: string;
  /** Verde lo terminado, ámbar lo que sigue abierto, rojo lo que no se hizo. */
  tono: 'verde' | 'naranja' | 'roja' | 'gris';
}

/**
 * Ficha de un vehículo: lo que se le hizo, los repuestos que le sirven y su
 * estado (fotos y zonas marcadas en el dibujo), en una sola página con
 * pestañas. Reúne lo que antes estaba en tres ventanas sueltas de la lista.
 */
@Component({
  selector: 'app-vehiculo-ficha',
  imports: [
    RouterLink,
    DatePipe,
    DecimalPipe,
    Confirmacion,
    InspeccionVehiculo,
    ElegirFoto,
    Esqueleto,
    Placa,
    VisorFotos,
    BolivianosPipe,
  ],
  templateUrl: './vehiculo-ficha.html',
  styleUrl: './vehiculo-ficha.css',
})
export class VehiculoFicha {
  private readonly servicio = inject(VehiculosService);
  private readonly repuestosService = inject(RepuestosService);
  private readonly diagnosticosService = inject(DiagnosticosService);
  private readonly ordenesService = inject(OrdenesService);
  private readonly bs = new BolivianosPipe();
  private readonly notificacion = inject(NotificacionService);
  protected readonly auth = inject(AuthService);

  protected readonly urlArchivo = urlArchivo;
  protected readonly NivelCompatibilidad = NivelCompatibilidad;

  private readonly id: string;

  protected readonly vehiculo = signal<Vehiculo | null>(null);
  protected readonly noEncontrado = signal(false);
  protected readonly historial = signal<HistorialVehiculo | null>(null);
  protected readonly fotos = signal<VehiculoFoto[]>([]);
  protected readonly zonas = signal<VehiculoZona[]>([]);
  protected readonly repuestos = signal<RepuestoParaVehiculo[]>([]);
  /** Solo para redactar la línea de tiempo: respuesta del cliente, montos, falla. */
  private readonly diagnosticos = signal<Diagnostico[]>([]);
  private readonly ordenes = signal<Orden[]>([]);

  protected readonly pestania = signal<Pestania>('historial');

  protected readonly subiendoFoto = signal(false);
  protected readonly eliminandoFoto = signal<string | null>(null);

  // --- Inspección (zonas) ------------------------------------------------------------

  /** Los eventos del historial, del más nuevo al más viejo, con su título y su monto. */
  /** Como el historial de la orden: lo último a la vista y el resto a pedido. */
  protected readonly verTodaLaHistoria = signal(false);
  protected readonly lineaVisible = computed(() =>
    this.verTodaLaHistoria() ? this.lineaTiempo() : this.lineaTiempo().slice(0, 4),
  );

  protected readonly lineaTiempo = computed<ItemLinea[]>(() => {
    const diagnosticos = new Map(this.diagnosticos().map((d) => [d.diagnosticoId, d]));
    const ordenes = new Map(this.ordenes().map((o) => [o.ordenId, o]));

    return [...(this.historial()?.eventos ?? [])]
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .map((e) =>
        e.tipo === 'Orden'
          ? this.itemOrden(e, ordenes.get(e.id))
          : this.itemDiagnostico(e, diagnosticos.get(e.id)),
      );
  });

  /** Compatibles primero, después los de uso general; los no indicados no se ofrecen. */
  protected readonly repuestosVehiculo = computed(() =>
    this.repuestos()
      .filter((r) => r.nivel !== NivelCompatibilidad.NoIndicado)
      .sort((a, b) => a.nivel - b.nivel || a.repuesto.nombre.localeCompare(b.repuesto.nombre)),
  );

  /**
   * Los que están marcados para este modelo. Los de uso general sirven para
   * cualquier vehículo: con cientos de repuestos taparían a los que importan,
   * así que solo se cuentan.
   */
  protected readonly compatiblesVehiculo = computed(() =>
    this.repuestosVehiculo().filter((r) => r.nivel === NivelCompatibilidad.Compatible),
  );
  protected readonly cantidadUsoGeneral = computed(
    () => this.repuestosVehiculo().length - this.compatiblesVehiculo().length,
  );

  /** Compatibles por categoría: "Pastillas de freno · 3", para buscar con orden. */
  protected readonly categoriasCompatibles = computed(() => {
    const cuenta = new Map<string, { id: string | null; nombre: string; cuenta: number }>();
    for (const { repuesto } of this.compatiblesVehiculo()) {
      const clave = repuesto.categoriaId ?? '';
      const actual = cuenta.get(clave);
      if (actual) actual.cuenta++;
      else cuenta.set(clave, { id: repuesto.categoriaId ?? null, nombre: repuesto.nombreCategoria || 'Sin categoría', cuenta: 1 });
    }
    return [...cuenta.values()].sort((a, b) => b.cuenta - a.cuenta);
  });

  protected readonly gruposFotos = computed<GrupoFotos[]>(() => {
    const grupos = new Map<string, VehiculoFoto[]>();
    for (const foto of [...this.fotos()].sort((a, b) => b.fechaSubida.localeCompare(a.fechaSubida))) {
      const dia = foto.fechaSubida.slice(0, 10);
      grupos.set(dia, [...(grupos.get(dia) ?? []), foto]);
    }
    return [...grupos.entries()].map(([dia, fotos]) => ({ dia, fotos }));
  });

  /** Todas las fotos en el orden en que se ven en pantalla, para pasar de una a otra en el visor. */
  private readonly fotosEnOrden = computed(() => this.gruposFotos().flatMap((g) => g.fotos));
  protected readonly fotosVisor = computed(() => this.fotosEnOrden().map(aFotoVisor));
  /** Posición de la foto con que se abrió el visor; null = cerrado. */
  protected readonly visorInicio = signal<number | null>(null);

  protected abrirVisor(foto: VehiculoFoto): void {
    const posicion = this.fotosEnOrden().findIndex((f) => f.fotoId === foto.fotoId);
    this.visorInicio.set(posicion >= 0 ? posicion : 0);
  }

  constructor() {
    const ruta = inject(ActivatedRoute);
    this.id = ruta.snapshot.paramMap.get('id') ?? '';

    // "Ver fotos y estado" desde Clientes abre directo esa pestaña.
    const pestania = ruta.snapshot.queryParamMap.get('pestania');
    if (pestania === 'fotos' || pestania === 'datos') this.pestania.set(pestania);

    this.servicio.getById(this.id).subscribe({
      next: (vehiculo) => this.vehiculo.set(vehiculo),
      error: () => this.noEncontrado.set(true),
    });
    this.servicio
      .historial(this.id)
      .pipe(catchError(() => of(null)))
      .subscribe((h) => this.historial.set(h));
    this.servicio
      .getFotos(this.id)
      .pipe(catchError(() => of([] as VehiculoFoto[])))
      .subscribe((lista) => this.fotos.set(lista));
    this.servicio
      .getZonas(this.id)
      .pipe(catchError(() => of([] as VehiculoZona[])))
      .subscribe((lista) => this.zonas.set(lista));
    this.repuestosService
      .paraVehiculo(this.id)
      .pipe(catchError(() => of([] as RepuestoParaVehiculo[])))
      .subscribe((lista) => this.repuestos.set(lista));

    // Si alguna de estas falla, la línea de tiempo igual se arma con lo básico.
    this.diagnosticosService
      .getAll({ vehiculoId: this.id, tamanoPagina: 200 })
      .pipe(catchError(() => of(null)))
      .subscribe((pagina) => this.diagnosticos.set(pagina?.items ?? []));
    this.ordenesService
      .getAll({ vehiculoId: this.id })
      .pipe(catchError(() => of([] as Orden[])))
      .subscribe((lista) => this.ordenes.set(lista));
  }

  // --- Línea de tiempo ------------------------------------------------------------

  private itemDiagnostico(e: EventoHistorial, d: Diagnostico | undefined): ItemLinea {
    const base = { clave: 'D' + e.id, tipo: e.tipo, id: e.id, fecha: e.fecha };
    const monto = d?.montoEstimado ? ` · ${this.bs.transform(d.montoEstimado)}` : '';
    const detalle = e.detalle + monto;

    if (e.estado === 'Anulado') return { ...base, titulo: 'Diagnóstico anulado', detalle, tono: 'roja' };
    if (!d) return { ...base, titulo: 'Diagnóstico', detalle, tono: 'gris' };
    if (d.ordenId || d.respuestaCliente === RespuestaCliente.Aprobado) {
      return { ...base, titulo: 'Presupuesto aprobado', detalle, tono: 'verde' };
    }
    if (d.respuestaCliente === RespuestaCliente.Rechazado) {
      return { ...base, titulo: 'Presupuesto rechazado', detalle, tono: 'roja' };
    }
    return { ...base, titulo: 'Presupuesto esperando respuesta', detalle, tono: 'naranja' };
  }

  private itemOrden(e: EventoHistorial, o: Orden | undefined): ItemLinea {
    const base = { clave: 'O' + e.id, tipo: e.tipo, id: e.id, fecha: e.fecha };
    const total = o ? this.bs.transform(o.total) : e.detalle;
    const falla = o?.descripcionFalla?.trim();

    switch (e.estado) {
      case 'Cancelada':
        return {
          ...base,
          titulo: 'Orden cancelada',
          detalle: falla ? `${falla} · no se hizo el trabajo` : 'No se hizo el trabajo',
          tono: 'roja',
        };
      case 'Cerrada':
        return { ...base, titulo: falla || 'Orden cerrada', detalle: `Cerrada · ${total}`, tono: 'verde' };
      case 'Finalizada':
        return {
          ...base,
          titulo: falla || 'Orden finalizada',
          detalle: `Lista para entregar · ${total}`,
          tono: 'verde',
        };
      case 'EnProceso':
        return { ...base, titulo: falla || 'Orden en proceso', detalle: `En proceso · ${total}`, tono: 'naranja' };
      default:
        return { ...base, titulo: falla || 'Orden en espera', detalle: `En espera · ${total}`, tono: 'naranja' };
    }
  }

  // --- Fotos -------------------------------------------------------------------------

  /** La foto llega ya validada y achicada por app-elegir-foto. */
  protected onArchivoSeleccionado(archivo: File): void {
    this.subiendoFoto.set(true);

    this.servicio.subirFoto(this.id, archivo).subscribe({
      next: (foto) => {
        this.fotos.update((lista) => [foto, ...lista]);
        this.subiendoFoto.set(false);
        this.notificacion.exito('Foto agregada.');
      },
      error: () => this.subiendoFoto.set(false),
    });
  }

  /** Foto cuya eliminación espera confirmación; null = ninguna. */
  protected readonly fotoPorEliminar = signal<VehiculoFoto | null>(null);

  /** Qué foto es, para que se vea bien cuál se va a borrar. */
  protected textoFotoPorEliminar(foto: VehiculoFoto): string {
    const fecha = aFotoVisor(foto).fecha;
    return foto.servicio
      ? `Foto del ${fecha}, evidencia del trabajo «${foto.servicio}».`
      : `Foto del vehículo del ${fecha}.`;
  }

  protected eliminarFoto(foto: VehiculoFoto): void {
    this.eliminandoFoto.set(foto.fotoId);

    this.servicio.eliminarFoto(foto.vehiculoId, foto.fotoId).subscribe({
      next: () => {
        this.fotos.update((lista) => lista.filter((f) => f.fotoId !== foto.fotoId));
        this.eliminandoFoto.set(null);
        this.fotoPorEliminar.set(null);
        this.notificacion.exito('Foto eliminada.');
      },
      error: () => {
        this.eliminandoFoto.set(null);
        this.fotoPorEliminar.set(null);
      },
    });
  }
}
