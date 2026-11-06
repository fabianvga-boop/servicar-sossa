import { DatePipe } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { EstadoOrden } from '../../core/models/enums';
import { Proforma } from '../../core/models/finanzas.model';
import { Orden } from '../../core/models/taller.model';
import { urlArchivo } from '../../core/services/api-base';
import { Placa } from '../../shared/components/placa';
import { BolivianosPipe } from '../../shared/pipes/bolivianos.pipe';

/** Portada de un vehículo: su primera foto y cuántas tiene en total. */
export interface Portada {
  url: string;
  cantidad: number;
}

/**
 * Tarjeta de una orden: la foto del vehículo con su placa, quién la trabaja
 * y cuánto suma. La usan el tablero de activas y las listas de las demás
 * pestañas, así se ve igual en todas.
 *
 * Toda la tarjeta abre el detalle; los botones de cobro llevan a Proformas o
 * a Pagos sin abrirlo.
 */
@Component({
  selector: 'app-tarjeta-orden',
  imports: [DatePipe, RouterLink, Placa, BolivianosPipe],
  host: {
    tabindex: '0',
    '[attr.aria-label]': "'Abrir la orden ' + orden().ordenId",
    '(click)': 'abrir()',
    '(keydown.enter)': 'abrir()',
  },
  template: `
    <!-- Portada: misma foto que gestiona Vehículos; sin fotos, un fondo con
         ícono en vez de un hueco. La placa va encima en los dos casos. -->
    <div class="foto">
      @if (portada(); as foto) {
        <img [src]="urlArchivo(foto.url)" [alt]="'Foto de ' + orden().placaVehiculo" loading="lazy" />
        @if (foto.cantidad > 1) {
          <span class="foto-cantidad" [attr.aria-label]="foto.cantidad + ' fotos'">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" />
            </svg>
            {{ foto.cantidad }}
          </span>
        }
      } @else {
        <span class="foto-vacia">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M4 16V9l2-4h12l2 4v7" /><path d="M4 16h16v2a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1v-1h-9v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2Z" />
            <circle cx="7.5" cy="16" r="1.4" /><circle cx="16.5" cy="16" r="1.4" />
          </svg>
          Sin fotos del vehículo
        </span>
      }
      <app-placa class="foto-placa" [valor]="orden().placaVehiculo" />
    </div>

    <div class="cuerpo">
      <div class="titulo">
        <strong class="vehiculo">{{ orden().descripcionVehiculo }}</strong>
        <span class="codigo">{{ orden().ordenId }}</span>
      </div>
      <div class="cliente">{{ orden().nombreCliente }}</div>

      @if (orden().fechaCierre && orden().estado === EstadoOrden.Cerrada) {
        <div class="nota">Cerrada el {{ orden().fechaCierre | date: 'dd/MM/yyyy HH:mm' }}</div>
      } @else if (orden().fechaCierre && orden().estado === EstadoOrden.Cancelada) {
        <div class="nota">Cancelada el {{ orden().fechaCierre | date: 'dd/MM/yyyy HH:mm' }}</div>
      } @else if (avisarSinCerrar() && orden().estado === EstadoOrden.Finalizada) {
        <div class="nota">Finalizada, sin cerrar</div>
      }

      @if (diasRetraso(); as dias) {
        <span
          class="chip-retraso"
          [class.grave]="dias > 7"
          [title]="dias + ' día(s) de retraso sobre la fecha estimada'"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 2" />
          </svg>
          {{ dias }} {{ dias === 1 ? 'día' : 'días' }} de retraso
        </span>
      }
    </div>

    <div class="pie">
      <span class="mecanico">
        @if (mecanico(); as nombre) {
          <span class="avatar-mini" aria-hidden="true">{{ iniciales(nombre) }}</span>
          <span class="mecanico-nombre">{{ nombre }}</span>
          @if (otrosMecanicos() > 0) {
            <span class="texto-tenue" [title]="otrosMecanicos() + ' mecánico(s) más'">+{{ otrosMecanicos() }}</span>
          }
        } @else if (orden().cantidadMecanicos > 0) {
          <!-- La API todavía no manda los nombres: al menos el conteo -->
          <span class="texto-tenue">{{ orden().cantidadMecanicos }} mec.</span>
        } @else {
          <span class="texto-tenue">Sin mecánico</span>
        }
      </span>
      <span class="total">{{ orden().total | bs }}</span>
    </div>

    <!-- Cobro: solo el Administrador, y solo trabajo terminado con monto -->
    @if (mostrarCobro()) {
      @if (proforma(); as p) {
        @if (p.estaSaldada) {
          <span class="cobro-pagado">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m5 12 5 5 9-10" />
            </svg>
            Pagada · {{ p.proformaId }}
          </span>
        } @else {
          <a
            class="btn btn-secundario btn-sm cobro-btn"
            [routerLink]="['/pagos']"
            [queryParams]="{ proformaId: p.proformaId }"
            (click)="$event.stopPropagation()"
          >
            Registrar pago · saldo {{ p.saldoPendiente | bs }}
          </a>
        }
      } @else {
        <a
          class="btn btn-primario btn-sm cobro-btn"
          [routerLink]="['/proformas']"
          [queryParams]="{ ordenId: orden().ordenId }"
          (click)="$event.stopPropagation()"
        >
          Emitir proforma
        </a>
      }
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      /* La columna del tablero ya scrollea sola: la tarjeta nunca se achica
         por debajo de su contenido. */
      flex-shrink: 0;
      background: var(--blanco);
      border: 1px solid var(--gris-200);
      border-radius: var(--radio);
      overflow: hidden;
      cursor: pointer;
      transition: border-color 0.15s, box-shadow 0.15s, transform 0.1s;
    }

    :host(:hover) {
      border-color: var(--gris-300);
      box-shadow: 0 8px 20px -14px rgba(21, 26, 34, 0.4);
    }

    :host(:active) { transform: scale(0.99); }

    :host(:focus-visible) {
      outline: 2px solid var(--brand);
      outline-offset: 1px;
    }

    .foto {
      position: relative;
      aspect-ratio: 16 / 9;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, var(--gris-100), var(--gris-50));
      color: var(--gris-400);
    }

    /* Absoluta: una foto vertical no puede estirar la tarjeta más allá del 16:9 */
    .foto img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .foto-vacia {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      margin-bottom: 18px;
      font-size: 12px;
    }

    .foto-vacia svg {
      width: 26px;
      height: 26px;
      color: var(--gris-300);
    }

    .foto-placa {
      position: absolute;
      left: 8px;
      bottom: 8px;
    }

    .foto-cantidad {
      position: absolute;
      top: 8px;
      right: 8px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      height: 22px;
      padding: 0 8px;
      border-radius: 999px;
      background: rgba(21, 26, 34, 0.72);
      color: var(--blanco);
      font-size: 11.5px;
      font-weight: 500;
    }

    .cuerpo {
      display: flex;
      flex-direction: column;
      gap: 3px;
      padding: 11px 12px 0;
    }

    .titulo {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
    }

    .vehiculo,
    .cliente,
    .mecanico-nombre {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .vehiculo {
      font-size: 14.5px;
      font-weight: 600;
      color: var(--ink);
    }

    .cliente {
      font-size: 13px;
      color: var(--ink-soft);
    }

    .nota {
      font-size: 12px;
      color: var(--gris-400);
    }

    .chip-retraso {
      align-self: flex-start;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-top: 4px;
      padding: 2px 8px 2px 6px;
      border-radius: 999px;
      background: var(--naranja-100);
      color: var(--naranja-700);
      font-size: 11.5px;
      font-weight: 600;
      white-space: nowrap;
    }

    /* Pasada una semana el retraso deja de ser un aviso y pasa a ser un problema */
    .chip-retraso.grave {
      background: var(--brand-soft);
      color: var(--brand-dk);
    }

    .pie {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin: 10px 12px 0;
      padding: 9px 0 11px;
      border-top: 1px solid var(--gris-100);
    }

    .mecanico {
      display: flex;
      align-items: center;
      gap: 7px;
      min-width: 0;
      font-size: 12.5px;
      color: var(--ink-soft);
    }

    .avatar-mini {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      flex-shrink: 0;
      border-radius: 50%;
      background: var(--ink);
      color: var(--blanco);
      font-size: 10px;
      font-weight: 600;
    }

    .total {
      font-family: var(--fuente-mono);
      font-size: 14px;
      font-weight: 500;
      white-space: nowrap;
    }

    .cobro-btn { margin: 0 12px 12px; }

    .cobro-pagado {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin: 0 12px 12px;
      font-size: 12.5px;
      font-weight: 500;
      color: var(--verde-700);
    }
  `,
})
export class TarjetaOrden {
  private readonly router = inject(Router);

