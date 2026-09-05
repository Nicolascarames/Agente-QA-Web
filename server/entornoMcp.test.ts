import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buscarVariable, escribirVariable, leerEnv } from "./entornoMcp.js";

const NOMBRE_VAR = "ANTHROPIC_API_KEY";

describe("buscarVariable — precedencia entorno > proyecto > global", () => {
  let proyecto: string;
  let globalEnvPath: string;

  beforeEach(async () => {
    proyecto = await mkdtemp(path.join(tmpdir(), "agente-qa-web-entorno-proyecto-"));
    const carpetaGlobal = await mkdtemp(path.join(tmpdir(), "agente-qa-web-entorno-global-"));
    globalEnvPath = path.join(carpetaGlobal, ".env");
    delete process.env[NOMBRE_VAR];
  });

  afterEach(async () => {
    await rm(proyecto, { recursive: true, force: true });
    delete process.env[NOMBRE_VAR];
  });

  it("no encuentra nada si no está en ninguna capa", async () => {
    expect(await buscarVariable(NOMBRE_VAR, proyecto, globalEnvPath)).toBeUndefined();
  });

  it("usa la capa global si es la única que la tiene", async () => {
    await escribirVariable(NOMBRE_VAR, "clave-global", "global", proyecto, globalEnvPath);
    const resultado = await buscarVariable(NOMBRE_VAR, proyecto, globalEnvPath);
    expect(resultado).toEqual({ valor: "clave-global", capa: "global" });
  });

  it("el proyecto gana a la global", async () => {
    await escribirVariable(NOMBRE_VAR, "clave-global", "global", proyecto, globalEnvPath);
    await escribirVariable(NOMBRE_VAR, "clave-proyecto", "proyecto", proyecto, globalEnvPath);
    const resultado = await buscarVariable(NOMBRE_VAR, proyecto, globalEnvPath);
    expect(resultado).toEqual({ valor: "clave-proyecto", capa: "proyecto" });
  });

  it("el entorno gana a las otras dos", async () => {
    await escribirVariable(NOMBRE_VAR, "clave-global", "global", proyecto, globalEnvPath);
    await escribirVariable(NOMBRE_VAR, "clave-proyecto", "proyecto", proyecto, globalEnvPath);
    process.env[NOMBRE_VAR] = "clave-entorno";
    const resultado = await buscarVariable(NOMBRE_VAR, proyecto, globalEnvPath);
    expect(resultado).toEqual({ valor: "clave-entorno", capa: "entorno" });
  });
});

describe("escribirVariable — rechaza escribir sobre una variable que viene del entorno", () => {
  let proyecto: string;
  let globalEnvPath: string;

  beforeEach(async () => {
    proyecto = await mkdtemp(path.join(tmpdir(), "agente-qa-web-entorno-escribir-"));
    const carpetaGlobal = await mkdtemp(path.join(tmpdir(), "agente-qa-web-entorno-escribir-global-"));
    globalEnvPath = path.join(carpetaGlobal, ".env");
    delete process.env[NOMBRE_VAR];
  });

  afterEach(async () => {
    await rm(proyecto, { recursive: true, force: true });
    delete process.env[NOMBRE_VAR];
  });

  it("escribe en el .env de proyecto cuando no hay nada en el entorno", async () => {
    const resultado = await escribirVariable(NOMBRE_VAR, "nueva-clave", "proyecto", proyecto, globalEnvPath);
    expect(resultado).toEqual({ ok: true });
    expect(await buscarVariable(NOMBRE_VAR, proyecto, globalEnvPath)).toEqual({ valor: "nueva-clave", capa: "proyecto" });
  });

  it("rechaza la escritura si la variable ya viene de una variable de entorno del sistema", async () => {
    process.env[NOMBRE_VAR] = "clave-entorno";
    const resultado = await escribirVariable(NOMBRE_VAR, "otra-clave", "proyecto", proyecto, globalEnvPath);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.motivo).toContain("entorno");
    }
    // Nada se escribió: el .env de proyecto sigue vacío.
    expect(await leerEnv(path.join(proyecto, ".agente-qa", ".env"))).toEqual({});
  });
});
