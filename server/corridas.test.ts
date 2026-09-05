import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
import {
  construirArgsCorrida,
  detenerCorrida,
  enviarMensaje,
  hayCorridaActiva,
  historialActivo,
  lanzarCorrida,
  suscribirseAEventos,
  TIMEOUT_GRACIA_STOP_MS,
} from "./corridas.js";
import type { ResultadoLocalizarCli } from "./cli.js";
import type { EventoNdjson } from "../shared/tipos.js";

/**
 * Fake de `ChildProcess`: EventEmitter con stdout/stderr como sub-emitters. `escribirStdin` y
 * `matar` se devuelven aparte (no como métodos del objeto) para no disparar el lint de
 * `unbound-method` de typescript-eslint al usarlos sueltos en un `expect(...)`.
 */
function crearProcesoFake() {
  const escribirStdin = vi.fn();
  const matar = vi.fn();
  const proceso = new EventEmitter() as EventEmitter & Partial<ChildProcess>;
  proceso.stdout = new EventEmitter() as ChildProcess["stdout"];
  proceso.stderr = new EventEmitter() as ChildProcess["stderr"];
  proceso.stdin = { write: escribirStdin } as unknown as ChildProcess["stdin"];
  proceso.kill = matar as ChildProcess["kill"];
  return { proceso, escribirStdin, matar };
}

const LOCALIZADO_OK: ResultadoLocalizarCli = {
  encontrado: true,
  cli: { comando: "agente-qa-mcp", argsPrevios: [], origen: "PATH", ruta: "agente-qa-mcp" },
};

function lineaEvento(evento: Partial<EventoNdjson> & { runId: string; type: string }): string {
  const completo: EventoNdjson = { ts: new Date().toISOString(), agent: "mapeador-mcp", data: {}, ...evento };
  return `${JSON.stringify(completo)}\n`;
}

/**
 * `lanzarCorrida` registra el listener de `stdout` después de un `await` interno (localizar el
 * CLI): emitir datos en el mismo tick síncrono en que se llama los perdería. Deja pasar un tick
 * de verdad (no solo un microtask) para no depender de cuántos `await` internos tenga hoy.
 */
