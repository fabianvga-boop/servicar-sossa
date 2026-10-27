import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { CategoriaRepuesto } from '../../core/models/inventario.model';
import { CategoriasRepuestoService } from '../../core/services/inventario.service';
import { NotificacionService } from '../../core/services/notificacion.service';
import { Confirmacion } from './confirmacion';
import { Modal } from './modal';

/**
 * Lista editable de categorías de repuesto (solo Administrador): agregar,
 * renombrar y borrar. Borrar una en uso se permite, avisando antes cuántos
 * repuestos quedan sin categoría y cuántos servicios dejan de controlarla.
 *
 *   <app-gestion-categorias [categorias]="categorias()" (cambio)="recargar()" (cerrar)="…" />
 */
@Component({
  selector: 'app-gestion-categorias',
  imports: [FormsModule, Modal, Confirmacion],
  template: `
    <app-modal titulo="Categorías de repuesto" [ancho]="560" (cerrar)="cerrar.emit()">
      <p class="texto-tenue texto-sm mt-0">
        Cada repuesto pertenece a una categoría, y cada servicio del catálogo indica qué
        categorías lleva. Así, en la orden, a <strong>Cambio de bujías</strong> no se le registra un aceite.
      </p>

      <form class="fila nueva" (ngSubmit)="agregar()">
        <input
          name="nuevaCategoria"
          maxlength="60"
          autocomplete="off"
          placeholder="Nueva categoría, ej. Pastillas de freno traseras"
          [(ngModel)]="nueva"
        />
        <button type="submit" class="btn btn-primario" [disabled]="procesando() || !nueva.trim()">
          Agregar
        </button>
      </form>

      <ul class="lista">
        @for (categoria of categorias(); track categoria.categoriaId) {
          <li>
            @if (editando() === categoria.categoriaId) {
              <form class="fila crece" (ngSubmit)="renombrar(categoria)">
                <input
                  name="renombre"
                  maxlength="60"
                  autocomplete="off"
                  [attr.aria-label]="'Nuevo nombre de ' + categoria.nombre"
                  [(ngModel)]="renombre"
                />
                <button type="submit" class="btn btn-primario btn-sm" [disabled]="procesando()">
                  Guardar
                </button>
                <button type="button" class="btn-enlace" (click)="editando.set(null)">Cancelar</button>
              </form>
            } @else {
              <div class="crece">
                <div class="texto-fuerte">{{ categoria.nombre }}</div>
                <div class="texto-tenue texto-sm">
                  {{ categoria.cantidadRepuestos }} repuesto(s) · {{ categoria.cantidadServicios }} servicio(s)
                </div>
              </div>
              <button
                type="button"
                class="btn-icono"
                title="Renombrar"
                [attr.aria-label]="'Renombrar ' + categoria.nombre"
                (click)="empezarEdicion(categoria)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                </svg>
              </button>
              <button
                type="button"
                class="btn-icono btn-icono-peligro"
                title="Eliminar"
                [attr.aria-label]="'Eliminar ' + categoria.nombre"
                (click)="porEliminar.set(categoria)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" />
                </svg>
              </button>
            }
          </li>
        } @empty {
          <li class="texto-tenue">Todavía no hay categorías.</li>
        }
      </ul>

      <div pie>
        <button type="button" class="btn btn-secundario" (click)="cerrar.emit()">Cerrar</button>
      </div>
    </app-modal>

    @if (porEliminar(); as categoria) {
      <app-confirmacion
        titulo="Eliminar categoría"
        [mensaje]="'¿Eliminar la categoría ' + categoria.nombre + '?'"
        [advertencia]="consecuencias(categoria)"
        textoConfirmar="Eliminar"
        [peligroso]="true"
        [procesando]="procesando()"
        (confirmar)="eliminar(categoria)"
        (cancelar)="porEliminar.set(null)"
      />
    }
  `,
  styles: `
    .nueva { gap: 8px; margin-bottom: 12px; }
    .nueva input { flex: 1; }

    .lista {
      list-style: none;
      margin: 0;
      padding: 0;
      max-height: 52vh;
      overflow-y: auto;
      border: 1px solid var(--gris-200);
      border-radius: var(--radio-sm);
    }

    .lista li {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 9px 12px;
      border-bottom: 1px solid var(--gris-100);
    }

    .lista li:last-child { border-bottom: 0; }

    .lista form { gap: 6px; }
    .lista form input { flex: 1; }
  `,
})
export class GestionCategorias {
  readonly categorias = input.required<CategoriaRepuesto[]>();
  /** Algo cambió: quien la abrió vuelve a pedir la lista (y sus repuestos). */
  readonly cambio = output<void>();
  readonly cerrar = output<void>();

  private readonly servicio = inject(CategoriasRepuestoService);
  private readonly notificacion = inject(NotificacionService);

  protected readonly procesando = signal(false);
  protected readonly editando = signal<string | null>(null);
  protected readonly porEliminar = signal<CategoriaRepuesto | null>(null);
  protected nueva = '';
  protected renombre = '';

  protected agregar(): void {
    const nombre = this.nueva.trim();
    if (!nombre) return;

    this.procesando.set(true);
    this.servicio.crear(nombre).subscribe({
      next: () => {
        this.notificacion.exito(`Categoría “${nombre}” agregada.`);
        this.nueva = '';
        this.terminar();
      },
      error: () => this.procesando.set(false),
    });
  }

  protected empezarEdicion(categoria: CategoriaRepuesto): void {
    this.renombre = categoria.nombre;
    this.editando.set(categoria.categoriaId);
  }

  protected renombrar(categoria: CategoriaRepuesto): void {
    const nombre = this.renombre.trim();
    if (!nombre || nombre === categoria.nombre) {
      this.editando.set(null);
      return;
    }

    this.procesando.set(true);
    this.servicio.actualizar(categoria.categoriaId, nombre).subscribe({
      next: () => {
        this.notificacion.exito('Categoría renombrada.');
        this.editando.set(null);
        this.terminar();
      },
      error: () => this.procesando.set(false),
    });
  }

  protected consecuencias(categoria: CategoriaRepuesto): string | null {
    const partes: string[] = [];
    if (categoria.cantidadRepuestos > 0)
      partes.push(`${categoria.cantidadRepuestos} repuesto(s) quedarán sin categoría`);
    if (categoria.cantidadServicios > 0)
      partes.push(`${categoria.cantidadServicios} servicio(s) dejarán de controlarla en las órdenes`);
    return partes.length ? partes.join(' y ') + '.' : null;
  }

  protected eliminar(categoria: CategoriaRepuesto): void {
    this.procesando.set(true);
    this.servicio.eliminar(categoria.categoriaId).subscribe({
      next: () => {
        this.notificacion.exito(`Categoría “${categoria.nombre}” eliminada.`);
        this.porEliminar.set(null);
        this.terminar();
      },
      error: () => {
        this.procesando.set(false);
        this.porEliminar.set(null);
      },
    });
  }

  private terminar(): void {
    this.procesando.set(false);
    this.cambio.emit();
  }
}
