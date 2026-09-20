import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { EstadoOrden, EstadoPago } from '../models/enums';
import { Orden } from '../models/taller.model';
import { AuthService } from './auth.service';
import { ComisionesService } from './finanzas.service';
import { RepuestosService } from './inventario.service';
import { OrdenesService } from './ordenes.service';

/**
 * Conteos de trabajo pendiente que la barra lateral muestra como insignia.
 *
 * Sin esto hay que entrar módulo por módulo para saber si queda algo por
 * hacer. Se recalcula bajo demanda: cada pantalla que cambia uno de estos
 * números llama a `refrescar()` después de guardar.
 */
@Injectable({ providedIn: 'root' })
export class ContadoresService {
  private readonly ordenesService = inject(OrdenesService);
  private readonly comisionesService = inject(ComisionesService);
  private readonly repuestosService = inject(RepuestosService);
  private readonly auth = inject(AuthService);

  private readonly ordenes = signal<Orden[]>([]);

  /** Órdenes que siguen en el taller: abiertas o con trabajo en curso. */
  readonly ordenesActivas = computed(
    () =>
      this.ordenes().filter(
        (o) => o.estado === EstadoOrden.Abierta || o.estado === EstadoOrden.EnProceso,
      ).length,
  );

  /** Finalizadas sin cerrar: el administrador todavía debe cerrarlas y facturar. */
  readonly ordenesPorCerrar = computed(
    () => this.ordenes().filter((o) => o.estado === EstadoOrden.Finalizada).length,
  );

  readonly comisionesPendientes = signal(0);
  readonly stockBajo = signal(0);

  refrescar(): void {
    // El mecánico no tiene acceso a comisiones: la llamada devolvería 403 y no
    // debe tumbar el resto de los contadores, por eso cada rama va protegida.
    forkJoin({
      ordenes: this.ordenesService.getAll().pipe(catchError(() => of([] as Orden[]))),
      // Solo interesa el total, no los registros: tamanoPagina=1 pide el
      // mínimo posible y `totalRegistros` ya trae la cuenta real.
      comisionesPendientes: this.auth.esAdministrador()
        ? this.comisionesService
            .getAll({ estadoPago: EstadoPago.Pendiente, tamanoPagina: 1 })
            .pipe(map((r) => r.totalRegistros), catchError(() => of(0)))
        : of(0),
      stockBajo: this.repuestosService
        .getAll({ soloStockBajo: true, tamanoPagina: 1 })
        .pipe(map((r) => r.totalRegistros), catchError(() => of(0))),
    }).subscribe(({ ordenes, comisionesPendientes, stockBajo }) => {
      this.ordenes.set(ordenes);
      this.comisionesPendientes.set(comisionesPendientes);
      this.stockBajo.set(stockBajo);
    });
  }
}
