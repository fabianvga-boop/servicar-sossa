import { Pipe, PipeTransform } from '@angular/core';

/**
 * Formatea montos en bolivianos: `1234.5` → `Bs 1.234,50`.
 * El taller opera en Bs, así que el símbolo es fijo.
 */
@Pipe({ name: 'bs' })
export class BolivianosPipe implements PipeTransform {
  private static readonly formato = new Intl.NumberFormat('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  transform(valor: number | null | undefined, conSimbolo = true): string {
    const numero = valor ?? 0;
    const texto = BolivianosPipe.formato.format(numero);

    return conSimbolo ? `Bs ${texto}` : texto;
  }
}
