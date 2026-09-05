import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { projectPaths } from "agente-qa-contract/project";
import { buildApp } from "./app.js";
import { enviarMensaje, hayCorridaActiva } from "./corridas.js";
import type { ResultadoLocalizarCli } from "./cli.js";
import type { EstadoProyecto, EstadoProyectoActivo, EventoNdjson, RespuestaMensaje } from "../shared/tipos.js";

const fixtureMapa = path.join(path.dirname(fileURLToPath(import.meta.url)), "__fixtures__", "map-valido.json");

// Solo `hayCorridaActiva`/`enviarMensaje` se espían (call-through por defecto): el resto del
// módulo (`lanzarCorrida`, `construirArgsCorrida`...) sigue siendo el real, así el camino
// "sin corrida activa lanza run" de abajo ejercita la lógica de verdad, no un doble.
vi.mock("./corridas.js", async (importOriginal) => {
  const real = await importOriginal<typeof import("./corridas.js")>();
  return { ...real, hayCorridaActiva: vi.fn(real.hayCorridaActiva), enviarMensaje: vi.fn(real.enviarMensaje) };
});

const LOCALIZADO_OK: ResultadoLocalizarCli = {
  encontrado: true,
  cli: { comando: "agente-qa-mcp", argsPrevios: [], origen: "PATH", ruta: "agente-qa-mcp" },
};

/** Mismo fake de `ChildProcess` que `corridas.test.ts`, para lanzar una corrida sin CLI real. */
function crearProcesoFake() {
  const escribirStdin = vi.fn();
  const proceso = new EventEmitter() as EventEmitter & Partial<ChildProcess>;
  proceso.stdout = new EventEmitter() as ChildProcess["stdout"];
  proceso.stderr = new EventEmitter() as ChildProcess["stderr"];
  proceso.stdin = { write: escribirStdin } as unknown as ChildProcess["stdin"];
  proceso.kill = vi.fn() as ChildProcess["kill"];
  return proceso;
}

function lineaEvento(evento: Partial<EventoNdjson> & { runId: string; type: string }): string {
  const completo: EventoNdjson = { ts: new Date().toISOString(), agent: "mapeador-mcp", data: {}, ...evento };
  return `${JSON.stringify(completo)}\n`;
}

