import { DatePipe } from '@angular/common';
import { Component, computed, ElementRef, inject, input, OnInit, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, concatMap, forkJoin, from, map, of, toArray } from 'rxjs';

import { EstadoOrden, EstadoPago, ETIQUETAS, MetodoPago, OrigenRepuesto } from '../../core/models/enums';
import { Comision, Pago, Proforma } from '../../core/models/finanzas.model';
import { OrdenDetalle } from '../../core/models/taller.model';
import { ComisionesService, PagosService } from '../../core/services/finanzas.service';
import { NotificacionService } from '../../core/services/notificacion.service';
import { Modal } from '../../shared/components/modal';
import { BolivianosPipe } from '../../shared/pipes/bolivianos.pipe';

/**
 * Corregir una orden finalizada o cerrada: la vuelve a En proceso.
 *
 * Antes de pedir el motivo revisa lo que lo impide (pagos de la proforma o
 * comisiones ya pagadas) y, si no hay nada, muestra lo que le pasa a esta
 * orden en concreto: repuestos que vuelven, comisiones que se quitan y la
 * proforma que se anula. Los pagos se revierten desde aquí mismo, sin ir a
 * Pagos: se confirma una vez y la ventana sigue con la corrección.
 */
@Component({
  selector: 'app-corregir-orden',
  imports: [DatePipe, FormsModule, Modal, BolivianosPipe],
  template: `
    @let o = orden();
    <app-modal
      [titulo]="'Corregir orden ' + o.ordenId"
      [ancho]="600"
      [icono]="bloqueo() ? 'candado' : 'herramienta'"
      (cerrar)="cerrar.emit()"
    >
      <span subtitulo class="subtitulo">{{ subtitulo() }}</span>

      @if (cargando()) {
        <div class="cargando" aria-live="polite">
          <span class="esqueleto"></span>
          <span class="esqueleto corto"></span>
        </div>
      } @else if (bloqueo() === 'pagos') {
        <div class="bloqueo">
          <strong>Primero se revierten los pagos</strong>
          <p>
            La proforma {{ proforma()?.proformaId }} ya cobró {{ totalPagado() | bs }}. Al revertirlos,
            la orden se puede corregir. Después se vuelven a registrar en la nueva proforma.
          </p>
          <div class="lista">
            @for (p of pagos(); track p.pagoId) {
              <div class="fila">
                <span class="ico-fila gris" aria-hidden="true">
                  @if (p.metodoPago === MetodoPago.Efectivo) {
                    <svg viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></svg>
                  } @else {
                    <svg viewBox="0 0 24 24"><path d="M3 10h18L12 4zM5 10v8M9.7 10v8M14.3 10v8M19 10v8M3 20h18" /></svg>
                  }
                </span>
                <span class="textos">
                  <b>{{ p.pagoId }} · {{ ETIQUETAS.metodoPago[p.metodoPago] }}</b>
                  <small>
                    {{ p.fechaPago | date: 'dd/MM/yyyy HH:mm' }}
                    @if (p.referencia) { · Ref. {{ p.referencia }} }
                  </small>
                </span>
                <span class="monto">{{ p.monto | bs }}</span>
              </div>
            }
            <div class="fila-total"><span>Cobrado</span><span class="monto">{{ totalPagado() | bs }}</span></div>
          </div>
          @if (confirmandoReversion()) {
            <p class="confirmar-reversion" role="alert">
              ¿Revertir {{ pagos().length === 1 ? 'el pago' : 'los ' + pagos().length + ' pagos' }}
              por {{ totalPagado() | bs }}? Se registra en Auditoría.
            </p>
          }
        </div>
      } @else if (bloqueo() === 'comisiones') {
        <div class="bloqueo">
          <strong>Ya se le pagó la comisión al mecánico</strong>
          <p>
            Una comisión pagada no se revierte, así que esta orden ya no se puede corregir. Si hubo un
            error, ajústelo en la próxima liquidación.
          </p>
          <div class="lista">
            @for (c of comisionesPagadas(); track c.comisionId) {
              <div class="fila">
                <span class="ico-fila azul" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
                </span>
                <span class="textos">
                  <b>{{ c.nombreMecanico }}</b>
                  <small>{{ c.comisionId }} · pagada el {{ c.fechaPago | date: 'dd/MM/yyyy' }}</small>
                </span>
                <span class="monto">{{ c.monto | bs }}</span>
              </div>
            }
          </div>
        </div>
      } @else {
        <div>
          <span class="etiqueta">Al reabrirla</span>
          <div class="lista">
            @if (cerrada() && repuestosQueVuelven().length > 0) {
              <div class="fila">
                <span class="ico-fila verde" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M21 8 12 3 3 8v8l9 5 9-5z" /><path d="m3 8 9 5 9-5M12 13v8" /></svg>
                </span>
                <span class="textos">
                  <b>Vuelven al stock</b>
                  <small>{{ textoRepuestos() }}</small>
                </span>
                <span class="monto tenue">
                  {{ repuestosQueVuelven().length === 1 ? '1 repuesto' : repuestosQueVuelven().length + ' repuestos' }}
                </span>
              </div>
            }
            @if (cerrada()) {
              @for (c of comisionesPendientes(); track c.comisionId) {
                <div class="fila">
                  <span class="ico-fila azul" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
                  </span>
                  <span class="textos">
                    <b>Se quita la comisión de {{ c.nombreMecanico }}</b>
                    <small>Pendiente; se vuelve a calcular al cerrar</small>
                  </span>
                  <span class="monto tenue">{{ c.monto | bs }}</span>
                </div>
              }
            }
            @if (proforma(); as f) {
              <div class="fila">
                <span class="ico-fila gris" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6M9 14h6" /></svg>
                </span>
                <span class="textos">
                  <b>Se anula la proforma {{ f.proformaId }}</b>
                  <small>Sin pagos; después se emite una nueva</small>
                </span>
                <span class="monto tenue">{{ f.total | bs }}</span>
              </div>
            }
            <div class="fila">
              <span class="ico-fila gris" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
              </span>
              <span class="textos">
                <b>Vuelve a En proceso</b>
                <small>Se pueden cambiar servicios y repuestos</small>
              </span>
            </div>
          </div>
        </div>

        <ol class="camino" aria-label="Pasos que siguen">
          @for (paso of pasos(); track paso; let i = $index) {
            <li [class.actual]="i === 0"><span class="n">{{ i + 1 }}</span>{{ paso }}</li>
          }
        </ol>

        <div class="campo mb-0">
          <label for="motivoCorreccion">Motivo de la corrección</label>
          <textarea
            #campoMotivo
            id="motivoCorreccion"
            name="motivoCorreccion"
            class="motivo"
            rows="2"
            maxlength="200"
            placeholder="Ej. Se cargó 1 litro de aceite y se usaron 4"
            [(ngModel)]="motivo"
          ></textarea>
          <div class="chips">
            @for (m of motivosComunes; track m) {
              <button type="button" class="chip" (click)="usarMotivo(m)">{{ m }}</button>
            }
          </div>
          <span class="campo-ayuda">Queda en Auditoría y en el historial de la orden.</span>
        </div>
      }

      <div pie>
        @if (bloqueo() === 'pagos' && !cargando()) {
          @if (confirmandoReversion()) {
            <button type="button" class="btn btn-secundario" [disabled]="revirtiendo()" (click)="confirmandoReversion.set(false)">No</button>
            <button type="button" class="btn btn-peligro" [disabled]="revirtiendo()" (click)="revertirPagos()">
              {{ revirtiendo() ? 'Revirtiendo…' : 'Sí, revertir' }}
            </button>
          } @else {
            <button type="button" class="btn btn-secundario" (click)="cerrar.emit()">Cerrar</button>
            <button type="button" class="btn btn-oscuro" (click)="confirmandoReversion.set(true)">
              <svg class="btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7v6h6" /><path d="M3.51 13a9 9 0 1 0 2.13-9.36L3 7" /></svg>
              {{ pagos().length === 1 ? 'Revertir el pago' : 'Revertir los ' + pagos().length + ' pagos' }}
            </button>
          }
        } @else if (bloqueo() === 'comisiones') {
          <button type="button" class="btn btn-secundario" (click)="cerrar.emit()">Cerrar</button>
        } @else {
          <button type="button" class="btn btn-secundario" (click)="cerrar.emit()">Cancelar</button>
          <button
            type="button"
            class="btn btn-primario"
            [disabled]="cargando() || procesando() || !motivo.trim()"
            (click)="confirmar.emit(motivo.trim())"
          >
            {{ procesando() ? 'Reabriendo…' : 'Reabrir para corregir' }}
          </button>
        }
      </div>
    </app-modal>
  `,
  styles: `
    .subtitulo { display: block; margin-top: 3px; font-size: 13px; color: var(--gris-500); }

    .etiqueta {
      display: block;
      margin-bottom: 8px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      color: var(--gris-500);
    }

    .lista { border: 1px solid var(--gris-200); border-radius: var(--radio); background: var(--blanco); }

    .fila {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
      padding: 11px 14px;
    }
    .fila + .fila { border-top: 1px solid var(--gris-100); }

    .ico-fila {
      width: 32px;
      height: 32px;
      display: grid;
      place-items: center;
      border-radius: var(--radio-sm);
    }
    .ico-fila svg {
      width: 16px;
      height: 16px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.9;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .ico-fila.verde { background: var(--verde-100); color: var(--verde-700); }
    .ico-fila.azul { background: var(--azul-100); color: var(--azul-700); }
    .ico-fila.gris { background: var(--gris-100); color: var(--ink-soft); }

    .textos { min-width: 0; }
    .textos b { display: block; font-weight: 500; }
    .textos small { display: block; font-size: 12.5px; color: var(--gris-500); }

    .monto { font-family: var(--fuente-mono, 'Geist Mono', monospace); font-size: 13px; white-space: nowrap; }
    .monto.tenue { color: var(--ink-soft); }

    .fila-total {
      display: flex;
      justify-content: space-between;
      padding: 10px 14px;
      border-top: 1px solid var(--gris-200);
      border-radius: 0 0 14px 14px;
      background: var(--gris-50);
      font-weight: 600;
    }

    .bloqueo {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px 18px;
      border: 1px solid var(--naranja-100);
      border-radius: var(--radio);
      background: var(--naranja-100);
    }
    .bloqueo strong { font-size: 15px; font-weight: 600; }
    .bloqueo p { margin: 0; font-size: 13.5px; line-height: 1.5; color: var(--ink-soft); }

    .confirmar-reversion {
      padding: 10px 12px;
      border-radius: var(--radio-sm);
      background: var(--blanco);
      border: 1px solid var(--gris-300);
      font-weight: 500;
      color: var(--ink) !important;
    }

    .n {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
      display: inline-grid;
      place-items: center;
      border-radius: 50%;
      font-size: 11px;
      font-weight: 600;
      background: var(--gris-100);
      color: var(--ink-soft);
    }

    .camino {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 18px 0;
      padding: 0;
      list-style: none;
      font-size: 12.5px;
      color: var(--gris-500);
    }
    .camino li { display: flex; align-items: center; gap: 7px; white-space: nowrap; }
    .camino li + li::before {
      content: '';
      width: 28px;
      height: 1px;
      margin-right: 3px;
      background: var(--gris-200);
    }
    .camino li.actual { color: var(--ink); font-weight: 500; }
    .camino li.actual .n { background: var(--ink); color: var(--blanco); }

    .motivo:focus {
      border-color: var(--ink);
      outline: none;
      box-shadow: 0 0 0 3px rgba(21, 26, 34, 0.08);
    }

    .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    .chip {
      padding: 4px 10px;
      border: 1px solid var(--gris-200);
      border-radius: 999px;
      background: var(--gris-50);
      font: inherit;
      font-size: 12px;
      color: var(--ink-soft);
      cursor: pointer;
    }
    .chip:hover { background: var(--gris-100); color: var(--ink); }

    .cargando { display: flex; flex-direction: column; gap: 10px; }
    .esqueleto {
      height: 56px;
      border-radius: var(--radio);
      background: linear-gradient(90deg, var(--gris-100), var(--gris-50), var(--gris-100));
      background-size: 200% 100%;
      animation: brillo 1.2s ease-in-out infinite;
    }
    .esqueleto.corto { height: 38px; width: 60%; }
    @keyframes brillo { from { background-position: 100% 0; } to { background-position: -100% 0; } }


    @media (max-width: 560px) {
      .camino { flex-wrap: wrap; row-gap: 8px; }
      .camino li + li::before { width: 12px; }
    }
  `,
})
export class CorregirOrden implements OnInit {
  readonly orden = input.required<OrdenDetalle>();
  /** Proforma vigente de la orden (Emitida), si la tiene. */
  readonly proforma = input<Proforma | null>(null);
  readonly procesando = input(false);

