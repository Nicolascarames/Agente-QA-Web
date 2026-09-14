// Pieza 2 de docs/superpowers/specs/2026-09-14-puertas-de-confirmacion-con-botones.md: el bloque
// que se añade al system prompt del agente (server/agente.ts) para que sepa cuántas veces debe
// parar a pedir confirmación con AskUserQuestion antes de seguir. Puro y testeable, mismo patrón
// que server/barrera.ts.
import type { PoliticaPuertas } from "../shared/tipos.js";

const TEXTOS: Record<PoliticaPuertas, string> = {
  escenario:
    "Política de confirmación: PARA UNA SOLA VEZ en todo el ciclo, tras escribir el `.feature` en " +
    "tests/features/, preguntando con AskUserQuestion. En cuanto confirmen, sigue solo — page " +
    "objects, spec y ejecución hasta el test en verde — sin volver a preguntar.",
  "escenario-y-codigo":
    "Política de confirmación: PARA DOS VECES, las dos con AskUserQuestion — (1) tras el `.feature`; " +
    "(2) tras escribir los `.page.ts` y el `.spec.ts` juntos, antes de ejecutar Playwright. Entre una " +
    "parada y la siguiente no preguntes nada más.",
  "por-artefacto":
    "Política de confirmación: PARA TRES VECES, las tres con AskUserQuestion — (1) tras el `.feature`; " +
    "(2) tras los `.page.ts`; (3) tras el `.spec.ts`, antes de ejecutarlo.",
  "por-fichero":
    "Política de confirmación: PARA en CADA fichero que escribas o modifiques bajo tests/ — incluidas " +
    "las correcciones de un test en rojo —, con AskUserQuestion, antes de seguir con el siguiente.",
};

/** Bloque que `server/agente.ts` concatena al `system prompt`, junto a `ROL_QA` y las credenciales,
 *  para que el agente sepa cuántas paradas exige la sesión activa. */
export function textoPoliticaPuertas(puertas: PoliticaPuertas): string {
  return `\n\n${TEXTOS[puertas]}`;
}
