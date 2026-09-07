import { describe, expect, it } from "vitest";
import { ESTADO_CONSOLA_INICIAL, reducirEventoConsola } from "./useCorridaGlobal";
import type { EventoNdjson } from "../shared/tipos";

function evento(parcial: Partial<EventoNdjson> & { type: string }): EventoNdjson {
  return { runId: "run-1", ts: new Date().toISOString(), agent: "mapeador-mcp", data: {}, ...parcial };
}

describe("reducirEventoConsola", () => {
  it("acumula eventos en el historial sin marcar fin de corrida", () => {
    const paso1 = reducirEventoConsola(ESTADO_CONSOLA_INICIAL, evento({ type: "map.screen.discovered" }));
    const paso2 = reducirEventoConsola(paso1, evento({ type: "cost.update" }));
    expect(paso2.eventos).toHaveLength(2);
    expect(paso2.eventoFinal).toBeNull();
  });

  it("marca eventoFinal al recibir operation.completed", () => {
    const evtFinal = evento({ type: "operation.completed" });
    expect(reducirEventoConsola(ESTADO_CONSOLA_INICIAL, evtFinal).eventoFinal).toEqual(evtFinal);
  });

  it("marca eventoFinal también con operation.stopped y operation.error", () => {
    expect(reducirEventoConsola(ESTADO_CONSOLA_INICIAL, evento({ type: "operation.stopped" })).eventoFinal?.type).toBe(
      "operation.stopped"
    );
    expect(reducirEventoConsola(ESTADO_CONSOLA_INICIAL, evento({ type: "operation.error" })).eventoFinal?.type).toBe(
      "operation.error"
    );
  });
});