  readonly cerrar = output<void>();
  readonly confirmar = output<string>();
  /** Se revirtieron los pagos: la orden debe volver a leer su proforma. */
  readonly pagosRevertidos = output<void>();

  private readonly pagosService = inject(PagosService);
  private readonly comisionesService = inject(ComisionesService);
  private readonly notificacion = inject(NotificacionService);
  private readonly campoMotivo = viewChild<ElementRef<HTMLTextAreaElement>>('campoMotivo');

  protected readonly ETIQUETAS = ETIQUETAS;
  protected readonly MetodoPago = MetodoPago;

  protected motivo = '';
  protected readonly motivosComunes = ['Faltó un repuesto', 'Cantidad equivocada', 'Servicio de más', 'Precio equivocado'];

  protected readonly cargando = signal(true);
  protected readonly pagos = signal<Pago[]>([]);
  protected readonly confirmandoReversion = signal(false);
  protected readonly revirtiendo = signal(false);
  /** Ya se revirtieron aquí: no esperar a que la orden recargue la proforma. */
  private readonly revertidos = signal(false);
  private readonly comisiones = signal<Comision[]>([]);

  protected readonly cerrada = computed(() => this.orden().estado === EstadoOrden.Cerrada);
  protected readonly totalPagado = computed(() => (this.revertidos() ? 0 : (this.proforma()?.totalPagado ?? 0)));
  protected readonly comisionesPagadas = computed(() =>
    this.comisiones().filter((c) => c.estadoPago === EstadoPago.Pagado),
  );
  protected readonly comisionesPendientes = computed(() =>
    this.comisiones().filter((c) => c.estadoPago === EstadoPago.Pendiente),
  );

