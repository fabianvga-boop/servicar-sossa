import { Component, input } from '@angular/core';

/** Nombres válidos de ícono para el menú lateral. */
export type NombreIconoMenu =
  | 'panel'
  | 'ordenes'
  | 'diagnosticos'
  | 'catalogo'
  | 'clientes'
  | 'vehiculos'
  | 'repuestos'
  | 'proveedores'
  | 'compras'
  | 'ventas'
  | 'proformas'
  | 'pagos'
  | 'comisiones'
  | 'usuarios'
  | 'reportes'
  | 'auditoria'
  | 'plantillas'
  | 'completado'
  | 'buscar'
  | 'menu';

/**
 * Íconos de trazo para el menú lateral, en vez de emoji: se ven iguales en
 * cualquier sistema operativo y heredan el color del enlace (stroke="currentColor").
 */
@Component({
  selector: 'app-icono-menu',
  template: `
    @switch (nombre()) {
      @case ('panel') {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="8" height="10" rx="2"/><rect x="13" y="3" width="8" height="6" rx="2"/><rect x="13" y="11" width="8" height="10" rx="2"/><rect x="3" y="15" width="8" height="6" rx="2"/>
        </svg>
      }
      @case ('ordenes') {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <rect x="5" y="4.5" width="14" height="16.5" rx="2.5"/><path d="M9 4.5V4A1.5 1.5 0 0 1 10.5 2.5h3A1.5 1.5 0 0 1 15 4v.5"/><path d="m8.8 11 1.3 1.3L12.6 10"/><path d="M14.5 11.2h1.7"/><path d="m8.8 16 1.3 1.3L12.6 15"/><path d="M14.5 16.2h1.7"/>
        </svg>
      }
      @case ('diagnosticos') {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4.2 18a7.8 7.8 0 1 1 15.6 0"/><path d="M12 14l3.6-4"/><circle cx="12" cy="14.2" r="1.4" fill="currentColor" stroke="none"/><path d="M7.3 9.6l.9.9M12 6.4v1.3M16.7 9.6l-.9.9"/><path d="M3.5 21h17"/>
        </svg>
      }
      @case ('catalogo') {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>
        </svg>
      }
      @case ('clientes') {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="9" cy="8" r="3.5"/><path d="M2.8 20c0-3.6 2.8-6 6.2-6s6.2 2.4 6.2 6"/><path d="M16 4.8a3.2 3.2 0 0 1 0 6.1"/><path d="M18 14.3c2 .7 3.3 2.7 3.3 5.2"/>
        </svg>
      }
      @case ('vehiculos') {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 15.5V12.6a2 2 0 0 1 .5-1.3L6 8.2a2 2 0 0 1 1.5-.7h9a2 2 0 0 1 1.5.7l2.5 3.1a2 2 0 0 1 .5 1.3v2.9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/><path d="M3.3 12.2h17.4"/><circle cx="7.5" cy="18.4" r="1.8"/><circle cx="16.5" cy="18.4" r="1.8"/>
        </svg>
      }
      @case ('repuestos') {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2.8 20 7.4v9.2L12 21.2 4 16.6V7.4z"/><circle cx="12" cy="12" r="3.2"/>
        </svg>
      }
      @case ('proveedores') {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2.5" y="5.5" width="10.5" height="10" rx="1.6"/><path d="M13 9.2h4.1l3.4 3.4v2.9H13"/><circle cx="7" cy="18.4" r="1.9"/><circle cx="17" cy="18.4" r="1.9"/>
        </svg>
      }
      @case ('compras') {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5.5 8h13l1 12.5h-15z"/><path d="M9 8V7a3 3 0 0 1 6 0v1"/>
        </svg>
      }
      @case ('ventas') {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 3h12v18l-2-1.4L14 21l-2-1.4L10 21l-2-1.4L6 21z"/><path d="M9.5 8h5M9.5 12h5"/>
        </svg>
      }
      @case ('proformas') {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6.5 3h7.8L19 7.7V19a2 2 0 0 1-2 2H6.5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M14 3v5h5"/><path d="M8.5 13h7M8.5 17h4"/>
        </svg>
      }
      @case ('pagos') {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2.5" y="6" width="19" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.4v.01M18 14.6v.01"/>
        </svg>
      }
      @case ('comisiones') {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="7.5" cy="7.5" r="2.8"/><circle cx="16.5" cy="16.5" r="2.8"/><path d="M18.5 5.5 5.5 18.5"/>
        </svg>
      }
      @case ('usuarios') {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2.8 19.5 5.6v5.7c0 4.6-3.1 8.3-7.5 9.9-4.4-1.6-7.5-5.3-7.5-9.9V5.6z"/><circle cx="12" cy="10" r="2.4"/><path d="M7.9 16.4c.7-2 2.3-2.9 4.1-2.9s3.4.9 4.1 2.9"/>
        </svg>
      }
      @case ('reportes') {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3.5 20.5h17"/><rect x="5.2" y="11" width="3" height="6.5" rx="1"/><rect x="10.5" y="4.5" width="3" height="13" rx="1"/><rect x="15.8" y="8.5" width="3" height="9" rx="1"/>
        </svg>
      }
      @case ('auditoria') {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.4"/><path d="M3.5 3.8v4.6h4.6"/><path d="M12 7.5V12l3 1.8"/>
        </svg>
      }
      @case ('plantillas') {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 8h6M9 12h6M9 16h3"/>
        </svg>
      }
      @case ('completado') {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.5 2.5L16 9.5"/>
        </svg>
      }
      @case ('buscar') {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.4-4.4"/>
        </svg>
      }
      @case ('menu') {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 6h16M4 12h16M4 18h16"/>
        </svg>
      }
    }
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    svg {
      width: 19px;
      height: 19px;
      flex-shrink: 0;
    }
  `,
})
export class IconoMenu {
  readonly nombre = input.required<NombreIconoMenu>();
}
