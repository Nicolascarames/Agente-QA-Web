import type { LocatorEntry, ScenarioCandidate, Screen } from "agente-qa-contract";
import type { MapaCompleto } from "../shared/tipos";

export interface DiffMapa {
  pantallasNuevas: Screen[];
  localizadoresNuevos: { screenId: string; screenName: string; locator: LocatorEntry }[];
  escenariosNuevos: ScenarioCandidate[];
}

function screensDe(mapa: MapaCompleto | null): Screen[] {
  return mapa?.existe ? mapa.screens : [];
}

function scenariosDe(mapa: MapaCompleto | null): ScenarioCandidate[] {
  return mapa?.existe ? mapa.scenarios : [];
}

/** Compara el mapa capturado justo antes de lanzar una corrida con el mapa al terminarla, para
 * resaltar en la consola global qué pantallas, localizadores o candidatos de escenario son nuevos. */
export function diffMapa(antes: MapaCompleto | null, despues: MapaCompleto): DiffMapa {
  const screensAntes = screensDe(antes);
  const screensDespues = screensDe(despues);

  const idsAntes = new Set(screensAntes.map((pantalla) => pantalla.id));
  const pantallasNuevas = screensDespues.filter((pantalla) => !idsAntes.has(pantalla.id));

  const localizadoresNuevos: DiffMapa["localizadoresNuevos"] = [];
  for (const pantalla of screensDespues) {
    const pantallaAntes = screensAntes.find((p) => p.id === pantalla.id);
    if (!pantallaAntes) continue; // ya está contada como pantalla nueva
    const nombresAntes = new Set(pantallaAntes.locators.map((l) => l.name));
    for (const locator of pantalla.locators) {
      if (!nombresAntes.has(locator.name)) {
        localizadoresNuevos.push({ screenId: pantalla.id, screenName: pantalla.name, locator });
      }
    }
  }

  const idsEscenariosAntes = new Set(scenariosDe(antes).map((escenario) => escenario.id));
  const escenariosNuevos = scenariosDe(despues).filter((escenario) => !idsEscenariosAntes.has(escenario.id));

  return { pantallasNuevas, localizadoresNuevos, escenariosNuevos };
}
