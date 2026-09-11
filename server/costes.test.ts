import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { leerHistorial, registrarEjecucion } from "./costes.js";

describe("costes.ts", () => {
  let proyecto: string;

  beforeEach(async () => {
    proyecto = await mkdtemp(path.join(tmpdir(), "agente-qa-web-costes-"));
  });

  afterEach(async () => {
    await rm(proyecto, { recursive: true, force: true });
  });

  it("[] si el historial no existe todavía — nunca lanza", async () => {
    await expect(leerHistorial(proyecto)).resolves.toEqual([]);
  });

  it("[] si el JSON del historial está corrupto — nunca lanza", async () => {
    await writeFile(path.join(proyecto, "agente-qa.historial.json"), "{ esto no es json", "utf8");
    await expect(leerHistorial(proyecto)).resolves.toEqual([]);
  });

  it("registrarEjecucion añade una entrada con timestamp y se puede releer", async () => {
    await registrarEjecucion(proyecto, {
      costeUsd: 0.12,
      duracionMs: 4500,
      numTurnos: 2,
      resultados: [{ nombre: "añade un producto", ficheroSpec: "carrito.spec.ts", estado: "passed" }],
    });

    const historial = await leerHistorial(proyecto);
    expect(historial).toHaveLength(1);
    expect(historial[0]).toMatchObject({
      costeUsd: 0.12,
      duracionMs: 4500,
      numTurnos: 2,
      resultados: [{ nombre: "añade un producto", ficheroSpec: "carrito.spec.ts", estado: "passed" }],
    });
    expect(typeof historial[0].timestamp).toBe("string");
    expect(() => new Date(historial[0].timestamp).toISOString()).not.toThrow();
  });

  it("conserva solo las 200 entradas más recientes", async () => {
    for (let i = 0; i < 205; i++) {
      await registrarEjecucion(proyecto, { costeUsd: i, duracionMs: 0, numTurnos: 0, resultados: [] });
    }

    const historial = await leerHistorial(proyecto);
    expect(historial).toHaveLength(200);
    // Se descartan las más antiguas (costeUsd 0..4), quedan de la 5 a la 204.
    expect(historial[0].costeUsd).toBe(5);
    expect(historial[historial.length - 1].costeUsd).toBe(204);
  });

  it("cada llamada reescribe el fichero completo (no lo deja a medias entre lecturas)", async () => {
    await registrarEjecucion(proyecto, { costeUsd: 1, duracionMs: 1, numTurnos: 1, resultados: [] });
    await registrarEjecucion(proyecto, { costeUsd: 2, duracionMs: 2, numTurnos: 2, resultados: [] });

    const bruto = await readFile(path.join(proyecto, "agente-qa.historial.json"), "utf8");
    const registros: unknown[] = JSON.parse(bruto) as unknown[];
    expect(registros).toHaveLength(2);
  });
});
