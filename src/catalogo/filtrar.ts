// Lógica pura de los filtros de la guía (Bloque 5): los chips de eje y la caja de texto. Sin JSX
// ni estado — la vista (`FiltrosGuia.tsx`, `GuiaPestana.tsx`) solo pinta y guarda el `CriterioFiltro`
// actual; aquí vive la única regla que decide qué ficha pasa.
//
// Semántica, para que nadie la improvise: OR dentro de un mismo eje, AND entre ejes. Marcar
// "humano" y "claude-code" (ambos del eje conductor) enseña las dos; marcar además "cero" (eje
// coste) enseña solo las que sean humano-o-claude-code que además sean de coste cero.
import type { FichaResuelta } from "./catalogo";
import type { Conductor, Coste, Estado } from "./tipos";

export interface CriterioFiltro {
  conductor: Conductor[];
  coste: Coste[];
  estado: Estado[];
  /** Busca en nombre, resumen, prosa de "Qué hace", nombres de opciones y palabrasClave. */
  texto: string;
}

export function criterioVacio(): CriterioFiltro {
  return { conductor: [], coste: [], estado: [], texto: "" };
}

/** Falso si el criterio no descarta nada (ningún chip marcado y caja de texto vacía). */
export function hayFiltroActivo(criterio: CriterioFiltro): boolean {
  return criterio.conductor.length > 0 || criterio.coste.length > 0 || criterio.estado.length > 0 || criterio.texto.trim() !== "";
}

// Sin chips marcados en un eje, ese eje no descarta nada (equivalente a "todos" seleccionados).
function cumpleEje<T>(valor: T, seleccionados: T[]): boolean {
  return seleccionados.length === 0 || seleccionados.includes(valor);
}

function cumpleTexto(resuelta: FichaResuelta, textoNormalizado: string): boolean {
  if (!textoNormalizado) return true;
  const { ficha } = resuelta;
  const campos = [ficha.ruta.join(" "), ficha.unaLinea, ...ficha.queHace, ...Object.keys(ficha.opciones), ...ficha.palabrasClave];
  return campos.some((campo) => campo.toLowerCase().includes(textoNormalizado));
}

export function filtrarFichas(fichas: FichaResuelta[], criterio: CriterioFiltro): FichaResuelta[] {
  const textoNormalizado = criterio.texto.trim().toLowerCase();
  return fichas.filter(
    (resuelta) =>
      cumpleEje(resuelta.ficha.ejes.conductor, criterio.conductor) &&
      cumpleEje(resuelta.ficha.ejes.coste, criterio.coste) &&
      cumpleEje(resuelta.ficha.ejes.estado, criterio.estado) &&
      cumpleTexto(resuelta, textoNormalizado),
  );
}
