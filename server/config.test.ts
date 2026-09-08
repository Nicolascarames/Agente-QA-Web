import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { projectPaths } from "agente-qa-contract/project";
import { escribirConfigProyecto, leerConfigProyecto } from "./config.js";

const CONFIG_JSON_VALIDO = {
  schemaVersion: 1,
  appUrl: "https://ejemplo.test",
  environment: "dev",
  limits: { maxIterations: 40, maxScreens: 25, maxCostUsd: 2 },
};

describe("config de proyecto", () => {
  let proyecto: string;
  let appDataTmp: string;

  beforeEach(async () => {
    proyecto = await mkdtemp(path.join(tmpdir(), "agente-qa-web-config-proyecto-"));
    appDataTmp = await mkdtemp(path.join(tmpdir(), "agente-qa-web-config-appdata-"));
    process.env.APPDATA = appDataTmp;
    delete process.env.APP_USERNAME;
    delete process.env.APP_PASSWORD;
  });

  afterEach(async () => {
    await rm(proyecto, { recursive: true, force: true });
    await rm(appDataTmp, { recursive: true, force: true });
    delete process.env.APP_USERNAME;
    delete process.env.APP_PASSWORD;
  });

  it("dice que no está inicializado si no hay .agente-qa/", async () => {
    const respuesta = await leerConfigProyecto(proyecto);
    expect(respuesta).toEqual({ inicializado: false });
  });

  it("lee appUrl/entorno/límites de config.json y nunca la contraseña completa", async () => {
    const paths = projectPaths(proyecto);
    await mkdir(paths.dir, { recursive: true });
    await writeFile(paths.configPath, JSON.stringify(CONFIG_JSON_VALIDO, null, 2), "utf8");
    await writeFile(paths.envPath, "APP_USERNAME=demo\nAPP_PASSWORD=super-secreta\n", "utf8");

    const respuesta = await leerConfigProyecto(proyecto);
    expect(respuesta.inicializado).toBe(true);
    if (!respuesta.inicializado) return;

    expect(respuesta.config.appUrl).toEqual({ valor: "https://ejemplo.test", capa: "proyecto", editable: true });
    expect(respuesta.config.credenciales.password).toEqual({ hayValor: true, ultimos4: "reta", capa: "proyecto", editable: true });
    expect(JSON.stringify(respuesta)).not.toContain("super-secreta");
  });

  it("escribirConfigProyecto rechaza tocar credenciales si vienen del entorno", async () => {
    const paths = projectPaths(proyecto);
    await mkdir(paths.dir, { recursive: true });
    await writeFile(paths.configPath, JSON.stringify(CONFIG_JSON_VALIDO, null, 2), "utf8");
    process.env.APP_USERNAME = "usuario-de-entorno";

    const resultado = await escribirConfigProyecto(proyecto, { credenciales: { usuario: "otro" } });
    expect(resultado.ok).toBe(false);
  });

  it("escribirConfigProyecto falla con un motivo si el proyecto no tiene .agente-qa/", async () => {
    const resultado = await escribirConfigProyecto(proyecto, { appUrl: "https://otra.test" });
    expect(resultado.ok).toBe(false);
  });

  // --- `llm` (Spec B, Bloque 1: una sola modalidad activa, ya no perfiles/roles/modo de coste) ---

  it("sin `llm` en config.json, no sintetiza una modalidad: `llm` viene ausente", async () => {
    const paths = projectPaths(proyecto);
    await mkdir(paths.dir, { recursive: true });
    await writeFile(paths.configPath, JSON.stringify(CONFIG_JSON_VALIDO, null, 2), "utf8");

    const respuesta = await leerConfigProyecto(proyecto);
    expect(respuesta.inicializado).toBe(true);
    if (!respuesta.inicializado) return;
    expect(respuesta.config.llm).toBeUndefined();
  });

  it("lee la modalidad api con proveedor y modelo ya guardados en config.json", async () => {
    const paths = projectPaths(proyecto);
    await mkdir(paths.dir, { recursive: true });
    await writeFile(
      paths.configPath,
      JSON.stringify({ ...CONFIG_JSON_VALIDO, llm: { modalidad: "api", proveedor: "anthropic", modelo: "claude-3-5-sonnet" } }, null, 2),
      "utf8"
    );

    const respuesta = await leerConfigProyecto(proyecto);
    expect(respuesta.inicializado).toBe(true);
    if (!respuesta.inicializado) return;
    expect(respuesta.config.llm).toEqual({ modalidad: "api", proveedor: "anthropic", modelo: "claude-3-5-sonnet" });
  });

  it("escribirConfigProyecto guarda la modalidad suscripcion sin proveedor ni modelo", async () => {
    const paths = projectPaths(proyecto);
    await mkdir(paths.dir, { recursive: true });
    await writeFile(paths.configPath, JSON.stringify(CONFIG_JSON_VALIDO, null, 2), "utf8");

    const resultado = await escribirConfigProyecto(proyecto, { llm: { modalidad: "suscripcion" } });
    expect(resultado.ok).toBe(true);

    const respuesta = await leerConfigProyecto(proyecto);
    expect(respuesta.inicializado).toBe(true);
    if (!respuesta.inicializado) return;
    expect(respuesta.config.llm).toEqual({ modalidad: "suscripcion", proveedor: null, modelo: null });
  });

  it("escribirConfigProyecto guarda la modalidad api con proveedor y modelo completos", async () => {
    const paths = projectPaths(proyecto);
    await mkdir(paths.dir, { recursive: true });
    await writeFile(paths.configPath, JSON.stringify(CONFIG_JSON_VALIDO, null, 2), "utf8");

    const resultado = await escribirConfigProyecto(proyecto, { llm: { modalidad: "api", proveedor: "openai", modelo: "gpt-4o" } });
    expect(resultado.ok).toBe(true);

    const respuesta = await leerConfigProyecto(proyecto);
    expect(respuesta.inicializado).toBe(true);
    if (!respuesta.inicializado) return;
    expect(respuesta.config.llm).toEqual({ modalidad: "api", proveedor: "openai", modelo: "gpt-4o" });
  });
});
