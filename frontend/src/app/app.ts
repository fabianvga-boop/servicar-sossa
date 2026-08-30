import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { Avisos } from './shared/components/avisos';

/**
 * Raíz de la aplicación. Solo enruta y monta la pila de avisos, que debe
 * existir una sola vez y estar por encima de cualquier pantalla.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Avisos],
  template: `
    <router-outlet />
    <app-avisos />
  `,
})
export class App {}
