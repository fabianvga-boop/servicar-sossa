import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { EstadoDiag, EstadoOrden } from '../../core/models/enums';
import { Diagnostico, Orden } from '../../core/models/taller.model';
import { AuthService } from '../../core/services/auth.service';
import { OrdenesService } from '../../core/services/ordenes.service';
import { DiagnosticosService } from '../../core/services/taller.service';

/** Franja que dibuja la grilla; lo que cae antes o después va a la primera o última fila. */
const HORA_INICIO = 8;
const HORA_FIN = 18;

const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

type Tipo = 'recepcion' | 'trabajo' | 'entrega';

/** Algo que pasó (o va a pasar) a una hora: una recepción o un cierre. */
interface EventoHora {
  clave: string;
  dia: number;
  hora: number;
  minutos: string;
  tipo: Tipo;
  titulo: string;
  detalle: string;
  ruta: string[];
  parametros?: Record<string, string>;
}

/** Lo que ocupa el día entero: una orden en el taller o una entrega estimada. */
interface EventoDia {
  clave: string;
  tipo: Tipo;
  titulo: string;
  detalle: string;
  ruta: string[];
}

interface DiaSemana {
  indice: number;
  fecha: Date;
  corto: string;
  largo: string;
  esHoy: boolean;
}

/**
 * Agenda de la semana con lo que registra el sistema: cada recepción
 * (diagnóstico) y cada cierre a su hora, y arriba, todo el día, las órdenes
 * que están en el taller y las entregas estimadas. El sistema guarda
 * momentos, no duraciones: por eso nada se dibuja como un bloque de horas.
 */
@Component({
  selector: 'app-agenda',
  imports: [RouterLink],
  templateUrl: './agenda.html',
  styleUrl: './agenda.css',
})
export class Agenda {
  private readonly ordenesService = inject(OrdenesService);
  private readonly diagnosticosService = inject(DiagnosticosService);
  private readonly auth = inject(AuthService);

  protected readonly cargando = signal(true);
  private readonly ordenes = signal<Orden[]>([]);
  private readonly diagnosticos = signal<Diagnostico[]>([]);

  /** Lunes de la semana que se mira. */
  protected readonly lunes = signal(lunesDe(new Date()));

  protected readonly horas = Array.from({ length: HORA_FIN - HORA_INICIO }, (_, i) => HORA_INICIO + i);

  protected readonly dias = computed<DiaSemana[]>(() => {
    const hoy = claveDia(new Date());
    return Array.from({ length: 6 }, (_, i) => {
      const fecha = new Date(this.lunes());
      fecha.setDate(fecha.getDate() + i);
      return {
        indice: i,
        fecha,
        corto: `${DIAS_CORTOS[fecha.getDay()]} ${fecha.getDate()}`,
        largo: `${DIAS_LARGOS[fecha.getDay()]} ${fecha.getDate()} de ${MESES[fecha.getMonth()]}`,
        esHoy: claveDia(fecha) === hoy,
      };
    });
  });

  protected readonly titulo = computed(() => {
    const dias = this.dias();
    const a = dias[0].fecha;
    const b = dias[dias.length - 1].fecha;
    return a.getMonth() === b.getMonth()
      ? `Semana del ${a.getDate()} al ${b.getDate()} de ${MESES[b.getMonth()]}`
      : `Semana del ${a.getDate()} de ${MESES[a.getMonth()]} al ${b.getDate()} de ${MESES[b.getMonth()]}`;
  });

  protected readonly esEstaSemana = computed(() => claveDia(this.lunes()) === claveDia(lunesDe(new Date())));

  // --- Lo que pasa a una hora ------------------------------------------------------

  protected readonly eventosHora = computed<EventoHora[]>(() => {
    const inicio = this.lunes().getTime();
    const fin = inicio + 6 * 86_400_000;
    const lista: EventoHora[] = [];

    const ubicar = (iso: string) => {
      const fecha = new Date(iso);
      const t = fecha.getTime();
      if (t < inicio || t >= fin) return null;
      const dia = Math.floor((new Date(fecha).setHours(0, 0, 0, 0) - inicio) / 86_400_000);
      if (dia < 0 || dia > 5) return null;
      const hora = Math.min(Math.max(fecha.getHours(), HORA_INICIO), HORA_FIN - 1);
      const minutos = `${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`;
      return { dia, hora, minutos };
    };

    for (const d of this.diagnosticos()) {
      if (d.estado === EstadoDiag.Anulado) continue;
      const lugar = ubicar(d.fecha);
      if (!lugar) continue;
      lista.push({
        clave: 'D' + d.diagnosticoId,
        ...lugar,
        tipo: 'recepcion',
        titulo: `Recepción ${d.placaVehiculo}`,
        detalle: `${d.nombreCliente} · ${recortar(d.descripcionFalla, 40)}`,
        ruta: ['/diagnosticos'],
        parametros: { buscar: d.diagnosticoId },
      });
    }

    for (const o of this.ordenes()) {
      if (o.estado !== EstadoOrden.Cerrada || !o.fechaCierre) continue;
      const lugar = ubicar(o.fechaCierre);
      if (!lugar) continue;
      lista.push({
        clave: 'C' + o.ordenId,
        ...lugar,
        tipo: 'entrega',
        titulo: `Cierre ${o.ordenId}`,
        detalle: `${o.nombreCliente} · ${o.descripcionVehiculo}`,
        ruta: ['/ordenes', o.ordenId],
      });
    }

    return lista.sort((a, b) => a.minutos.localeCompare(b.minutos));
  });

