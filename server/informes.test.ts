import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { archivarUltimaEjecucion, generarInformeHtml, idInformeValido, listarInformes } from "./informes.js";
import type { ResumenInforme } from "../shared/tipos.js";

function reporteEjemplo(startTime: string, adjuntos: { path?: string; name: string; contentType?: string; body?: string }[] = []) {
  return {
    stats: { startTime, duration: 1234 },
    suites: [
      {
        file: "specs/anadir-al-carrito.spec.ts",
        specs: [
          {
            title: "añade una mochila al carrito",
            file: "specs/anadir-al-carrito.spec.ts",
            tests: [{ results: [{ status: "passed", attachments: adjuntos }] }],
          },
        ],
      },
    ],
  };
}

describe("archivarUltimaEjecucion", () => {
  let proyecto: string;

  beforeEach(async () => {
    proyecto = await mkdtemp(path.join(tmpdir(), "agente-qa-web-informes-"));
  });

  afterEach(async () => {
    await rm(proyecto, { recursive: true, force: true });
  });

  it("no hace nada si test-results/results.json no existe", async () => {
    await archivarUltimaEjecucion(proyecto, { historial: null });
    await expect(readdir(path.join(proyecto, "agente-qa-informes")).catch(() => [])).resolves.toEqual([]);
  });

  it("archiva results.json, capturas y el resumen", async () => {
    const capturaAbs = path.join(proyecto, "captura-fallo.png");
    await writeFile(capturaAbs, Buffer.from([1, 2, 3]));
    await mkdir(path.join(proyecto, "test-results"), { recursive: true });
    await writeFile(
      path.join(proyecto, "test-results", "results.json"),
      JSON.stringify(reporteEjemplo("2026-09-26T10:15:30.000Z", [{ name: "agente-qa:validacion:Entonces veo el carrito", path: capturaAbs }])),
      "utf8",
    );

    await archivarUltimaEjecucion(proyecto, { historial: null });

    const base = path.join(proyecto, "agente-qa-informes", "2026-09-26_10-15-30");
    const resumen = JSON.parse(await readFile(path.join(base, "resumen.json"), "utf8")) as ResumenInforme;
    expect(resumen).toMatchObject({ id: "2026-09-26_10-15-30", verdes: 1, rojos: 0 });
    await expect(readFile(path.join(base, "capturas", "captura-fallo.png"))).resolves.toBeInstanceOf(Buffer);
    await expect(readFile(path.join(base, "informe.html"), "utf8")).resolves.toContain("<html");

    const gitignore = await readFile(path.join(proyecto, ".gitignore"), "utf8");
    expect(gitignore).toContain("agente-qa-informes/");
  });

  it("no duplica una ejecución ya archivada (llamable varias veces)", async () => {
    await mkdir(path.join(proyecto, "test-results"), { recursive: true });
    await writeFile(path.join(proyecto, "test-results", "results.json"), JSON.stringify(reporteEjemplo("2026-09-26T10:15:30.000Z")), "utf8");

    await archivarUltimaEjecucion(proyecto, { historial: null });
    await archivarUltimaEjecucion(proyecto, { historial: null });

    const entradas = await readdir(path.join(proyecto, "agente-qa-informes"));
    expect(entradas).toHaveLength(1);
  });

  it("poda hasta N ejecuciones cuando historial es un número", async () => {
    await mkdir(path.join(proyecto, "test-results"), { recursive: true });
    for (const hora of ["08", "09", "10"]) {
      await writeFile(path.join(proyecto, "test-results", "results.json"), JSON.stringify(reporteEjemplo(`2026-09-26T${hora}:00:00.000Z`)), "utf8");
      await archivarUltimaEjecucion(proyecto, { historial: 2 });
    }
    const entradas = (await readdir(path.join(proyecto, "agente-qa-informes"))).sort();
    expect(entradas).toEqual(["2026-09-26_09-00-00", "2026-09-26_10-00-00"]);
  });

  it("un startTime no parseable no genera una carpeta inlistable: cae a la hora actual", async () => {
    await mkdir(path.join(proyecto, "test-results"), { recursive: true });
    await writeFile(path.join(proyecto, "test-results", "results.json"), JSON.stringify(reporteEjemplo("no-es-una-fecha")), "utf8");

    await archivarUltimaEjecucion(proyecto, { historial: null });

    const entradas = await readdir(path.join(proyecto, "agente-qa-informes"));
    expect(entradas).toHaveLength(1);
    expect(idInformeValido(entradas[0] ?? "")).toBe(true);
    await expect(listarInformes(proyecto)).resolves.toHaveLength(1);
  });

  it("un results.json corrupto no lanza", async () => {
    await mkdir(path.join(proyecto, "test-results"), { recursive: true });
    await writeFile(path.join(proyecto, "test-results", "results.json"), "{ esto no es json", "utf8");
    await expect(archivarUltimaEjecucion(proyecto, { historial: null })).resolves.toBeUndefined();
  });

  it("el informe.html generado incluye el valor esperado de las validaciones", async () => {
    const capturaAbs = path.join(proyecto, "captura-carrito.png");
    await writeFile(capturaAbs, Buffer.from([1, 2, 3]));
    await mkdir(path.join(proyecto, "test-results"), { recursive: true });
    await writeFile(
      path.join(proyecto, "test-results", "results.json"),
      JSON.stringify(
        reporteEjemplo("2026-09-26T11:00:00.000Z", [
          { name: "agente-qa:validacion:Entonces veo el carrito", path: capturaAbs },
          { name: "agente-qa:validacion:Entonces veo el carrito:esperado", contentType: "text/plain", body: Buffer.from("Sauce Labs Backpack").toString("base64") },
        ]),
      ),
      "utf8",
    );

    await archivarUltimaEjecucion(proyecto, { historial: null });

    const html = await readFile(path.join(proyecto, "agente-qa-informes", "2026-09-26_11-00-00", "informe.html"), "utf8");
    expect(html).toContain("Sauce Labs Backpack");
  });
});