  /** Lo que impide reabrir; null si se puede. */
  protected readonly bloqueo = computed<'pagos' | 'comisiones' | null>(() => {
    if (this.totalPagado() > 0) return 'pagos';
    if (this.comisionesPagadas().length > 0) return 'comisiones';
    return null;
  });

  protected readonly repuestosQueVuelven = computed(() =>
    this.orden().repuestos.filter((r) => r.origen === OrigenRepuesto.Inventario),
  );

  protected readonly textoRepuestos = computed(() =>
    this.repuestosQueVuelven()
      .map((r) => `${r.nombreRepuesto} × ${r.cantidad}`)
      .join(' · '),
  );

  protected readonly subtitulo = computed(() => {
    const o = this.orden();
    const estado = o.fechaCierre && this.cerrada()
      ? `cerrada el ${new DatePipe('es-BO').transform(o.fechaCierre, 'dd/MM/yyyy')}`
      : ETIQUETAS.estadoOrden[o.estado].toLowerCase();
    return `${o.descripcionVehiculo} · ${o.placaVehiculo} · ${estado}`;
  });

  protected readonly pasos = computed(() =>
    this.cerrada() ? ['Corregir', 'Finalizar', 'Cerrar', 'Nueva proforma'] : ['Corregir', 'Finalizar', 'Cerrar'],
  );

