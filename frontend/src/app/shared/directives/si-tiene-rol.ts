import { Directive, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';

import { Rol } from '../../core/models/enums';
import { AuthService } from '../../core/services/auth.service';

/**
 * Directiva estructural de permisos (CAPA 5): quita el elemento del DOM —no
 * solo lo oculta con CSS ni con `disabled`— cuando el usuario actual no
 * tiene ninguno de los roles indicados.
 *
 *   <button *appSiRol="['Administrador']" (click)="anular()">Anular</button>
 *
 * Nota igual que en `authGuard`: el control real sigue siendo el backend
 * (`[Authorize(Roles = ...)]`). Un botón invisible es mejor UX que uno
 * deshabilitado que un mecánico ve y se pregunta por qué no puede tocar,
 * pero no reemplaza la autorización del servidor — quien manda es la API.
 */
@Directive({
  selector: '[appSiRol]',
})
export class SiTieneRol {
  private readonly plantilla = inject(TemplateRef<unknown>);
  private readonly contenedor = inject(ViewContainerRef);
  private readonly auth = inject(AuthService);

  private creada = false;

  readonly appSiRol = input.required<Rol[]>();

  constructor() {
    // `effect` reacciona a cambios de rol en caliente (por ejemplo, si en el
    // futuro se agrega un cambio de rol sin recargar la página).
    effect(() => {
      const permitido = this.auth.tieneRol(this.appSiRol());

      if (permitido && !this.creada) {
        this.contenedor.createEmbeddedView(this.plantilla);
        this.creada = true;
      } else if (!permitido && this.creada) {
        this.contenedor.clear();
        this.creada = false;
      }
    });
  }
}
