import { describe, expect, it } from "vitest";
import type { LocatorEntry, Provenance, ScenarioCandidate, Screen } from "agente-qa-contract";
import { diffMapa } from "./diffMapa";
import type { MapaCompleto } from "../shared/tipos";

const TS_FIJO = "2026-01-01T00:00:00.000Z";
const PRODUCED_BY: Provenance = { agent: "mapeador-mcp", version: "0.1.0", at: TS_FIJO };
const MAPA_VACIO: MapaCompleto = { existe: false };

function locatorFake(overrides: Partial<LocatorEntry> & { name: string }): LocatorEntry {
  return {
    kind: "button",
    ts: `getByRole('button', { name: '${overrides.name}' })`,
    count: 1,
    producedBy: PRODUCED_BY,
    verifiedAt: TS_FIJO,
    ...overrides,
  };
}

function pantallaFake(overrides: Partial<Screen> & { id: string; name: string }): Screen {
  return {
    className: "PantallaFake",
    urlTemplate: "/fake",
    signature: `firma-${overrides.id}`,
    requiresAuth: false,
    stale: false,
    producedBy: PRODUCED_BY,
    texts: [],
    probeValues: [],
    validDataRecipe: [],
    locators: [],
    states: [],
    ambiguous: [],
    transitions: [],
    writeActions: [],
    ...overrides,
  };
}

function escenarioFake(overrides: Partial<ScenarioCandidate> & { id: string; title: string; screenId: string }): ScenarioCandidate {
  return { involvedScreens: [overrides.screenId], rationale: "", tags: [], producedBy: PRODUCED_BY, ...overrides };
}

describe("diffMapa", () => {
  it("con mapa anterior nulo, cuenta todas las pantallas del mapa final como nuevas", () => {
    const despues: MapaCompleto = { existe: true, screens: [pantallaFake({ id: "s1", name: "Login" })], scenarios: [] };
    expect(diffMapa(null, despues).pantallasNuevas).toEqual(despues.screens);
  });

  it("no repite como pantalla nueva una que ya existía antes", () => {
    const pantalla = pantallaFake({ id: "s1", name: "Login" });
    const antes: MapaCompleto = { existe: true, screens: [pantalla], scenarios: [] };
    const despues: MapaCompleto = { existe: true, screens: [pantalla], scenarios: [] };
    expect(diffMapa(antes, despues).pantallasNuevas).toEqual([]);
  });

  it("detecta un localizador nuevo dentro de una pantalla que ya existía", () => {
    const antes: MapaCompleto = {
      existe: true,
      screens: [pantallaFake({ id: "s1", name: "Login", locators: [locatorFake({ name: "email" })] })],
      scenarios: [],
    };
    const despues: MapaCompleto = {
      existe: true,
      screens: [pantallaFake({ id: "s1", name: "Login", locators: [locatorFake({ name: "email" }), locatorFake({ name: "password" })] })],
      scenarios: [],
    };
    expect(diffMapa(antes, despues).localizadoresNuevos).toEqual([
      { screenId: "s1", screenName: "Login", locator: locatorFake({ name: "password" }) },
    ]);
  });

  it("no reporta por separado los localizadores de una pantalla que ya es nueva", () => {
    const despues: MapaCompleto = {
      existe: true,
      screens: [pantallaFake({ id: "s1", name: "Login", locators: [locatorFake({ name: "email" })] })],
      scenarios: [],
    };
    expect(diffMapa(MAPA_VACIO, despues).localizadoresNuevos).toEqual([]);
  });

  it("detecta un candidato de escenario nuevo", () => {
    const despues: MapaCompleto = {
      existe: true,
      screens: [],
      scenarios: [escenarioFake({ id: "e1", title: "Login exitoso", screenId: "s1" })],
    };
    expect(diffMapa(MAPA_VACIO, despues).escenariosNuevos).toEqual(despues.scenarios);
  });
});
