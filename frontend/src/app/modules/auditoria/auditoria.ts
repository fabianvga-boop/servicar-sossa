import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { AccionAuditoria, ETIQUETAS } from '../../core/models/enums';
import { Auditoria as AuditoriaFila } from '../../core/models/auditoria.model';
import { Usuario } from '../../core/models/personas.model';
import { AuditoriaService } from '../../core/services/auditoria.service';
import { UsuariosService } from '../../core/services/usuarios.service';
import { EstadoTabla } from '../../shared/components/estado-tabla';
import { Paginador } from '../../shared/components/paginador';
import { TextoResaltado } from '../../shared/components/texto-resaltado';

/** Los grupos de la fila de filtros: cada uno es un módulo del sistema. */
const GRUPOS = [
  { clave: '', texto: 'Todo' },
  { clave: 'Orden', texto: 'Órdenes' },
  { clave: 'Diagnostico', texto: 'Diagnósticos' },
  { clave: 'Repuesto', texto: 'Repuestos' },
  { clave: 'Compra', texto: 'Compras' },
  { clave: 'Pago', texto: 'Cobros' },
  { clave: 'Usuario', texto: 'Usuarios' },
];

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** Un código del sistema ("ORD-015", "REP-011"): se busca por registro exacto. */
const CODIGO = /^[a-z]{3}-\d+$/i;

interface DiaAuditoria {
  clave: string;
  titulo: string;
  filas: AuditoriaFila[];
}

/** Bitácora de auditoría: quién hizo qué, cuándo, sobre qué registro. No se edita ni se borra. */
@Component({
  selector: 'app-auditoria',
  imports: [FormsModule, RouterLink, DatePipe, EstadoTabla, Paginador, TextoResaltado],
  templateUrl: './auditoria.html',
  styleUrl: './auditoria.css',
})
export class Auditoria {
  private readonly servicio = inject(AuditoriaService);

  protected readonly filas = signal<AuditoriaFila[]>([]);
  protected readonly usuarios = signal<Usuario[]>([]);
  protected readonly cargando = signal(true);

  protected readonly pagina = signal(1);
  protected readonly tamanoPagina = signal(50);
  protected readonly totalRegistros = signal(0);
  protected readonly totalPaginas = signal(0);

  protected readonly GRUPOS = GRUPOS;
  protected readonly ETIQUETAS = ETIQUETAS;

  protected readonly grupo = signal('');
  protected readonly usuarioId = signal('');
  protected readonly texto = signal('');

  /** Lo cargado, filtrado por el texto (si no es un código) y agrupado por día. */
  protected readonly dias = computed<DiaAuditoria[]>(() => {
    const texto = this.texto().trim().toLowerCase();
    const lista = !texto || CODIGO.test(texto)
      ? this.filas()
      : this.filas().filter((f) => (f.descripcion + ' ' + f.entidadId + ' ' + f.nombreUsuario).toLowerCase().includes(texto));

    const grupos = new Map<string, DiaAuditoria>();
    for (const fila of lista) {
      const fecha = new Date(fila.fecha);
      const clave = `${fecha.getFullYear()}-${fecha.getMonth()}-${fecha.getDate()}`;
      if (!grupos.has(clave)) grupos.set(clave, { clave, titulo: tituloDia(fecha), filas: [] });
      grupos.get(clave)!.filas.push(fila);
    }
    return [...grupos.values()];
  });

  constructor() {
    this.cargar();
    inject(UsuariosService)
      .getAll(undefined, 1, 500)
      .pipe(catchError(() => of(null)))
      .subscribe((r) => this.usuarios.set(r?.items ?? []));
  }

  protected cargar(): void {
    this.cargando.set(true);
    const texto = this.texto().trim();

    this.servicio
      .getAll({
        entidad: this.grupo() || undefined,
        usuarioId: this.usuarioId() || undefined,
        entidadId: CODIGO.test(texto) ? texto.toUpperCase() : undefined,
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

  protected elegirGrupo(clave: string): void {
    this.grupo.set(clave);
    this.pagina.set(1);
    this.cargar();
  }

  protected elegirUsuario(id: string): void {
    this.usuarioId.set(id);
    this.pagina.set(1);
    this.cargar();
  }

  /** Un código se busca en el servidor; cualquier otro texto, en lo ya cargado. */
  protected onBuscar(valor: string): void {
    const antes = CODIGO.test(this.texto().trim());
    this.texto.set(valor);
    if (antes || CODIGO.test(valor.trim())) {
      this.pagina.set(1);
      this.cargar();
    }
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

  /** Color fijo del avatar según el nombre (estándar de tablas). */
  protected tonoNombre(nombre: string | null | undefined): string {
    const suma = [...(nombre ?? '')].reduce((total, letra) => total + letra.charCodeAt(0), 0);
    return ['azul', 'verde', 'naranja', 'rojo'][suma % 4];
  }

  protected iniciales(nombre: string | null | undefined): string {
    const partes = (nombre ?? '').trim().split(/\s+/).filter(Boolean);
    if (partes.length === 0) return '—';
    return partes.length === 1
      ? partes[0].slice(0, 2).toUpperCase()
      : (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
  }

  protected claseAccion(accion: AccionAuditoria): string {
    switch (accion) {
      case AccionAuditoria.Crear:
        return 'insignia-verde';
      case AccionAuditoria.Eliminar:
      case AccionAuditoria.Anular:
      case AccionAuditoria.Excepcion:
        return 'insignia-roja';
      case AccionAuditoria.CambiarEstado:
      case AccionAuditoria.Ajustar:
        return 'insignia-naranja';
      default:
        return 'insignia-azul';
    }
  }

  /** A dónde lleva el código del registro, si tiene pantalla propia. */
  protected enlace(fila: AuditoriaFila): { ruta: string[]; parametros?: Record<string, string> } | null {
    const id = fila.entidadId;
    switch (fila.entidad) {
      case 'Orden':
        return { ruta: ['/ordenes', id] };
      case 'Vehiculo':
        return { ruta: ['/vehiculos', id] };
      case 'Cliente':
        return { ruta: ['/clientes'], parametros: { clienteId: id } };
      case 'Diagnostico':
        return { ruta: ['/diagnosticos'], parametros: { buscar: id } };
      case 'Repuesto':
        return { ruta: ['/repuestos'], parametros: { procedencia: id, buscar: id } };
      case 'Proforma':
        return { ruta: ['/proformas'] };
      case 'Pago':
        return { ruta: ['/pagos'] };
      case 'Compra':
        return { ruta: ['/compras'] };
      default:
        return null;
    }
  }
}

/** "Hoy, martes 4 de noviembre", "Ayer, lunes 3 de noviembre" o "Martes 28 de octubre". */
function tituloDia(fecha: Date): string {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const dia = new Date(fecha);
  dia.setHours(0, 0, 0, 0);
  const diferencia = Math.round((hoy.getTime() - dia.getTime()) / 86_400_000);
  const nombre = `${DIAS[fecha.getDay()]} ${fecha.getDate()} de ${MESES[fecha.getMonth()]}`;
  const anio = fecha.getFullYear() !== hoy.getFullYear() ? ` de ${fecha.getFullYear()}` : '';

  if (diferencia === 0) return `Hoy, ${nombre}`;
  if (diferencia === 1) return `Ayer, ${nombre}`;
  return nombre.charAt(0).toUpperCase() + nombre.slice(1) + anio;
}
