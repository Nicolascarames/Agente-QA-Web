// Ejes efectivos de una ficha cuando el cajón de detalle (Bloque 4) o la consola asistida
// (Bloque 7) tienen el foco/ratón sobre una opción concreta. Función pura, sin estado ni React:
// así ambos bloques la comparten sin duplicar el merge.
import type { EjesFicha, FichaComando, OpcionEditorial } from "./tipos";

/**
 * Sin opción enfocada (`null`), los ejes de la ficha tal cual. Con una opción que redefine algún
 * eje (hoy solo `record --auto`, ver `OpcionEditorial.ejes`), un merge parcial: se sobrescribe
 * solo lo que esa opción toca y se conserva el resto — nunca se pierde un eje que la opción no
 * menciona.
 */
export function ejesConOpcion(ficha: FichaComando, opcionEnfocada: OpcionEditorial | null): EjesFicha {
  if (!opcionEnfocada?.ejes) return ficha.ejes;
  return { ...ficha.ejes, ...opcionEnfocada.ejes };
}
