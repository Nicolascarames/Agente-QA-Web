import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "./app.js";
import type { EventoAgente, SesionAgente } from "./agente.js";
import type { EstadoCorridaActiva, EstadoProyecto, EstadoProyectoActivo, RespuestaComando } from "../shared/tipos.js";

/**
 * Sesión falsa: nunca lanza el SDK real — lento y no determinista, igual que en `agente.test.ts`.
 * Devuelve también los mocks sueltos como variables: `expect(sesion.enviarMensaje)` dispara
 * `@typescript-eslint/unbound-method` por ser un acceso a método de objeto.
 */
function crearSesionFalsa(eventos: EventoAgente[] = []): {
  sesion: SesionAgente;
  enviarMensaje: ReturnType<typeof vi.fn>;
  interrumpir: ReturnType<typeof vi.fn>;
  parar: ReturnType<typeof vi.fn>;
  responderPregunta: ReturnType<typeof vi.fn>;
} {
  const enviarMensaje = vi.fn();
  const interrumpir = vi.fn(() => Promise.resolve(undefined));
  const parar = vi.fn();
  const responderPregunta = vi.fn();
  const sesion: SesionAgente = {
    suscribirse: () =>
      (async function* () {
        for (const evento of eventos) yield await Promise.resolve(evento);
      })(),
    enviarMensaje,
    interrumpir,
    parar,
    responderPregunta,
  };
  return { sesion, enviarMensaje, interrumpir, parar, responderPregunta };
}

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

  it('POST /api/comando con "texto" vacío responde 400', async () => {
    const app = buildApp({ proyectoInicial: proyecto });
    const respuesta = await app.inject({ method: "POST", url: "/api/comando", payload: { texto: "  " } });
    expect(respuesta.statusCode).toBe(400);
    await app.close();
  });

  it("POST /api/comando sin sesión activa lanza una nueva y devuelve su runId", async () => {
    const { sesion } = crearSesionFalsa();
    const lanzarFn = vi.fn(() => sesion);
    const app = buildApp({ proyectoInicial: proyecto, lanzarFn });
    const respuesta = await app.inject({ method: "POST", url: "/api/comando", payload: { texto: "hazme el page object del login" } });
    expect(respuesta.statusCode).toBe(200);
    expect(lanzarFn).toHaveBeenCalledWith("hazme el page object del login", { cwd: proyecto });
    expect(respuesta.json<RespuestaComando>().runId).toBeTruthy();
    await app.close();
  });

  it("POST /api/comando con sesión activa encola el mensaje en la misma sesión, sin lanzar otra", async () => {
    const { sesion, enviarMensaje } = crearSesionFalsa();
    const lanzarFn = vi.fn(() => sesion);
    const app = buildApp({ proyectoInicial: proyecto, lanzarFn });
    const primera = await app.inject({ method: "POST", url: "/api/comando", payload: { texto: "primero" } });
    const segunda = await app.inject({ method: "POST", url: "/api/comando", payload: { texto: "segundo" } });
    expect(lanzarFn).toHaveBeenCalledTimes(1);
    expect(enviarMensaje).toHaveBeenCalledWith("segundo");
    expect(segunda.json<RespuestaComando>().runId).toBe(primera.json<RespuestaComando>().runId);
    await app.close();
  });

  it("GET /api/eventos avisa de que no hay corrida activa y cierra", async () => {
    const app = buildApp({ proyectoInicial: proyecto });
    const respuesta = await app.inject({ method: "GET", url: "/api/eventos" });
    expect(respuesta.body).toContain("sin-corrida");
    await app.close();
  });

  it("GET /api/eventos con sesión activa reenvía sus eventos por SSE sin `event:` nombrado y cierra en terminal", async () => {
    const { sesion } = crearSesionFalsa([
      { type: "agente.asistente", data: { texto: "mirando la página" } },
      { type: "operation.completed", data: { resultado: "ok" } },
    ]);
    const app = buildApp({ proyectoInicial: proyecto, lanzarFn: () => sesion });
    await app.inject({ method: "POST", url: "/api/comando", payload: { texto: "hazlo" } });
    const respuesta = await app.inject({ method: "GET", url: "/api/eventos" });
    expect(respuesta.body).not.toContain("event:");
    expect(respuesta.body).toContain("agente.asistente");
    expect(respuesta.body).toContain("operation.completed");
    const activaTrasCerrar = await app.inject({ method: "GET", url: "/api/corridas/activa" });
    expect(activaTrasCerrar.json<EstadoCorridaActiva>().activa).toBe(false);
    await app.close();
  });

  it("POST /api/parar es idempotente: 200 tanto si hay sesión activa como si no", async () => {
    const appSinSesion = buildApp({ proyectoInicial: proyecto });
    expect((await appSinSesion.inject({ method: "POST", url: "/api/parar" })).statusCode).toBe(200);
    await appSinSesion.close();

    const { sesion, parar } = crearSesionFalsa();
    const app = buildApp({ proyectoInicial: proyecto, lanzarFn: () => sesion });
    await app.inject({ method: "POST", url: "/api/comando", payload: { texto: "hazlo" } });
    const respuesta = await app.inject({ method: "POST", url: "/api/parar" });
    expect(respuesta.statusCode).toBe(200);
    expect(parar).toHaveBeenCalled();
    await app.close();
  });

  it("POST /api/interrumpir responde 400 sin sesión activa, 200 y corta el turno con una activa", async () => {
    const appSinSesion = buildApp({ proyectoInicial: proyecto });
    const sinSesion = await appSinSesion.inject({ method: "POST", url: "/api/interrumpir" });
    expect(sinSesion.statusCode).toBe(400);
    expect(sinSesion.json<{ error: string }>().error).toContain("no hay ninguna corrida activa");
    await appSinSesion.close();

    const { sesion, interrumpir } = crearSesionFalsa();
    const app = buildApp({ proyectoInicial: proyecto, lanzarFn: () => sesion });
    await app.inject({ method: "POST", url: "/api/comando", payload: { texto: "hazlo" } });
    const respuesta = await app.inject({ method: "POST", url: "/api/interrumpir" });
    expect(respuesta.statusCode).toBe(200);
    expect(interrumpir).toHaveBeenCalled();
    await app.close();
  });

  it("POST /api/pregunta/responder responde 400 sin sesión activa, 200 y reenvía la respuesta con una activa", async () => {
    const appSinSesion = buildApp({ proyectoInicial: proyecto });
    const sinSesion = await appSinSesion.inject({ method: "POST", url: "/api/pregunta/responder", payload: { opcionesElegidas: ["A"] } });
    expect(sinSesion.statusCode).toBe(400);
    await appSinSesion.close();

    const { sesion, responderPregunta } = crearSesionFalsa();
    const app = buildApp({ proyectoInicial: proyecto, lanzarFn: () => sesion });
    await app.inject({ method: "POST", url: "/api/comando", payload: { texto: "hazlo" } });
    const respuesta = await app.inject({ method: "POST", url: "/api/pregunta/responder", payload: { opcionesElegidas: ["A"] } });
    expect(respuesta.statusCode).toBe(200);
    expect(responderPregunta).toHaveBeenCalledWith({ opcionesElegidas: ["A"] });
    await app.close();
  });
});
