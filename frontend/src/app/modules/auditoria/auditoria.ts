import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AccionAuditoria, ETIQUETAS } from '../../core/models/enums';
import { Auditoria as AuditoriaFila } from '../../core/models/auditoria.model';
import { AuditoriaService } from '../../core/services/auditoria.service';
import { EstadoTabla } from '../../shared/components/estado-tabla';
import { Paginador } from '../../shared/components/paginador';

const ENTIDADES = [
  'Repuesto',
  'Vehiculo',
  'Cliente',
  'Proveedor',
  'Venta',
  'Compra',
  'Orden',
  'Diagnostico',
  'TipoServicio',
  'Comision',
  'ComisionConfig',
  'Proforma',
  'Pago',
  'Usuario',
];

/** Bitácora de auditoría: quién hizo qué, cuándo, sobre qué registro. */
@Component({
  selector: 'app-auditoria',
  imports: [FormsModule, DatePipe, EstadoTabla, Paginador],
  templateUrl: './auditoria.html',
  styleUrl: './auditoria.css',
})
export class Auditoria {
  private readonly servicio = inject(AuditoriaService);

  protected readonly filas = signal<AuditoriaFila[]>([]);
  protected readonly cargando = signal(true);

  protected readonly pagina = signal(1);
  protected readonly tamanoPagina = signal(20);
  protected readonly totalRegistros = signal(0);
  protected readonly totalPaginas = signal(0);

  protected readonly entidades = ENTIDADES;
  protected readonly acciones = Object.entries(ETIQUETAS.accionAuditoria).map(
    ([valor, etiqueta]) => ({ valor: Number(valor) as AccionAuditoria, etiqueta }),
  );

  protected readonly ETIQUETAS = ETIQUETAS;

  protected filtro = {
    entidad: '',
    accion: '' as AccionAuditoria | '',
    desde: '',
    hasta: '',
  };

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);

    this.servicio
      .getAll({
        entidad: this.filtro.entidad || undefined,
        accion: this.filtro.accion === '' ? undefined : this.filtro.accion,
        desde: this.filtro.desde || undefined,
        hasta: this.filtro.hasta || undefined,
        pagina: this.pagina(),
        tamanoPagina: this.tamanoPagina(),
      })
      .subscribe({
        next: (resultado) => {
          this.filas.set(resultado.items);
          this.totalRegistros.set(resultado.totalRegistros);
          this.totalPaginas.set(resultado.totalPaginas);
          this.cargando.set(false);
        },
        error: () => this.cargando.set(false),
      });
  }

  /** Cualquier cambio de filtro vuelve a la primera página. */
  protected filtrar(): void {
    this.pagina.set(1);
    this.cargar();
  }

  protected limpiarFiltros(): void {
    this.filtro = { entidad: '', accion: '', desde: '', hasta: '' };
    this.filtrar();
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

  protected hayFiltro(): boolean {
    return !!(this.filtro.entidad || this.filtro.accion !== '' || this.filtro.desde || this.filtro.hasta);
  }

  /** Iniciales para el avatar del usuario: solo presentación. */
  protected iniciales(nombre: string | null | undefined): string {
    const partes = (nombre ?? '').trim().split(/\s+/).filter(Boolean);
    if (partes.length === 0) return '—';

    return partes.length === 1
      ? partes[0].slice(0, 2).toUpperCase()
      : (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
  }

  /**
   * Color de la insignia según el tipo de acción: verde para altas, azul para
   * cambios, rojo para bajas/anulaciones. Es el mapeo visual de un dato que ya
   * se muestra, no una regla nueva.
   */
  protected claseAccion(accion: AccionAuditoria): string {
    switch (accion) {
      case AccionAuditoria.Crear:
        return 'insignia-verde';
      case AccionAuditoria.Eliminar:
      case AccionAuditoria.Anular:
        return 'insignia-roja';
      case AccionAuditoria.CambiarEstado:
        return 'insignia-naranja';
      default:
        // Editar, Ajustar
        return 'insignia-azul';
    }
  }
}