  readonly orden = input.required<Orden>();
  readonly portada = input<Portada | null>(null);
  /** Proforma vigente de la orden, o null si todavía no se emitió. */
  readonly proforma = input<Proforma | null>(null);
  /** Muestra el botón de cobro; lo decide la lista (rol, estado y monto). */
  readonly mostrarCobro = input(false);
  /** En "Por cobrar" recuerda que una finalizada todavía no se cerró. */
  readonly avisarSinCerrar = input(false);

  protected readonly EstadoOrden = EstadoOrden;
  protected readonly urlArchivo = urlArchivo;

  /** Desde el 23/10 cada orden tiene un mecánico; las anteriores pueden tener más. */
  protected readonly mecanico = computed(() => this.orden().mecanicos?.[0]?.nombreMecanico ?? null);

  protected readonly otrosMecanicos = computed(() =>
    Math.max(0, (this.orden().mecanicos ?? []).length - 1),
  );

  /**
   * Días vencidos sobre la fecha estimada de entrega. Solo cuenta mientras la
   * orden sigue en el taller: una cerrada o cancelada ya no puede atrasarse.
   */
  protected readonly diasRetraso = computed(() => {
    const orden = this.orden();
    if (!orden.fechaEstimada) return 0;
    if (orden.estado !== EstadoOrden.Abierta && orden.estado !== EstadoOrden.EnProceso) return 0;

    const estimada = new Date(orden.fechaEstimada);
    const hoy = new Date();
    estimada.setHours(0, 0, 0, 0);
    hoy.setHours(0, 0, 0, 0);

    const dias = Math.floor((hoy.getTime() - estimada.getTime()) / 86_400_000);
    return dias > 0 ? dias : 0;
  });

  /**
   * Iniciales de un nombre completo: "Hector Vega" → "HV". Con un solo
   * nombre usa sus dos primeras letras para no dejar un círculo con una
   * sola letra perdida.
   */
  protected iniciales(nombre: string): string {
    const partes = nombre.trim().split(/\s+/).filter(Boolean);
    if (partes.length === 0) return '—';

    return partes.length === 1
      ? partes[0].slice(0, 2).toUpperCase()
      : (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
  }

  protected abrir(): void {
    void this.router.navigate(['/ordenes', this.orden().ordenId]);
  }
}