function esperarUnTick(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe("lanzarCorrida", () => {
  it("rechaza una segunda corrida mientras la primera sigue activa, sin matarla ni encolarla", async () => {
    const proyecto = "C:/proyectos/uno";
    const { proceso: proceso1, matar: matar1 } = crearProcesoFake();

    const p1 = lanzarCorrida(proyecto, ["snapshot", "http://x", "--json"], {
      localizarCli: () => Promise.resolve(LOCALIZADO_OK),
      spawnFn: vi.fn().mockReturnValue(proceso1),
    });

    const spawnFn2 = vi.fn();
    const r2 = await lanzarCorrida(proyecto, ["map", "--all", "--json"], {
      localizarCli: () => Promise.resolve(LOCALIZADO_OK),
      spawnFn: spawnFn2,
    });

    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.motivo).toContain("Ya hay una corrida activa");
    expect(spawnFn2).not.toHaveBeenCalled();
    expect(matar1).not.toHaveBeenCalled();

    // Cierra limpiamente la primera para no dejar handles colgando.
    proceso1.stdout?.emit("data", Buffer.from(lineaEvento({ runId: "run-1", type: "operation.started" })));
    const r1 = await p1;
    expect(r1.ok).toBe(true);
  });

  it("entrega el historial completo a quien se conecta tarde y sigue emitiendo en vivo", async () => {
    const proyecto = "C:/proyectos/dos";
    const { proceso } = crearProcesoFake();

    const p1 = lanzarCorrida(proyecto, ["map", "--goal", "explora", "--json"], {
      localizarCli: () => Promise.resolve(LOCALIZADO_OK),
      spawnFn: vi.fn().mockReturnValue(proceso),
    });

    await esperarUnTick();
    proceso.stdout?.emit("data", Buffer.from(lineaEvento({ runId: "run-2", type: "operation.started" })));
    await p1;
    proceso.stdout?.emit("data", Buffer.from(lineaEvento({ runId: "run-2", type: "map.screen.discovered", data: { id: "s1" } })));

    // "Se conecta tarde": lee el historial acumulado antes de suscribirse a lo nuevo.
    const historialTarde = historialActivo(proyecto);
    expect(historialTarde).toHaveLength(2);
    expect(historialTarde[1].type).toBe("map.screen.discovered");

    const recibidos: EventoNdjson[] = [];
    const cancelar = suscribirseAEventos(proyecto, (evento) => recibidos.push(evento));
    expect(cancelar).not.toBeNull();

    proceso.stdout?.emit("data", Buffer.from(lineaEvento({ runId: "run-2", type: "cost.update", data: { costUsd: 0.01 } })));
    expect(recibidos).toHaveLength(1);
    expect(recibidos[0].type).toBe("cost.update");

    // Termina la corrida para no dejar el estado activo entre tests.
    proceso.stdout?.emit("data", Buffer.from(lineaEvento({ runId: "run-2", type: "operation.completed" })));
  });

  it("control.stop escribe en el stdin del subproceso", async () => {
    const proyecto = "C:/proyectos/tres";
    const { proceso, escribirStdin, matar } = crearProcesoFake();

    const p1 = lanzarCorrida(proyecto, ["record", "http://x", "--json"], {
      localizarCli: () => Promise.resolve(LOCALIZADO_OK),
      spawnFn: vi.fn().mockReturnValue(proceso),
    });
    await esperarUnTick();
    proceso.stdout?.emit("data", Buffer.from(lineaEvento({ runId: "run-3", type: "operation.started" })));
    await p1;

    const resultado = detenerCorrida(proyecto);
    expect(resultado.ok).toBe(true);
    expect(escribirStdin).toHaveBeenCalledWith(`${JSON.stringify({ type: "control.stop" })}\n`);
    expect(TIMEOUT_GRACIA_STOP_MS).toBeGreaterThan(0);

    // Simula que el proceso obedeció y cerró solo: no debería llamarse kill().
    proceso.emit("close");
    expect(matar).not.toHaveBeenCalled();
  });

  it("limpia el estado de corrida activa cuando el proceso termina", async () => {
    const proyecto = "C:/proyectos/cuatro";
    const { proceso } = crearProcesoFake();

    const p1 = lanzarCorrida(proyecto, ["snapshot", "http://x", "--json"], {
      localizarCli: () => Promise.resolve(LOCALIZADO_OK),
      spawnFn: vi.fn().mockReturnValue(proceso),
    });
    await esperarUnTick();
    proceso.stdout?.emit("data", Buffer.from(lineaEvento({ runId: "run-4", type: "operation.started" })));
    await p1;
    expect(hayCorridaActiva(proyecto)).toBe(true);

    proceso.stdout?.emit("data", Buffer.from(lineaEvento({ runId: "run-4", type: "operation.completed" })));
    expect(hayCorridaActiva(proyecto)).toBe(false);
  });

  it("enviarMensaje escribe user.message en el stdin de la corrida activa", async () => {
    const proyecto = "C:/proyectos/seis";
    const { proceso, escribirStdin } = crearProcesoFake();

    const p1 = lanzarCorrida(proyecto, ["map", "--goal", "explora", "--json"], {
      localizarCli: () => Promise.resolve(LOCALIZADO_OK),
      spawnFn: vi.fn().mockReturnValue(proceso),
    });
    await esperarUnTick();
    proceso.stdout?.emit("data", Buffer.from(lineaEvento({ runId: "run-6", type: "operation.started" })));
    await p1;

    const resultado = enviarMensaje(proyecto, "deja eso, ve al carrito");
    expect(resultado.ok).toBe(true);
    expect(escribirStdin).toHaveBeenCalledWith(`${JSON.stringify({ type: "user.message", text: "deja eso, ve al carrito" })}\n`);

    proceso.stdout?.emit("data", Buffer.from(lineaEvento({ runId: "run-6", type: "operation.completed" })));
  });

  it("enviarMensaje sin corrida activa devuelve una señal clara, no una excepción", () => {
    const resultado = enviarMensaje("C:/proyectos/sin-corrida", "hola");
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.motivo).toContain("No hay ninguna corrida activa");
  });

  it("también limpia el estado si el proceso cierra sin un evento de fin explícito", async () => {
    const proyecto = "C:/proyectos/cinco";
    const { proceso } = crearProcesoFake();

    const p1 = lanzarCorrida(proyecto, ["snapshot", "http://x", "--json"], {
      localizarCli: () => Promise.resolve(LOCALIZADO_OK),
      spawnFn: vi.fn().mockReturnValue(proceso),
    });
    await esperarUnTick();
    proceso.stdout?.emit("data", Buffer.from(lineaEvento({ runId: "run-5", type: "operation.started" })));
    await p1;
    expect(hayCorridaActiva(proyecto)).toBe(true);

    proceso.emit("close");
    expect(hayCorridaActiva(proyecto)).toBe(false);
  });

  it("sintetiza operation.error y lo difunde a los suscriptores si el proceso cierra sin ningún evento terminal", async () => {
    const proyecto = "C:/proyectos/siete";
    const { proceso } = crearProcesoFake();

    const p1 = lanzarCorrida(proyecto, ["snapshot", "http://x", "--json"], {
      localizarCli: () => Promise.resolve(LOCALIZADO_OK),
      spawnFn: vi.fn().mockReturnValue(proceso),
    });
    await esperarUnTick();
    proceso.stdout?.emit("data", Buffer.from(lineaEvento({ runId: "run-7", type: "operation.started" })));
    await p1;

    const recibidos: EventoNdjson[] = [];
    suscribirseAEventos(proyecto, (evento) => recibidos.push(evento));

    // Muere sin emitir nunca operation.completed/stopped/error (p.ej. la puerta "instantanea", que
    // no lee control.stop del stdin, o un crash tras operation.started).
    proceso.emit("close");

    expect(recibidos).toHaveLength(1);
    expect(recibidos[0].type).toBe("operation.error");
    expect(hayCorridaActiva(proyecto)).toBe(false);
  });

  it("sintetiza operation.stopped en vez de operation.error si el cierre llega tras pedir detenerCorrida", async () => {
    const proyecto = "C:/proyectos/ocho";
    const { proceso } = crearProcesoFake();

    const p1 = lanzarCorrida(proyecto, ["snapshot", "http://x", "--json"], {
      localizarCli: () => Promise.resolve(LOCALIZADO_OK),
      spawnFn: vi.fn().mockReturnValue(proceso),
    });
    await esperarUnTick();
    proceso.stdout?.emit("data", Buffer.from(lineaEvento({ runId: "run-8", type: "operation.started" })));
    await p1;

    const recibidos: EventoNdjson[] = [];
    suscribirseAEventos(proyecto, (evento) => recibidos.push(evento));

    detenerCorrida(proyecto);
    // El proceso "obedece" pero cierra sin emitir ningún evento terminal por stdout antes de morir.
    proceso.emit("close");

    expect(recibidos).toHaveLength(1);
    expect(recibidos[0].type).toBe("operation.stopped");
  });
});

