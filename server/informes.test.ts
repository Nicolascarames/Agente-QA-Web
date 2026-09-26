import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { archivarUltimaEjecucion, generarInformeHtml, idInformeValido, listarInformes } from "./informes.js";
import type { ResumenInforme } from "../shared/tipos.js";

function reporteEjemplo(startTime: string, adjuntos: { path: string; name: string }[] = []) {
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

  it("un results.json corrupto no lanza", async () => {
    await mkdir(path.join(proyecto, "test-results"), { recursive: true });
    await writeFile(path.join(proyecto, "test-results", "results.json"), "{ esto no es json", "utf8");
    await expect(archivarUltimaEjecucion(proyecto, { historial: null })).resolves.toBeUndefined();
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
});
