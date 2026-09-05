import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { projectPaths } from "agente-qa-contract/project";
import { leerEstadoProyecto } from "./estado.js";

const fixtureMapa = path.join(path.dirname(fileURLToPath(import.meta.url)), "__fixtures__", "map-valido.json");

describe("leerEstadoProyecto", () => {
  let proyecto: string;

  beforeEach(async () => {
    proyecto = await mkdtemp(path.join(tmpdir(), "agente-qa-web-proyecto-"));
  });

  afterEach(async () => {
    await rm(proyecto, { recursive: true, force: true });
  });

  it("dice que no hay .agente-qa/ en un proyecto vacío", async () => {
    const estado = await leerEstadoProyecto(proyecto);
    expect(estado.agenteQaInicializado).toBe(false);
    expect(estado.mapa.estado).toBe("no existe");
    expect(estado.features.estado).toBe("no existe");
    expect(estado.e2e.estado).toBe("no existe");
    expect(estado.reporte.estado).toBe("no existe");
  });

  it("cuenta pantallas, localizadores y candidatos de un map.json válido", async () => {
    const paths = projectPaths(proyecto);
    await mkdir(paths.mapDir, { recursive: true });
    const contenido = await readFile(fixtureMapa, "utf8");
    await writeFile(paths.mapPath, contenido, "utf8");

    const estado = await leerEstadoProyecto(proyecto);
    expect(estado.agenteQaInicializado).toBe(true);
    expect(estado.mapa).toEqual({
      estado: "listo",
      pantallas: 1,
      localizadores: 1,
      candidatosEscenario: 1,
    });
  });

  it("marca el mapa como borrador si el JSON no cumple el contrato", async () => {
    const paths = projectPaths(proyecto);
    await mkdir(paths.mapDir, { recursive: true });
    await writeFile(paths.mapPath, JSON.stringify({ schemaVersion: 4 }), "utf8");

    const estado = await leerEstadoProyecto(proyecto);
    expect(estado.mapa.estado).toBe("borrador");
  });

  it("cuenta ficheros .feature y marca listo si hay al menos uno", async () => {
    const paths = projectPaths(proyecto);
    await mkdir(paths.featuresDir, { recursive: true });
    await writeFile(path.join(paths.featuresDir, "login.feature"), "Feature: login\n", "utf8");

    const estado = await leerEstadoProyecto(proyecto);
    expect(estado.features).toEqual({ estado: "listo", ficheros: 1 });
  });
});