describe("construirArgsCorrida", () => {
  it("instantanea necesita url", () => {
    const sinUrl = construirArgsCorrida({ puerta: "instantanea" });
    expect(sinUrl.ok).toBe(false);
    if (!sinUrl.ok) expect(sinUrl.motivo).toContain("url");

    expect(construirArgsCorrida({ puerta: "instantanea", url: "http://x" })).toEqual({
      ok: true,
      args: ["snapshot", "http://x", "--json"],
    });
  });

  it("bucle-agentico con ámbito seleccion arma --units con las unidades", () => {
    expect(construirArgsCorrida({ puerta: "bucle-agentico", ambito: "seleccion", unidades: ["s1", "s2"] })).toEqual({
      ok: true,
      args: ["map", "--units", "s1,s2", "--json"],
    });
  });

  it("grabacion-conducida necesita url y objetivo", () => {
    const sinObjetivo = construirArgsCorrida({ puerta: "grabacion-conducida", url: "http://x" });
    expect(sinObjetivo.ok).toBe(false);
    if (!sinObjetivo.ok) expect(sinObjetivo.motivo).toContain("objetivo");

    expect(construirArgsCorrida({ puerta: "grabacion-conducida", url: "http://x", objetivo: "login" })).toEqual({
      ok: true,
      args: ["record", "http://x", "--auto", "login", "--json"],
    });
  });

  it("run necesita texto y arma la puerta del Bloque 6", () => {
    const sinTexto = construirArgsCorrida({ puerta: "run" });
    expect(sinTexto.ok).toBe(false);
    if (!sinTexto.ok) expect(sinTexto.motivo).toContain("texto");

    expect(construirArgsCorrida({ puerta: "run", texto: "explora el login" })).toEqual({
      ok: true,
      args: ["run", "explora el login", "--json"],
    });
  });
});