describe("buildApp", () => {
  let proyecto: string;
  let appDataTmp: string;

  beforeEach(async () => {
    proyecto = await mkdtemp(path.join(tmpdir(), "agente-qa-web-app-proyecto-"));
    appDataTmp = await mkdtemp(path.join(tmpdir(), "agente-qa-web-app-appdata-"));
    process.env.APPDATA = appDataTmp;
  });

  afterEach(async () => {
    await rm(proyecto, { recursive: true, force: true });
    await rm(appDataTmp, { recursive: true, force: true });
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

  it("POST /api/proyecto cambia el proyecto activo y lo añade a recientes", async () => {
    const app = buildApp({ proyectoInicial: proyecto });
    const otro = await mkdtemp(path.join(tmpdir(), "agente-qa-web-app-otro-"));
    try {
      const respuesta = await app.inject({ method: "POST", url: "/api/proyecto", payload: { ruta: otro } });
      expect(respuesta.statusCode).toBe(200);
      const cuerpo = respuesta.json<EstadoProyectoActivo>();
      expect(cuerpo.actual).toBe(path.resolve(otro));
      expect(cuerpo.recientes).toContain(path.resolve(otro));

      const siguienteEstado = await app.inject({ method: "GET", url: "/api/estado" });
      expect(siguienteEstado.json<EstadoProyecto>().proyecto).toBe(path.resolve(otro));
    } finally {
      await app.close();
      await rm(otro, { recursive: true, force: true });
    }
  });

  it("POST /api/init responde con el resultado del subproceso aunque el binario no esté en PATH", async () => {
    const app = buildApp({ proyectoInicial: proyecto });
    const respuesta = await app.inject({ method: "POST", url: "/api/init" });
    // No asumimos que agente-qa-mcp esté instalado en el entorno de test: solo que
    // la ruta responde con una forma { codigo, stdout, stderr } y no revienta.
    const cuerpo = respuesta.json<{ codigo: number | null; stdout: string; stderr: string }>();
    expect(cuerpo).toHaveProperty("codigo");
    expect(cuerpo).toHaveProperty("stderr");
    await app.close();
  });

  describe("POST /api/mensaje", () => {
    afterEach(() => {
      vi.mocked(hayCorridaActiva).mockClear();
      vi.mocked(enviarMensaje).mockClear();
    });

    it("sin corrida activa, lanza run \"<texto>\" --json como una corrida nueva", async () => {
      const spawnFn = vi.fn().mockImplementation(() => {
        const proceso = crearProcesoFake();
        setImmediate(() => {
          proceso.stdout?.emit("data", Buffer.from(lineaEvento({ runId: "run-mensaje-1", type: "operation.started" })));
        });
        return proceso;
      });
      const app = buildApp({
        proyectoInicial: proyecto,
        opcionesCorridas: { spawnFn, localizarCli: () => Promise.resolve(LOCALIZADO_OK) },
      });

      const respuesta = await app.inject({ method: "POST", url: "/api/mensaje", payload: { texto: "explora el login" } });
      expect(respuesta.statusCode).toBe(200);
      expect(respuesta.json<RespuestaMensaje>()).toEqual({ runId: "run-mensaje-1" });
      expect(spawnFn).toHaveBeenCalledWith("agente-qa-mcp", ["run", "explora el login", "--json"], { cwd: proyecto });
      await app.close();
    });

    it("con la corrida activa terminada justo antes de escribir, responde con un error claro, no un 500 ni un silencio", async () => {
      vi.mocked(hayCorridaActiva).mockReturnValueOnce(true);
      vi.mocked(enviarMensaje).mockReturnValueOnce({ ok: false, motivo: "El proceso ya no existe." });
      const spawnFn = vi.fn();
      const app = buildApp({ proyectoInicial: proyecto, opcionesCorridas: { spawnFn } });

      const respuesta = await app.inject({ method: "POST", url: "/api/mensaje", payload: { texto: "deja eso, ve al carrito" } });
      expect(respuesta.statusCode).toBe(409);
      expect(respuesta.json<{ error: string }>().error).toContain("ya terminó");
      // No debe caer en el camino de "lanzar una corrida nueva": el mensaje no se pierde en silencio.
      expect(spawnFn).not.toHaveBeenCalled();
      await app.close();
    });
  });

  describe("PUT /api/mapa/localizador (Bloque 7)", () => {
    async function conMapaFixture(): Promise<void> {
      const paths = projectPaths(proyecto);
      await mkdir(paths.mapDir, { recursive: true });
      await writeFile(paths.mapPath, await readFile(fixtureMapa, "utf8"), "utf8");
    }

    it("escribe map.json con producedBy: {agent: \"web-manual\", ...} y devuelve el localizador corregido", async () => {
      await conMapaFixture();
      const app = buildApp({ proyectoInicial: proyecto });

      const respuesta = await app.inject({
        method: "PUT",
        url: "/api/mapa/localizador",
        payload: { screenId: "home", locatorName: "submitButton", kind: "button", ts: "page.getByTestId('enviar')" },
      });

      expect(respuesta.statusCode).toBe(200);
      const cuerpo = respuesta.json<{ ts: string; producedBy: { agent: string; version: string; at: string } }>();
      expect(cuerpo.ts).toBe("page.getByTestId('enviar')");
      expect(cuerpo.producedBy.agent).toBe("web-manual");

      const paths = projectPaths(proyecto);
      const mapaEscrito = JSON.parse(await readFile(paths.mapPath, "utf8")) as {
        screens: { id: string; locators: { name: string; ts: string; producedBy: { agent: string } }[] }[];
      };
      const localizador = mapaEscrito.screens[0].locators.find((l) => l.name === "submitButton");
      expect(localizador?.ts).toBe("page.getByTestId('enviar')");
      expect(localizador?.producedBy.agent).toBe("web-manual");

      await app.close();
    });

    it("rechaza un body que deja el AppMap inválido, sin escribir nada a disco", async () => {
      await conMapaFixture();
      const app = buildApp({ proyectoInicial: proyecto });
      const paths = projectPaths(proyecto);
      const antes = await readFile(paths.mapPath, "utf8");

      const respuesta = await app.inject({
        method: "PUT",
        url: "/api/mapa/localizador",
        payload: { screenId: "home", locatorName: "submitButton", kind: "no-es-un-kind-valido", ts: "page.getByRole('button')" },
      });

      expect(respuesta.statusCode).toBe(400);
      expect(respuesta.json<{ error: string }>().error).toBeTruthy();
      expect(await readFile(paths.mapPath, "utf8")).toBe(antes);

      await app.close();
    });

    it("rechaza referenciar una pantalla o un localizador que no existe", async () => {
      await conMapaFixture();
      const app = buildApp({ proyectoInicial: proyecto });
      const paths = projectPaths(proyecto);
      const antes = await readFile(paths.mapPath, "utf8");

      const respuestaPantalla = await app.inject({
        method: "PUT",
        url: "/api/mapa/localizador",
        payload: { screenId: "no-existe", locatorName: "submitButton", kind: "button", ts: "page.getByRole('button')" },
      });
      expect(respuestaPantalla.statusCode).toBe(400);
      expect(respuestaPantalla.json<{ error: string }>().error).toContain("no-existe");

      const respuestaLocalizador = await app.inject({
        method: "PUT",
        url: "/api/mapa/localizador",
        payload: { screenId: "home", locatorName: "no-existe", kind: "button", ts: "page.getByRole('button')" },
      });
      expect(respuestaLocalizador.statusCode).toBe(400);
      expect(respuestaLocalizador.json<{ error: string }>().error).toContain("no-existe");

      expect(await readFile(paths.mapPath, "utf8")).toBe(antes);
      await app.close();
    });
  });
});
