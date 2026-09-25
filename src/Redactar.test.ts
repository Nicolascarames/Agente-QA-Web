import { describe, expect, it } from "vitest";
import { promptCorreccionCobertura } from "./Redactar";
import type { CoberturaEscenario } from "../shared/tipos";

function escenario(parcial: Partial<CoberturaEscenario> & Pick<CoberturaEscenario, "escenario" | "estado">): CoberturaEscenario {
  return { featureFichero: "anadir-al-carrito.feature", ...parcial };
}

describe("promptCorreccionCobertura", () => {
  it("un escenario desincronizado pide sincronizar el spec sin tocar el .feature", () => {
    const prompt = promptCorreccionCobertura("anadir-al-carrito.feature", [
      escenario({ escenario: "Añadir un producto al carrito", estado: "desincronizado", specFichero: "anadir-al-carrito.spec.ts" }),
    ]);
    expect(prompt).toContain(
      "El escenario «Añadir un producto al carrito» de tests/features/anadir-al-carrito.feature está desincronizado con tests/specs/anadir-al-carrito.spec.ts",
    );
    expect(prompt).toContain("El .feature es la referencia: no lo cambies.");
    expect(prompt).toContain("Ejecuta el test hasta que esté en verde.");
    expect(prompt).not.toContain("no tiene spec todavía");
  });

  it("un escenario no cubierto pide generar el spec siguiendo la skill", () => {
    const prompt = promptCorreccionCobertura("anadir-al-carrito.feature", [
      escenario({ escenario: "Vaciar el carrito", estado: "no-cubierto" }),
    ]);
    expect(prompt).toContain(
      "El escenario «Vaciar el carrito» de tests/features/anadir-al-carrito.feature no tiene spec todavía. Genera su page object y tests/specs/anadir-al-carrito.spec.ts siguiendo la skill.",
    );
    expect(prompt).toContain("Ejecuta el test hasta que esté en verde.");
    expect(prompt).not.toContain("desincronizado");
  });

  it("con mezcla de estados, agrupa primero los desincronizados y luego los no cubiertos", () => {
    const prompt = promptCorreccionCobertura("anadir-al-carrito.feature", [
      escenario({ escenario: "Vaciar el carrito", estado: "no-cubierto" }),
      escenario({ escenario: "Añadir un producto al carrito", estado: "desincronizado", specFichero: "anadir-al-carrito.spec.ts" }),
    ]);
    const posicionDesincronizado = prompt.indexOf("está desincronizado");
    const posicionNoCubierto = prompt.indexOf("no tiene spec todavía");
    expect(posicionDesincronizado).toBeGreaterThan(-1);
    expect(posicionNoCubierto).toBeGreaterThan(-1);
    expect(posicionDesincronizado).toBeLessThan(posicionNoCubierto);
    expect(prompt.trim().endsWith("Ejecuta el test hasta que esté en verde.")).toBe(true);
  });
});
