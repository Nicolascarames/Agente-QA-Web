import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { leerEstadoProyecto } from "./estado.js";
import { projectPaths } from "./proyecto.js";

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
    expect(estado.features.estado).toBe("no existe");
    expect(estado.e2e.estado).toBe("no existe");
    expect(estado.reporte.estado).toBe("no existe");
  });

  it("cuenta ficheros .feature y marca listo si hay al menos uno", async () => {
    const paths = projectPaths(proyecto);
    await mkdir(paths.featuresDir, { recursive: true });
    await writeFile(path.join(paths.featuresDir, "login.feature"), "Feature: login\n", "utf8");

    const estado = await leerEstadoProyecto(proyecto);
    expect(estado.features).toEqual({ estado: "listo", ficheros: 1 });
  });
});
