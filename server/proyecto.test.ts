import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { anadirReciente, leerRecientes, resolverProyectoInicial } from "./proyecto.js";

describe("resolverProyectoInicial", () => {
  it("usa --project del argv si viene", () => {
    const resuelto = resolverProyectoInicial(["node", "index.js", "--project", "C:/proyectos/mi-app"], "C:/otra", {});
    expect(resuelto).toBe(path.resolve("C:/proyectos/mi-app"));
  });

  it("cae a AGENTE_QA_PROJECT si no hay --project en argv", () => {
    const resuelto = resolverProyectoInicial(["node", "index.js"], "C:/otra", { AGENTE_QA_PROJECT: "C:/proyectos/dev" });
    expect(resuelto).toBe(path.resolve("C:/proyectos/dev"));
  });

  it("cae a cwd si no hay ni argv ni env", () => {
    const resuelto = resolverProyectoInicial(["node", "index.js"], "C:/cwd", {});
    expect(resuelto).toBe("C:/cwd");
  });
});

describe("recientes", () => {
  let appDataTmp: string;

  beforeEach(async () => {
    appDataTmp = await mkdtemp(path.join(tmpdir(), "agente-qa-web-appdata-"));
    process.env.APPDATA = appDataTmp;
  });

  afterEach(async () => {
    await rm(appDataTmp, { recursive: true, force: true });
  });

  it("empieza vacía si no hay fichero", async () => {
    expect(await leerRecientes()).toEqual([]);
  });

  it("añade un proyecto y lo persiste", async () => {
    const nuevos = await anadirReciente("C:/proyectos/uno");
    expect(nuevos).toEqual(["C:/proyectos/uno"]);
    expect(await leerRecientes()).toEqual(["C:/proyectos/uno"]);
  });

  it("mueve un proyecto repetido al principio sin duplicarlo", async () => {
    await anadirReciente("C:/proyectos/uno");
    await anadirReciente("C:/proyectos/dos");
    const nuevos = await anadirReciente("C:/proyectos/uno");
    expect(nuevos).toEqual(["C:/proyectos/uno", "C:/proyectos/dos"]);
  });
});
