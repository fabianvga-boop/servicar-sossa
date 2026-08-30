import { Injectable } from '@angular/core';

const PREFIJO = 'servicar.pref.';

/**
 * Recuerda entre visitas los filtros que el usuario dejó puestos en cada
 * listado. Sin esto, volver a un módulo obliga a reconfigurar la búsqueda
 * cada vez, que es la queja más común en pantallas de consulta.
 *
 * Las claves se agrupan por módulo (`ordenes.estado`, `repuestos.buscar`)
 * para poder limpiar un módulo entero si su filtro cambia de forma.
 */
@Injectable({ providedIn: 'root' })
export class PreferenciasService {
  /** Devuelve lo guardado para la clave, o `porDefecto` si no hay nada. */
  leer<T>(clave: string, porDefecto: T): T {
    const crudo = localStorage.getItem(PREFIJO + clave);
    if (crudo === null) return porDefecto;

    try {
      return JSON.parse(crudo) as T;
    } catch {
      // Un valor corrupto no debe romper la pantalla: se descarta en silencio.
      return porDefecto;
    }
  }

  guardar(clave: string, valor: unknown): void {
    // Guardar el valor "sin filtro" solo ensucia el almacenamiento: se borra.
    if (valor === '' || valor === null || valor === undefined || valor === false) {
      localStorage.removeItem(PREFIJO + clave);
      return;
    }

    localStorage.setItem(PREFIJO + clave, JSON.stringify(valor));
  }
}
