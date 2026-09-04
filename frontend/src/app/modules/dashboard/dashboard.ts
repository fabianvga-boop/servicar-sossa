import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { EstadoOrden, EstadoPago } from '../../core/models/enums';
import { Comision } from '../../core/models/finanzas.model';
import { Repuesto } from '../../core/models/inventario.model';
import { Orden } from '../../core/models/taller.model';
import { AuthService } from '../../core/services/auth.service';
import { urlArchivo } from '../../core/services/api-base';
import { ComisionesService } from '../../core/services/finanzas.service';
import { RepuestosService } from '../../core/services/inventario.service';
import { OrdenesService } from '../../core/services/ordenes.service';
import { Esqueleto } from '../../shared/components/esqueleto';
import { IconoMenu } from '../../shared/components/icono-menu';
import { InsigniaEstado } from '../../shared/components/insignia-estado';
import { BolivianosPipe } from '../../shared/pipes/bolivianos.pipe';

/** Tarjeta de acceso directo al trabajo que espera al usuario. */
interface AccesoDirecto {
  etiqueta: string;
  descripcion: string;
  icono: string;
  cantidad: number;
  ruta: string;
  parametros?: Record<string, string>;
  /** Se pinta en rojo cuando exige atención inmediata. */
  urgente?: boolean;
  /** Dato adicional de una línea, p. ej. el monto de las comisiones. */
  detalle?: string;
}

const DIAS_TENDENCIA = 7;

/**
 * Panel de inicio. Muestra el trabajo en curso y las alertas que exigen
 * acción: órdenes activas, comisiones por liquidar y repuestos por reponer.
 *
 * Los accesos directos cambian según el rol: el administrador ve lo que debe
 * cerrar y pagar, el mecánico ve solo las órdenes en las que trabaja.
 */
@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, Esqueleto, IconoMenu, InsigniaEstado, BolivianosPipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  private readonly ordenesService = inject(OrdenesService);
  private readonly repuestosService = inject(RepuestosService);
  private readonly comisionesService = inject(ComisionesService);
  protected readonly auth = inject(AuthService);

  protected readonly cargando = signal(true);
  protected readonly ordenes = signal<Orden[]>([]);
  protected readonly stockBajo = signal<Repuesto[]>([]);
  protected readonly comisionesPendientes = signal<Comision[]>([]);

  protected readonly abiertas = computed(
    () => this.ordenes().filter((o) => o.estado === EstadoOrden.Abierta).length,
  );

  protected readonly enProceso = computed(
    () => this.ordenes().filter((o) => o.estado === EstadoOrden.EnProceso).length,
  );

  protected readonly finalizadas = computed(
    () => this.ordenes().filter((o) => o.estado === EstadoOrden.Finalizada).length,
  );

  /** Lo pendiente de facturar: órdenes terminadas pero aún no cerradas. */
  protected readonly montoEnCurso = computed(() =>
    this.ordenes()
      .filter((o) => o.estado !== EstadoOrden.Cancelada && o.estado !== EstadoOrden.Cerrada)
      .reduce((suma, o) => suma + o.total, 0),
  );

  protected readonly totalComisionesPendientes = computed(() =>
    this.comisionesPendientes().reduce((suma, c) => suma + c.monto, 0),
  );

  /** Las más recientes primero; el backend ya las devuelve ordenadas. */
  protected readonly recientes = computed(() => this.ordenes().slice(0, 8));

  protected readonly urlArchivo = urlArchivo;

  /**
   * Órdenes abiertas en los últimos 7 días: el único dato de tendencia que se
   * puede calcular de forma honesta con lo que ya llega del backend (no hay
   * histórico de conteos guardado, así que no se inventa un "% vs. semana
   * pasada" para el resto de los indicadores).
   */
  protected readonly nuevasEstaSemana = computed(() => {
    const limite = Date.now() - DIAS_TENDENCIA * 24 * 60 * 60 * 1000;
    return this.ordenes().filter((o) => new Date(o.fechaCreacion).getTime() >= limite).length;
  });

  /**
   * Atajos al trabajo que realmente espera. Solo se listan los que tienen algo
   * pendiente: una tarjeta en cero es ruido, no información.
   */
  protected readonly accesos = computed<AccesoDirecto[]>(() => {
    const lista: AccesoDirecto[] = [];

    if (this.auth.esAdministrador()) {
      lista.push(
        {
          etiqueta: 'Órdenes por cerrar',
          descripcion: 'Trabajo terminado, falta cerrar y facturar',
          icono: '🗂',
          cantidad: this.finalizadas(),
          ruta: '/ordenes',
          parametros: { estado: String(EstadoOrden.Finalizada) },
        },
        {
          etiqueta: 'Comisiones por liquidar',
          descripcion: 'Pendientes de pago a los mecánicos',
          icono: '%',
          cantidad: this.comisionesPendientes().length,
          detalle: this.totalComisionesPendientes() > 0
            ? `Bs ${this.totalComisionesPendientes().toFixed(2)}`
            : undefined,
          ruta: '/comisiones',
        },
        {
          etiqueta: 'Stock crítico',
          descripcion: 'Repuestos en el mínimo o por debajo',
          icono: '📦',
          cantidad: this.stockBajo().length,
          ruta: '/repuestos',
          parametros: { stockBajo: 'true' },
          urgente: true,
        },
      );
    } else {
      lista.push({
        etiqueta: 'Mis órdenes en curso',
        descripcion: 'Órdenes con trabajo asignado a usted',
        icono: '🔧',
        cantidad: this.abiertas() + this.enProceso(),
        ruta: '/ordenes',
      });
    }

    return lista.filter((acceso) => acceso.cantidad > 0);
  });

  constructor() {
    this.cargar();
  }

  private cargar(): void {
    const esAdmin = this.auth.esAdministrador();

    // El mecánico solo ve sus propias órdenes y no tiene acceso a comisiones;
    // cada rama va protegida para que un 403 parcial no vacíe el panel entero.
    forkJoin({
      ordenes: this.ordenesService
        .getAll(esAdmin ? {} : { mecanicoId: this.auth.sesion()?.usuarioId })
        .pipe(catchError(() => of([] as Orden[]))),
      stockBajo: this.repuestosService
        .getAll({ soloStockBajo: true })
        .pipe(catchError(() => of([] as Repuesto[]))),
      comisiones: esAdmin
        ? this.comisionesService
            .getAll({ estadoPago: EstadoPago.Pendiente })
            .pipe(catchError(() => of([] as Comision[])))
        : of([] as Comision[]),
    }).subscribe(({ ordenes, stockBajo, comisiones }) => {
      this.ordenes.set(ordenes);
      this.stockBajo.set(stockBajo);
      this.comisionesPendientes.set(comisiones);
      this.cargando.set(false);
    });
  }
}
