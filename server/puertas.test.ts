import { describe, expect, it } from "vitest";
import { textoPoliticaPuertas } from "./puertas.js";

describe("textoPoliticaPuertas", () => {
  it("la política por defecto (escenario) dice que para una sola vez y que el resto sigue solo", () => {
    const texto = textoPoliticaPuertas("escenario");
    expect(texto).toContain("PARA UNA SOLA VEZ");
    expect(texto).toContain("AskUserQuestion");
    expect(texto).toContain("sigue solo");
  });

  it("escenario-y-codigo dice que para dos veces: feature y código", () => {
    const texto = textoPoliticaPuertas("escenario-y-codigo");
    expect(texto).toContain("DOS VECES");
    expect(texto).toContain(".feature");
    expect(texto).toContain(".spec.ts");
  });

  it("por-artefacto dice que para tres veces", () => {
    expect(textoPoliticaPuertas("por-artefacto")).toContain("TRES VECES");
  });

  it("por-fichero dice que para en cada fichero, incluidas las correcciones", () => {
    const texto = textoPoliticaPuertas("por-fichero");
    expect(texto).toContain("CADA fichero");
    expect(texto).toContain("correcciones");
  });

  it("las cuatro políticas producen un texto distinto entre sí", () => {
    const politicas = ["escenario", "escenario-y-codigo", "por-artefacto", "por-fichero"] as const;
    const textos = politicas.map((p) => textoPoliticaPuertas(p));
    expect(new Set(textos).size).toBe(politicas.length);
  });
});
