import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { acumularReporte, combinarConSpecsEnDisco, leerReporte, leerReporteUltimaCorrida, sugerirVeredicto } from "./reporter.js";
import type { ResultadoTest } from "../shared/tipos.js";

// Fixture con las tres formas que importan: un test verde, uno rojo por localizador roto y uno
// rojo por una aserción sobre un valor real que la web no da.
const REPORTE_FIXTURE = {
  suites: [
    {
      file: "carrito.spec.ts",
      specs: [
        {
          title: "añade un producto al carrito",
          file: "carrito.spec.ts",
          tests: [
            {
              results: [
                {
                  status: "passed",
                  duration: 812,
                  steps: [{ title: 'Dado que estoy en el inventario' }, { title: 'Cuando añado el producto' }],
                },
              ],
            },
          ],
        },
        {
          title: "el badge del carrito muestra el contador",
          file: "carrito.spec.ts",
          tests: [
            {
              results: [
                {
                  status: "failed",
                  duration: 5034,
                  error: { message: 'Timeout 5000ms exceeded while waiting for locator(".cart_badge")' },
                  steps: [{ title: "Cuando añado el producto", error: { message: "waiting for locator" } }],
                },
              ],
            },
          ],
        },
        {
          title: "el contador vale lo que la aplicación diga, no lo que se espera",
          file: "carrito.spec.ts",
          tests: [
            {
              results: [
                {
                  status: "failed",
                  duration: 340,
                  error: { message: 'expect(received).toHaveText(expected)\n\nExpected: "9"\nReceived: "1"' },
                  steps: [],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe("leerReporte", () => {
  let proyecto: string;

  beforeEach(async () => {
    proyecto = await mkdtemp(path.join(tmpdir(), "agente-qa-web-reporter-"));
  });

  afterEach(async () => {
    await rm(proyecto, { recursive: true, force: true });
  });

  it("[] si el fichero de reporte no existe todavía — nunca lanza", async () => {
    await expect(leerReporte(proyecto)).resolves.toEqual([]);
  });

  it("aplana los tres tests del fixture con su estado, pasos y mensaje de error", async () => {
    await mkdir(path.join(proyecto, "test-results"), { recursive: true });
    await writeFile(path.join(proyecto, "test-results", "results.json"), JSON.stringify(REPORTE_FIXTURE), "utf8");

    const resultados = await leerReporte(proyecto);

    expect(resultados).toHaveLength(3);

    const verde = resultados[0];
    expect(verde.estado).toBe("passed");
    expect(verde.mensajeError).toBeUndefined();
    expect(verde.pasos).toEqual([
      { titulo: "Dado que estoy en el inventario", estado: "passed" },
      { titulo: "Cuando añado el producto", estado: "passed" },
    ]);

    const localizadorRoto = resultados[1];
    expect(localizadorRoto.estado).toBe("failed");
    expect(localizadorRoto.mensajeError).toContain("waiting for locator");
    expect(localizadorRoto.pasos).toEqual([{ titulo: "Cuando añado el producto", estado: "failed" }]);

    const aplicacion = resultados[2];
    expect(aplicacion.estado).toBe("failed");
    expect(aplicacion.mensajeError).toContain("toHaveText");
  });
});

describe("acumularReporte / leerReporte (acumulado persistente entre corridas)", () => {
  let proyecto: string;

  beforeEach(async () => {
    proyecto = await mkdtemp(path.join(tmpdir(), "agente-qa-web-reporter-acumulado-"));
  });

  afterEach(async () => {
    await rm(proyecto, { recursive: true, force: true });
  });

  async function escribirUltimaCorrida(reporte: unknown): Promise<void> {
    await mkdir(path.join(proyecto, "test-results"), { recursive: true });
    await writeFile(path.join(proyecto, "test-results", "results.json"), JSON.stringify(reporte), "utf8");
  }

  it("sin test-results/results.json no toca el acumulado", async () => {
    await acumularReporte(proyecto);
    await expect(readFile(path.join(proyecto, "agente-qa.resultados.json"), "utf8")).rejects.toThrow();
  });

  it("fusiona por suite.file: la suite nueva reemplaza a la del acumulado, el resto se conserva", async () => {
    await escribirUltimaCorrida({
      suites: [{ file: "carrito.spec.ts", specs: [{ title: "v1", file: "carrito.spec.ts", tests: [{ results: [{ status: "failed" }] }] }] }],
    });
    await acumularReporte(proyecto);

    // Segunda corrida, de un solo spec (botón por fila): Playwright vacía test-results/ y este
    // results.json ya no trae carrito.spec.ts — sin la fusión, leerReporte lo perdería.
    await escribirUltimaCorrida({
      suites: [{ file: "login.spec.ts", specs: [{ title: "login ok", file: "login.spec.ts", tests: [{ results: [{ status: "passed" }] }] }] }],
    });
    await acumularReporte(proyecto);

    const acumulado = await leerReporte(proyecto);
    expect(acumulado).toHaveLength(2);
    expect(acumulado.find((r) => r.ficheroSpec === "carrito.spec.ts")?.estado).toBe("failed");
    expect(acumulado.find((r) => r.ficheroSpec === "login.spec.ts")?.estado).toBe("passed");

    // Tercera corrida: solo carrito.spec.ts, ahora en verde — reemplaza esa suite, login.spec.ts
    // (de la corrida anterior, ya fuera de test-results/) se conserva.
    await escribirUltimaCorrida({
      suites: [{ file: "carrito.spec.ts", specs: [{ title: "v1", file: "carrito.spec.ts", tests: [{ results: [{ status: "passed" }] }] }] }],
    });
    await acumularReporte(proyecto);

    const trasTerceraCorrida = await leerReporte(proyecto);
    expect(trasTerceraCorrida).toHaveLength(2);
    expect(trasTerceraCorrida.find((r) => r.ficheroSpec === "carrito.spec.ts")?.estado).toBe("passed");
    expect(trasTerceraCorrida.find((r) => r.ficheroSpec === "login.spec.ts")?.estado).toBe("passed");
  });

  it("leerReporte sigue viendo el acumulado aunque test-results/results.json ya no exista", async () => {
    await escribirUltimaCorrida(REPORTE_FIXTURE);
    await acumularReporte(proyecto);
    await rm(path.join(proyecto, "test-results"), { recursive: true, force: true });

    await expect(leerReporte(proyecto)).resolves.toHaveLength(3);
  });

  it("leerReporte cae a test-results/results.json si el acumulado todavía no existe (compatibilidad)", async () => {
    await escribirUltimaCorrida(REPORTE_FIXTURE);

    await expect(leerReporte(proyecto)).resolves.toHaveLength(3);
    await expect(leerReporteUltimaCorrida(proyecto)).resolves.toHaveLength(3);
  });
});

describe("combinarConSpecsEnDisco", () => {
  function resultadoDe(ficheroSpec: string, estado: ResultadoTest["estado"] = "passed"): ResultadoTest {
    return { nombre: "un test", ficheroSpec, estado, duracionMs: 10, reintentos: 0, pasos: [] };
  }

  it("añade como noEjecutado un .spec.ts en disco que no aparece en el reporte", () => {
    const filas = combinarConSpecsEnDisco([], ["login.spec.ts"]);
    expect(filas).toEqual([{ nombre: "login", ficheroSpec: "specs/login.spec.ts", estado: "noEjecutado", duracionMs: 0, reintentos: 0, pasos: [] }]);
  });

  it("no duplica un spec que ya tiene fila en el reporte", () => {
    const filas = combinarConSpecsEnDisco([resultadoDe("login.spec.ts")], ["login.spec.ts"]);
    expect(filas).toHaveLength(1);
    expect(filas[0].estado).toBe("passed");
  });

  it("quita del reporte un spec que ya no existe en disco (spec borrado)", () => {
    const filas = combinarConSpecsEnDisco([resultadoDe("borrado.spec.ts")], []);
    expect(filas).toEqual([]);
  });
});

function testCon(mensajeError: string | undefined, estado: ResultadoTest["estado"] = "failed"): ResultadoTest {
  return { nombre: "test", ficheroSpec: "spec.ts", estado, duracionMs: 0, reintentos: 0, mensajeError, pasos: [] };
}

describe("sugerirVeredicto", () => {
  it("desconocido si el test no está en rojo", () => {
    expect(sugerirVeredicto(testCon("da igual", "passed"))).toBe("desconocido");
  });

  it("desconocido si está en rojo pero sin mensaje de error", () => {
    expect(sugerirVeredicto(testCon(undefined))).toBe("desconocido");
  });

  it("fallo-test con un localizador roto (timeout esperando el elemento)", () => {
    const mensaje = 'Timeout 5000ms exceeded while waiting for locator(".cart_badge")';
    expect(sugerirVeredicto(testCon(mensaje))).toBe("fallo-test");
  });

  it("fallo-test con violación de modo estricto", () => {
    expect(sugerirVeredicto(testCon("strict mode violation: locator resolved to 2 elements"))).toBe("fallo-test");
  });

  it("fallo-aplicacion con una aserción sobre un valor real", () => {
    const mensaje = 'expect(received).toHaveText(expected)\n\nExpected: "9"\nReceived: "1"';
    expect(sugerirVeredicto(testCon(mensaje))).toBe("fallo-aplicacion");
  });

  it("desconocido si la aserción de valor va envuelta en un timeout de espera", () => {
    const mensaje = "Timeout 5000ms exceeded.\n\nexpect(locator).toHaveText(expected)";
    expect(sugerirVeredicto(testCon(mensaje))).toBe("desconocido");
  });
});