describe("listarInformes", () => {
  let proyecto: string;

  beforeEach(async () => {
    proyecto = await mkdtemp(path.join(tmpdir(), "agente-qa-web-informes-listar-"));
  });

  afterEach(async () => {
    await rm(proyecto, { recursive: true, force: true });
  });

  it("devuelve [] si no hay ninguna ejecución archivada", async () => {
    await expect(listarInformes(proyecto)).resolves.toEqual([]);
  });

  it("devuelve las ejecuciones de más reciente a más antigua", async () => {
    await mkdir(path.join(proyecto, "test-results"), { recursive: true });
    await writeFile(path.join(proyecto, "test-results", "results.json"), JSON.stringify(reporteEjemplo("2026-09-26T08:00:00.000Z")), "utf8");
    await archivarUltimaEjecucion(proyecto, { historial: null });
    await writeFile(path.join(proyecto, "test-results", "results.json"), JSON.stringify(reporteEjemplo("2026-09-26T09:00:00.000Z")), "utf8");
    await archivarUltimaEjecucion(proyecto, { historial: null });

    const informes = await listarInformes(proyecto);
    expect(informes.map((i) => i.id)).toEqual(["2026-09-26_09-00-00", "2026-09-26_08-00-00"]);
  });
});

describe("idInformeValido", () => {
  it("acepta el formato AAAA-MM-DD_HH-mm-ss", () => {
    expect(idInformeValido("2026-09-26_10-15-30")).toBe(true);
  });

  it("rechaza cualquier intento de path traversal", () => {
    expect(idInformeValido("..")).toBe(false);
    expect(idInformeValido("../../etc")).toBe(false);
    expect(idInformeValido("2026-09-26_10-15-30/../etc")).toBe(false);
  });
});

