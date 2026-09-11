import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import type { EstadoCorridaActiva, EstadoProyecto, EstadoProyectoActivo } from "../shared/tipos.js";

describe("buildApp", () => {
  let proyecto: string;

  beforeEach(async () => {
    proyecto = await mkdtemp(path.join(tmpdir(), "agente-qa-web-app-proyecto-"));
  });

  afterEach(async () => {
    await rm(proyecto, { recursive: true, force: true });
  });

  it("GET /api/estado deriva el estado del proyecto activo del disco", async () => {
    const app = buildApp({ proyectoInicial: proyecto });
    const respuesta = await app.inject({ method: "GET", url: "/api/estado" });
    expect(respuesta.statusCode).toBe(200);
    const cuerpo = respuesta.json<EstadoProyecto>();
    expect(cuerpo.proyecto).toBe(proyecto);
    expect(cuerpo.agenteQaInicializado).toBe(false);
    await app.close();
  });

  it("GET /api/actividad devuelve 501 explicando la dependencia del Bloque 1", async () => {
    const app = buildApp({ proyectoInicial: proyecto });
    const respuesta = await app.inject({ method: "GET", url: "/api/actividad" });
    expect(respuesta.statusCode).toBe(501);
    expect(respuesta.json<{ error: string }>().error).toContain("Bloque 1");
    await app.close();
  });

  it("GET /api/proyecto devuelve el proyecto activo, sin recientes (una instancia por repo)", async () => {
    const app = buildApp({ proyectoInicial: proyecto });
    const respuesta = await app.inject({ method: "GET", url: "/api/proyecto" });
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json<EstadoProyectoActivo>()).toEqual({ actual: proyecto });
    await app.close();
  });

  // --- Consola global (Bloque 2: vaciada) — rutas honestas sin nada detrás todavía ---------

  it("GET /api/corridas/activa dice honestamente que no hay ninguna corrida activa", async () => {
    const app = buildApp({ proyectoInicial: proyecto });
    const respuesta = await app.inject({ method: "GET", url: "/api/corridas/activa" });
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json<EstadoCorridaActiva>()).toEqual({ activa: false, runId: null });
    await app.close();
  });

  it("POST /api/comando devuelve 501: todavía no hay agente que lo ejecute", async () => {
    const app = buildApp({ proyectoInicial: proyecto });
    const respuesta = await app.inject({ method: "POST", url: "/api/comando", payload: { texto: "hola" } });
    expect(respuesta.statusCode).toBe(501);
    expect(respuesta.json<{ error: string }>().error).toContain("Bloque 4");
    await app.close();
  });

  it('POST /api/comando con "texto" vacío responde 400', async () => {
    const app = buildApp({ proyectoInicial: proyecto });
    const respuesta = await app.inject({ method: "POST", url: "/api/comando", payload: { texto: "  " } });
    expect(respuesta.statusCode).toBe(400);
    await app.close();
  });

  it("GET /api/eventos avisa de que no hay corrida activa y cierra", async () => {
    const app = buildApp({ proyectoInicial: proyecto });
    const respuesta = await app.inject({ method: "GET", url: "/api/eventos" });
    expect(respuesta.body).toContain("sin-corrida");
    await app.close();
  });
});
