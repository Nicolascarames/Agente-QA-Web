// Mismo patrón de inyección de dependencias que `doctor.test.ts`: un `queryFn` falso construido a
// mano en vez de lanzar un CLI de verdad — lento y no determinista.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { query } from "@anthropic-ai/claude-agent-sdk";
import type { CanUseTool, Query, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { lanzar, type EventoAgente } from "./agente.js";
import { leerHistorial } from "./costes.js";

function generadorDe(mensajes: SDKMessage[]): AsyncGenerator<SDKMessage, void> {
  return (async function* () {
    for (const mensaje of mensajes) yield await Promise.resolve(mensaje);
  })();
}

/** `queryFn` falsa: ignora `prompt`/`options.mcpServers`/etc., solo devuelve los mensajes dados
 *  como si fueran la salida de `query()`, y opcionalmente captura el `canUseTool` que le pasa `lanzar()`. */
function queryFnFalsa(mensajes: SDKMessage[], capturarCanUseTool?: (fn: CanUseTool) => void): typeof query {
  return (params) => {
    if (capturarCanUseTool && params.options?.canUseTool) capturarCanUseTool(params.options.canUseTool);
    return Object.assign(generadorDe(mensajes), { interrupt: () => Promise.resolve(undefined) }) as unknown as Query;
  };
}

/**
 * `queryFn` falsa que nunca produce un mensaje: se queda colgada hasta que el `abortController`
 * que `lanzar()` le pasa en `options` se aborta, momento en el que RECHAZA — igual que hace el SDK
 * real (comprobado en manual contra `pruebas/sauce`: `abortController.abort()` no termina el
 * `Query` limpio, lo rechaza con "Operation aborted").
 */
function queryFnFalsaQueCuelgaHastaAbortar(): typeof query {
  return (params) => {
    async function* gen(): AsyncGenerator<SDKMessage, void> {
      await new Promise<void>((_resolve, reject) => {
        params.options?.abortController?.signal.addEventListener("abort", () => {
          reject(new Error("Operation aborted"));
        });
      });
    }
    return Object.assign(gen(), { interrupt: () => Promise.resolve(undefined) }) as unknown as Query;
  };
}

describe("lanzar", () => {
  it("traduce mensajes a eventos y cierra en operation.completed cuando queued_turn_count es 0", async () => {
    const mensajeAsistente = { type: "assistant", message: {}, parent_tool_use_id: null, uuid: "u1", session_id: "s1" } as unknown as SDKMessage;
    const mensajeResultado = { type: "result", subtype: "success", is_error: false, queued_turn_count: 0, result: "ok" } as unknown as SDKMessage;

    const sesion = lanzar("hazme el page object del login", { cwd: "/tmp", queryFn: queryFnFalsa([mensajeAsistente, mensajeResultado]) });

    const eventos: EventoAgente[] = [];
    for await (const evento of sesion.suscribirse()) eventos.push(evento);

    expect(eventos.map((e) => e.type)).toEqual(["agente.assistant", "operation.completed"]);
  });

  it("emite operation.error en vez de operation.completed cuando el result trae is_error", async () => {
    const mensajeResultado = { type: "result", subtype: "error_during_execution", is_error: true, queued_turn_count: 0 } as unknown as SDKMessage;

    const sesion = lanzar("algo que falla", { cwd: "/tmp", queryFn: queryFnFalsa([mensajeResultado]) });

    const eventos: EventoAgente[] = [];
    for await (const evento of sesion.suscribirse()) eventos.push(evento);

    expect(eventos.map((e) => e.type)).toEqual(["operation.error"]);
  });

  it("con queued_turn_count > 0 no cierra: informa y sigue leyendo del mismo Query", async () => {
    const resultadoEncolado = { type: "result", subtype: "success", is_error: false, queued_turn_count: 1, result: "" } as unknown as SDKMessage;
    const resultadoFinal = { type: "result", subtype: "success", is_error: false, queued_turn_count: 0, result: "ok" } as unknown as SDKMessage;

    const sesion = lanzar("petición larga", { cwd: "/tmp", queryFn: queryFnFalsa([resultadoEncolado, resultadoFinal]) });

    const eventos: EventoAgente[] = [];
    for await (const evento of sesion.suscribirse()) eventos.push(evento);

    expect(eventos.map((e) => e.type)).toEqual(["agente.turno", "operation.completed"]);
  });

  it("AskUserQuestion vía canUseTool queda pendiente hasta que responderPregunta() la desbloquea", async () => {
    let canUseToolCapturada: CanUseTool | undefined;
    const sesion = lanzar("hazme un test del menú", {
      cwd: "/tmp",
      queryFn: queryFnFalsa([], (fn) => {
        canUseToolCapturada = fn;
      }),
    });
    expect(canUseToolCapturada).toBeDefined();

    const questions = [
      {
        question: "¿Qué menú?",
        header: "Menú",
        options: [
          { label: "Principal", description: "" },
          { label: "Lateral", description: "" },
        ],
      },
    ];
    // Suscrito antes de disparar canUseTool: con difusión (fan-out) un suscriptor solo ve los
    // eventos emitidos después de suscribirse, igual que en producción (GET /api/eventos llega
    // después de que POST /api/comando haya lanzado la sesión).
    const suscripcion = sesion.suscribirse();
    const promesaPermiso = canUseToolCapturada!(
      "AskUserQuestion",
      { questions },
      { signal: new AbortController().signal, toolUseID: "t1", requestId: "r1" }
    );

    const eventos: EventoAgente[] = [];
    for await (const evento of suscripcion) {
      eventos.push(evento);
      if (evento.type === "agente.pregunta") break;
    }
    expect(eventos[0]).toEqual({ type: "agente.pregunta", data: { requestId: "r1", questions } });

    sesion.responderPregunta({ opcionesElegidas: ["Principal"] });
    const resultado = await promesaPermiso;

    // `behavior: "deny"` + `message`, no `allow` + `updatedInput`: comprobado en manual contra
    // pruebas/sauce que solo el canal de denegación llega al modelo (ver comentario en agente.ts).
    expect(resultado).toEqual({
      behavior: "deny",
      message: expect.stringContaining("Principal") as string,
    });
  });

  it("parar() aborta y emite operation.stopped en vez de dejar sin atrapar el rechazo del Query", async () => {
    const sesion = lanzar("algo largo", { cwd: "/tmp", queryFn: queryFnFalsaQueCuelgaHastaAbortar() });

    const eventosPromise = (async () => {
      const eventos: EventoAgente[] = [];
      for await (const evento of sesion.suscribirse()) eventos.push(evento);
      return eventos;
    })();

    sesion.parar();

    await expect(eventosPromise).resolves.toEqual([{ type: "operation.stopped", data: null }]);
  });

  it("dos suscriptores sobre la misma sesión reciben el mismo stream completo, no se lo reparten", async () => {
    const mensajeAsistente = { type: "assistant", message: {}, parent_tool_use_id: null, uuid: "u1", session_id: "s1" } as unknown as SDKMessage;
    const mensajeResultado = { type: "result", subtype: "success", is_error: false, queued_turn_count: 0, result: "ok" } as unknown as SDKMessage;

    const sesion = lanzar("hazme el page object del login", { cwd: "/tmp", queryFn: queryFnFalsa([mensajeAsistente, mensajeResultado]) });
    const suscripcionA = sesion.suscribirse();
    const suscripcionB = sesion.suscribirse();

    const eventosA: EventoAgente[] = [];
    const eventosB: EventoAgente[] = [];
    await Promise.all([
      (async () => {
        for await (const evento of suscripcionA) eventosA.push(evento);
      })(),
      (async () => {
        for await (const evento of suscripcionB) eventosB.push(evento);
      })(),
    ]);

    expect(eventosA.map((e) => e.type)).toEqual(["agente.assistant", "operation.completed"]);
    expect(eventosB.map((e) => e.type)).toEqual(["agente.assistant", "operation.completed"]);
  });

  it("al cerrar en operation.completed, registra coste/duración/turnos del result en el historial (Bloque 8)", async () => {
    const proyecto = await mkdtemp(path.join(tmpdir(), "agente-qa-web-agente-"));
    try {
      const mensajeResultado = {
        type: "result",
        subtype: "success",
        is_error: false,
        queued_turn_count: 0,
        result: "ok",
        total_cost_usd: 0.05,
        duration_ms: 1234,
        num_turns: 3,
      } as unknown as SDKMessage;

      const sesion = lanzar("hazme el page object del login", { cwd: proyecto, queryFn: queryFnFalsa([mensajeResultado]) });

      const eventos: EventoAgente[] = [];
      for await (const evento of sesion.suscribirse()) eventos.push(evento);
      expect(eventos.map((e) => e.type)).toEqual(["operation.completed"]);

      const historial = await leerHistorial(proyecto);
      expect(historial).toHaveLength(1);
      expect(historial[0]).toMatchObject({ costeUsd: 0.05, duracionMs: 1234, numTurnos: 3, resultados: [] });
    } finally {
      await rm(proyecto, { recursive: true, force: true });
    }
  });
});
