// Agrupa `catalogoResuelto()` por pestaña, derivado del campo `ficha.pestana` — único punto donde
// se hace esta agrupación: `GuiaPestana` no filtra el catálogo a mano.
import { catalogoResuelto, type FichaResuelta } from "./catalogo";
import type { FichaComando } from "./tipos";

/** Id estable de una ficha: su ruta unida por espacios, igual que se escribiría en la consola
 *  (`["llm", "ping"]` → `"llm ping"`). */
export function idFicha(ficha: FichaComando): string {
  return ficha.ruta.join(" ");
}

function agrupar(): Map<string, FichaResuelta[]> {
  const mapa = new Map<string, FichaResuelta[]>();
  for (const resuelta of catalogoResuelto()) {
    const lista = mapa.get(resuelta.ficha.pestana) ?? [];
    lista.push(resuelta);
    mapa.set(resuelta.ficha.pestana, lista);
  }
  return mapa;
}

const PESTANAS = agrupar();

/** Fichas resueltas de una pestaña, en el orden del catálogo; vacío si no tiene ninguna. Atajo
 *  para quien (como `GuiaPestana`) necesita pintar la ficha entera. */
export function fichasDePestana(pestana: string): FichaResuelta[] {
  return PESTANAS.get(pestana) ?? [];
}