  ngOnInit(): void {
    const proformaId = this.proforma()?.proformaId;
    const pagos$ = proformaId && this.totalPagado() > 0
      ? this.pagosService.getAll({ proformaId, tamanoPagina: 50 }).pipe(map((r) => r.items))
      : of([] as Pago[]);
    const comisiones$ = this.cerrada()
      ? this.comisionesService.getAll({ ordenId: this.orden().ordenId, tamanoPagina: 50 }).pipe(map((r) => r.items))
      : of([] as Comision[]);

    forkJoin({
      pagos: pagos$.pipe(catchError(() => of([] as Pago[]))),
      comisiones: comisiones$.pipe(catchError(() => of([] as Comision[]))),
    }).subscribe(({ pagos, comisiones }) => {
      this.pagos.set(pagos);
      this.comisiones.set(comisiones);
      this.cargando.set(false);
    });
  }

  /** Revierte los pagos uno tras otro; al terminar sigue con la corrección. */
  protected revertirPagos(): void {
    this.revirtiendo.set(true);
    from(this.pagos())
      .pipe(
        concatMap((p) => this.pagosService.revertir(p.pagoId)),
        toArray(),
      )
      .subscribe({
        next: () => {
          this.revirtiendo.set(false);
          this.confirmandoReversion.set(false);
          this.pagos.set([]);
          this.revertidos.set(true);
          this.notificacion.exito('Pagos revertidos. Ya puede corregir la orden.');
          this.pagosRevertidos.emit();
        },
        // Si uno falla (el aviso lo muestra el interceptor), se relee lo que quedó.
        error: () => {
          this.revirtiendo.set(false);
          this.confirmandoReversion.set(false);
          this.pagosRevertidos.emit();
          const proformaId = this.proforma()?.proformaId;
          if (proformaId) {
            this.pagosService
              .getAll({ proformaId, tamanoPagina: 50 })
              .pipe(catchError(() => of(null)))
              .subscribe((r) => r && this.pagos.set(r.items));
          }
        },
      });
  }

  /** Completa el motivo con uno común; el detalle se escribe a continuación. */
  protected usarMotivo(texto: string): void {
    const actual = this.motivo.trim();
    this.motivo = actual ? `${texto}: ${actual}` : `${texto}: `;
    setTimeout(() => {
      const campo = this.campoMotivo()?.nativeElement;
      campo?.focus();
      campo?.setSelectionRange(this.motivo.length, this.motivo.length);
    });
  }
}