describe("generarInformeHtml", () => {
  it("incluye el título del test, el conteo de verdes/rojos y un <img> con ruta relativa", () => {
    const html = generarInformeHtml(reporteEjemplo("2026-09-26T10:15:30.000Z", [{ name: "agente-qa:validacion:Entonces veo el carrito", path: "/x/captura.png" }]), ["captura.png"]);
    expect(html).toContain("añade una mochila al carrito");
    expect(html).toContain("1 verdes");
    expect(html).toContain('src="capturas/captura.png"');
  });

  it("incluye el valor esperado de la validación cuando hay un adjunto :esperado", () => {
    const html = generarInformeHtml(
      reporteEjemplo("2026-09-26T10:15:30.000Z", [
        { name: "agente-qa:validacion:Entonces veo el carrito", path: "/x/captura.png" },
        { name: "agente-qa:validacion:Entonces veo el carrito:esperado", contentType: "text/plain", body: Buffer.from("Sauce Labs Backpack").toString("base64") },
      ]),
      ["captura.png"],
    );
    expect(html).toContain("Sauce Labs Backpack");
  });

  it("con 'validaciones' y 'pasos' a la vez del mismo título, muestra las DOS imágenes (validación primero)", () => {
    const html = generarInformeHtml(
      reporteEjemplo("2026-09-26T10:15:30.000Z", [
        { name: "agente-qa:validacion:Entonces veo el carrito", path: "/x/recuadrada.png" },
        { name: "agente-qa:paso:Entonces veo el carrito", path: "/x/completa.png" },
      ]),
      ["recuadrada.png", "completa.png"],
    );
    expect(html).toContain('src="capturas/recuadrada.png"');
    expect(html).toContain('src="capturas/completa.png"');
    expect(html.indexOf("recuadrada.png")).toBeLessThan(html.indexOf("completa.png"));
  });

  describe("pasos, errores y omitidos", () => {
    function reporteConTodo() {
      return {
        stats: { startTime: "2026-09-26T12:00:00.000Z", duration: 5000 },
        suites: [
          {
            file: "specs/a.spec.ts",
            specs: [
              {
                title: "test verde con pasos",
                file: "specs/a.spec.ts",
                tests: [
                  {
                    results: [
                      {
                        status: "passed",
                        steps: [
                          { title: "Dado que abro la tienda", duration: 120, steps: [{ title: "Navegar", duration: 45 }] },
                          { title: "Entonces veo el carrito", duration: 333 },
                        ],
                        attachments: [{ name: "agente-qa:validacion:Entonces veo el carrito", path: "/x/v.png" }],
                      },
                    ],
                  },
                ],
              },
              {
                title: "test que falla",
                file: "specs/a.spec.ts",
                tests: [
                  {
                    results: [
                      {
                        status: "failed",
                        errors: [{ message: `${String.fromCharCode(27)}[31mExpected <b>Backpack</b> & más${String.fromCharCode(27)}[39m` }],
                        attachments: [{ name: "agente-qa:fallo", path: "/x/fallo.png" }],
                      },
                    ],
                  },
                ],
              },
              { title: "test omitido", file: "specs/a.spec.ts", tests: [{ results: [{ status: "skipped" }] }] },
              { title: "test interrumpido", file: "specs/a.spec.ts", tests: [{ results: [{ status: "interrupted" }] }] },
            ],
          },
        ],
      };
    }

    it("muestra cada paso (también los anidados) con su duración y la captura bajo el paso que casa", () => {
      const html = generarInformeHtml(reporteConTodo(), ["v.png", "fallo.png"]);
      expect(html).toContain("Dado que abro la tienda");
      expect(html).toContain("120 ms");
      expect(html).toContain("Navegar");
      expect(html).toContain("45 ms");
      expect(html).toContain("333 ms");
      const pasoEntonces = html.indexOf("Entonces veo el carrito");
      expect(pasoEntonces).toBeGreaterThan(-1);
      expect(html.indexOf("v.png")).toBeGreaterThan(pasoEntonces);
    });

    it("una captura cuyo título no casa con ningún paso no se pierde", () => {
      const html = generarInformeHtml(reporteEjemplo("2026-09-26T10:15:30.000Z", [{ name: "agente-qa:validacion:Título huérfano", path: "/x/h.png" }]), ["h.png"]);
      expect(html).toContain("Título huérfano");
      expect(html).toContain('src="capturas/h.png"');
    });

    it("muestra el mensaje de error escapado antes de la captura de fallo", () => {
      const html = generarInformeHtml(reporteConTodo(), ["v.png", "fallo.png"]);
      expect(html).toContain("Expected &lt;b&gt;Backpack&lt;/b&gt; &amp; más");
      expect(html).not.toContain("<b>Backpack</b>");
      expect(html).not.toContain(String.fromCharCode(27));
      expect(html).toContain("<pre");
      expect(html.indexOf("Expected &lt;b&gt;")).toBeLessThan(html.indexOf("fallo.png"));
    });

    it("cabecera: total, verdes, rojos (failed + interrupted) y omitidos por separado", () => {
      const html = generarInformeHtml(reporteConTodo(), ["v.png", "fallo.png"]);
      expect(html).toContain("4 tests");
      expect(html).toContain("1 verdes");
      expect(html).toContain("2 rojos");
      expect(html).toContain("1 omitidos");
    });

    it("resumen.json cuenta los omitidos aparte de los rojos", async () => {
      const proyecto = await mkdtemp(path.join(tmpdir(), "agente-qa-web-informes-omitidos-"));
      try {
        await mkdir(path.join(proyecto, "test-results"), { recursive: true });
        await writeFile(path.join(proyecto, "test-results", "results.json"), JSON.stringify(reporteConTodo()), "utf8");
        await archivarUltimaEjecucion(proyecto, { historial: null });
        const resumen = JSON.parse(await readFile(path.join(proyecto, "agente-qa-informes", "2026-09-26_12-00-00", "resumen.json"), "utf8")) as ResumenInforme;
        expect(resumen).toMatchObject({ verdes: 1, rojos: 2, omitidos: 1 });
      } finally {
        await rm(proyecto, { recursive: true, force: true });
      }
    });
  });
});
