import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { projectPaths } from "agente-qa-contract/project";
import { escribirConfigGlobal, escribirConfigProyecto, leerConfigGlobal, leerConfigProyecto } from "./config.js";
import { nombreVarPerfilProveedor } from "./entornoMcp.js";

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
});

describe("config global — precedencia de capas", () => {
  let proyecto: string;
  let appDataTmp: string;

  beforeEach(async () => {
    proyecto = await mkdtemp(path.join(tmpdir(), "agente-qa-web-config-global-"));
    appDataTmp = await mkdtemp(path.join(tmpdir(), "agente-qa-web-config-global-appdata-"));
    process.env.APPDATA = appDataTmp;
    delete process.env.AGENTE_QA_MCP_RAPIDO_PROVIDER;
  });

  afterEach(async () => {
    await rm(proyecto, { recursive: true, force: true });
    await rm(appDataTmp, { recursive: true, force: true });
    delete process.env.AGENTE_QA_MCP_RAPIDO_PROVIDER;
  });

  it("sin nada configurado, el modo de coste y la tabla de roles caen a su valor de fábrica en capa global", async () => {
    const global = await leerConfigGlobal(proyecto);
    expect(global.modoCoste).toEqual({ valor: "equilibrado", capa: "global", editable: true });
    expect(global.roles["run-translate"]).toEqual({ valor: "rapido", capa: "global", editable: true });
    expect(global.perfiles.rapido.provider).toEqual({ valor: null, capa: null, editable: true });
  });

  it("la capa proyecto gana a la global para el proveedor de un perfil", async () => {
    await escribirConfigGlobal(proyecto, { perfiles: { rapido: { provider: "openai" } } });
    const paths = projectPaths(proyecto);
    await mkdir(paths.dir, { recursive: true });
    await writeFile(paths.envPath, `${nombreVarPerfilProveedor("rapido")}=anthropic\n`, "utf8");

    const global = await leerConfigGlobal(proyecto);
    expect(global.perfiles.rapido.provider).toEqual({ valor: "anthropic", capa: "proyecto", editable: true });
  });

  it("el entorno gana a proyecto y global, y queda marcado como no editable", async () => {
    process.env.AGENTE_QA_MCP_RAPIDO_PROVIDER = "groq";
    const global = await leerConfigGlobal(proyecto);
    expect(global.perfiles.rapido.provider).toEqual({ valor: "groq", capa: "entorno", editable: false });
  });

  it("escribirConfigGlobal rechaza tocar un perfil cuyo proveedor viene del entorno", async () => {
    process.env.AGENTE_QA_MCP_RAPIDO_PROVIDER = "groq";
    const resultado = await escribirConfigGlobal(proyecto, { perfiles: { rapido: { provider: "openai" } } });
    expect(resultado.ok).toBe(false);
  });

  it("escribirConfigGlobal con solo modoCoste no toca un perfil bloqueado por entorno", async () => {
    process.env.AGENTE_QA_MCP_RAPIDO_PROVIDER = "groq";
    const resultado = await escribirConfigGlobal(proyecto, { modoCoste: "ahorro" });
    expect(resultado.ok).toBe(true);

    const global = await leerConfigGlobal(proyecto);
    expect(global.modoCoste).toEqual({ valor: "ahorro", capa: "global", editable: true });
    expect(global.perfiles.rapido.provider).toEqual({ valor: "groq", capa: "entorno", editable: false });
  });
});
