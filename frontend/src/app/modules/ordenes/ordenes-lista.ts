import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { EstadoOrden } from '../../core/models/enums';
import { Orden } from '../../core/models/taller.model';
import { AuthService } from '../../core/services/auth.service';
import { OrdenesService } from '../../core/services/ordenes.service';
import { PreferenciasService } from '../../core/services/preferencias.service';
import { EstadoTabla } from '../../shared/components/estado-tabla';
import { InsigniaEstado } from '../../shared/components/insignia-estado';
import { BolivianosPipe } from '../../shared/pipes/bolivianos.pipe';

const CLAVE_FILTRO = 'ordenes.estado';

/**
 * USU021 — listado de órdenes de trabajo.
 *
 * No se crean aquí: toda orden nace de un diagnóstico (ver módulo
 * Diagnósticos, botón "Generar orden"), así ninguna queda sin un motivo de
 * ingreso registrado y no se duplica trabajo sobre el mismo vehículo.
 */
@Component({
  selector: 'app-ordenes-lista',
  imports: [RouterLink, DatePipe, EstadoTabla, InsigniaEstado, BolivianosPipe],
  templateUrl: './ordenes-lista.html',
})
export class OrdenesLista {
  private readonly servicio = inject(OrdenesService);
  private readonly preferencias = inject(PreferenciasService);
  private readonly ruta = inject(ActivatedRoute);
  protected readonly auth = inject(AuthService);

  protected readonly ordenes = signal<Orden[]>([]);
  protected readonly cargando = signal(true);
  protected readonly estadoFiltro = signal('');

  constructor() {
    // El acceso directo del panel llega con ?estado=2; si no viene nada, se
    // recupera el último filtro que el usuario dejó puesto.
    const desdeUrl = this.ruta.snapshot.queryParamMap.get('estado');
    this.estadoFiltro.set(desdeUrl ?? this.preferencias.leer(CLAVE_FILTRO, ''));

    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);

    const estado = this.estadoFiltro();

    this.servicio
      .getAll({ estado: estado === '' ? undefined : (Number(estado) as EstadoOrden) })
      .subscribe({
        next: (lista) => {
          this.ordenes.set(lista);
          this.cargando.set(false);
        },
        error: () => this.cargando.set(false),
      });
  }

  protected onFiltrarEstado(valor: string): void {
    this.estadoFiltro.set(valor);
    this.preferencias.guardar(CLAVE_FILTRO, valor);
    this.cargar();
  }
}