  protected tieneEventos(dia: number): boolean {
    return this.eventosDia()[dia].length > 0 || this.eventosHora().some((e) => e.dia === dia);
  }

  /** Eventos de una celda (día, hora) de la grilla. */
  protected eventosDe(dia: number, hora: number): EventoHora[] {
    return this.eventosHora().filter((e) => e.dia === dia && e.hora === hora);
  }

  // --- Lo que ocupa el día --------------------------------------------------------

  protected readonly eventosDia = computed<EventoDia[][]>(() =>
    this.dias().map((dia) => {
      const desde = new Date(dia.fecha).setHours(0, 0, 0, 0);
      const hasta = desde + 86_400_000;
      const lista: EventoDia[] = [];

      for (const o of this.ordenes()) {
        if (o.estado === EstadoOrden.Cancelada) continue;
        const abierta = new Date(o.fechaCreacion).getTime();
        const cerrada = o.fechaCierre ? new Date(o.fechaCierre).getTime() : null;
        const enTaller =
          abierta < hasta && (o.estado !== EstadoOrden.Cerrada || (cerrada !== null && cerrada >= desde));
        // Las que siguen abiertas solo hasta hoy: el futuro todavía no pasó.
        if (enTaller && (o.estado === EstadoOrden.Cerrada || desde <= Date.now())) {
          lista.push({
            clave: 'T' + o.ordenId,
            tipo: 'trabajo',
            titulo: `${o.ordenId} ${o.descripcionVehiculo}`,
            detalle: o.mecanicos.map((m) => m.nombreMecanico).join(', ') || o.nombreCliente,
            ruta: ['/ordenes', o.ordenId],
          });
        }

        if (o.fechaEstimada && o.estado !== EstadoOrden.Cerrada && claveDiaIso(o.fechaEstimada) === claveDia(dia.fecha)) {
          lista.push({
            clave: 'E' + o.ordenId,
            tipo: 'entrega',
            titulo: `Entrega estimada ${o.ordenId}`,
            detalle: o.nombreCliente,
            ruta: ['/ordenes', o.ordenId],
          });
        }
      }
      return lista;
    }),
  );

  protected readonly hayEventosDia = computed(() => this.eventosDia().some((d) => d.length > 0));

  // --- Trabajo de la semana por mecánico ---------------------------------------------

  protected readonly ocupacion = computed(() => {
    const cuentas = new Map<string, Set<string>>();
    for (const dia of this.eventosDia()) {
      for (const e of dia) {
        if (e.tipo !== 'trabajo') continue;
        const orden = this.ordenes().find((o) => 'T' + o.ordenId === e.clave);
        for (const m of orden?.mecanicos ?? []) {
          if (!cuentas.has(m.nombreMecanico)) cuentas.set(m.nombreMecanico, new Set());
          cuentas.get(m.nombreMecanico)!.add(orden!.ordenId);
        }
      }
    }
    const lista = [...cuentas.entries()].map(([nombre, ordenes]) => ({ nombre, cantidad: ordenes.size }));
    const maximo = Math.max(1, ...lista.map((m) => m.cantidad));
    return lista
      .sort((a, b) => b.cantidad - a.cantidad)
      .map((m) => ({ ...m, porcentaje: Math.max(6, Math.round((m.cantidad / maximo) * 100)) }));
  });

  protected readonly recepcionesSemana = computed(
    () => this.eventosHora().filter((e) => e.tipo === 'recepcion').length,
  );

  constructor() {
    const esAdmin = this.auth.esAdministrador();
    const mecanicoId = this.auth.usuarioId() ?? undefined;
    let pendientes = 2;
    const listo = () => {
      pendientes -= 1;
      if (pendientes === 0) this.cargando.set(false);
    };

    this.ordenesService
      .getAll(esAdmin ? {} : { mecanicoId })
      .pipe(catchError(() => of([] as Orden[])))
      .subscribe((lista) => {
        this.ordenes.set(lista);
        listo();
      });

    this.diagnosticosService
      .getAll(esAdmin ? { tamanoPagina: 500 } : { mecanicoId, tamanoPagina: 500 })
      .pipe(catchError(() => of(null)))
      .subscribe((r) => {
        this.diagnosticos.set(r?.items ?? []);
        listo();
      });
  }

  protected moverSemana(semanas: number): void {
    const lunes = new Date(this.lunes());
    lunes.setDate(lunes.getDate() + semanas * 7);
    this.lunes.set(lunes);
  }

  protected irAHoy(): void {
    this.lunes.set(lunesDe(new Date()));
  }

  protected etiquetaHora(hora: number): string {
    return `${hora}:00`;
  }
}

function lunesDe(fecha: Date): Date {
  const lunes = new Date(fecha);
  lunes.setHours(0, 0, 0, 0);
  lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7));
  return lunes;
}

function claveDia(fecha: Date): string {
  return `${fecha.getFullYear()}-${fecha.getMonth()}-${fecha.getDate()}`;
}

/** Fechas "solo día" (yyyy-MM-dd…): se leen sin pasar por la zona horaria. */
function claveDiaIso(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${a}-${m - 1}-${d}`;
}

function recortar(texto: string, largo: number): string {
  return texto.length > largo ? texto.slice(0, largo - 1).trimEnd() + '…' : texto;
}
