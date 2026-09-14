import { describe, expect, it } from "vitest";
import {
  describirEvento,
  extraerTextoAsistente,
  extraerToolUseIds,
  formatearParametrosHerramienta,
  resumenEventoSistema,
  resumenResultadoHerramienta,
  rutaUltimoFicheroEscrito,
  textoBloqueFinal,
} from "./ConsolaGlobal";
import type { EventoNdjson } from "../shared/tipos";

function evento(type: string, data: unknown): EventoNdjson {
  return { runId: "run-1", ts: "2026-09-13T08:30:27.300Z", agent: "agente-qa", type, data };
}

describe("describirEvento — bug 1: nada de JSON crudo por defecto", () => {
  it("un system/hook_started no ensucia la consola (no se pinta nada)", () => {
    const e = evento("agente.system", {
      type: "system",
      subtype: "hook_started",
      hook_id: "a983083f",
      hook_name: "SessionStart:startup",
      hook_event: "SessionStart",
      uuid: "u1",
      session_id: "s1",
    });
    expect(describirEvento(e, null)).toEqual([]);
  });

  it("un system/init se resume en una línea, sin volcar el catálogo entero de herramientas", () => {
    const e = evento("agente.system", { type: "system", subtype: "init", model: "claude-x", tools: ["a", "b", "c"] });
    const items = describirEvento(e, null);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ tipo: "corto" });
    if (items[0].tipo === "corto") {
      expect(items[0].etiqueta).toBe("Sesión iniciada — modelo claude-x, 3 herramientas disponibles.");
      expect(items[0].etiqueta).not.toContain('"a"');
    }
  });

  it("un system/init reanudado dice 'Conversación reanudada', no 'Sesión iniciada'", () => {
    const e = evento("agente.system", { type: "system", subtype: "init", model: "claude-x", tools: ["a", "b"], reanudada: true });
    const items = describirEvento(e, null);
    expect(items).toHaveLength(1);
    if (items[0].tipo === "corto") {
      expect(items[0].etiqueta).toBe("Conversación reanudada — modelo claude-x, 2 herramientas disponibles.");
    }
  });

  it("un tool_use se pinta con nombre y parámetros legibles (no como JSON del input)", () => {
    const e = evento("agente.assistant", {
      message: { content: [{ type: "tool_use", name: "mcp__playwright__browser_snapshot", input: { target: "iframe#login" } }] },
    });
    const items = describirEvento(e, null);
    expect(items).toEqual([{ tipo: "usoHerramienta", nombre: "mcp__playwright__browser_snapshot", parametros: "target: iframe#login" }]);
  });

  it("un tipo de evento desconocido cae al render corto, nunca al objeto entero", () => {
    const e = evento("agente.turno", { queued_turn_count: 1, algoInterno: { anidado: true } });
    const items = describirEvento(e, null);
    expect(items).toEqual([{ tipo: "corto", etiqueta: "agente.turno", ts: e.ts, agent: e.agent }]);
  });

  it("agente.rate_limit_event es andamiaje del SDK: no se pinta", () => {
    const e = evento("agente.rate_limit_event", { rate_limit_info: { status: "allowed" } });
    expect(describirEvento(e, null)).toEqual([]);
  });

  it("un agente.user con tool_result se resume en una línea con el nombre de la herramienta, no como 'agente.user' desnudo", () => {
    const e = evento("agente.user", {
      message: { content: [{ type: "tool_result", tool_use_id: "t1", content: "a.feature\nb.feature\nc.feature", is_error: false }] },
    });
    const items = describirEvento(e, null, { t1: "Glob" });
    // Tres líneas: se cuenta ("3 resultados"), no se enseña solo la primera como si fuera la única
    // (ver test de resumenResultadoHerramienta más abajo para el detalle de esta regla).
    expect(items).toEqual([{ tipo: "resultadoHerramienta", texto: "← Glob: 3 resultados" }]);
  });

  it("un tool_result en error se marca como tal, no se confunde con éxito", () => {
    const e = evento("agente.user", {
      message: { content: [{ type: "tool_result", tool_use_id: "t2", content: "ENOENT: no existe", is_error: true }] },
    });
    const items = describirEvento(e, null, { t2: "Read" });
    expect(items).toEqual([{ tipo: "resultadoHerramienta", texto: "← Read: error: ENOENT: no existe" }]);
  });

  it("extraerToolUseIds saca el id y nombre de cada tool_use para poder nombrar su tool_result después", () => {
    const e = evento("agente.assistant", {
      message: { content: [{ type: "tool_use", id: "t1", name: "Glob", input: { pattern: "tests/features/**" } }] },
    });
    expect(extraerToolUseIds(e)).toEqual([{ id: "t1", nombre: "Glob" }]);
  });

  it("resumenResultadoHerramienta sin nombre conocido no revienta, solo omite el prefijo", () => {
    expect(resumenResultadoHerramienta({ type: "tool_result", content: "ok" })).toBe("← ok");
  });

  it("resumenResultadoHerramienta con una sola línea la muestra tal cual", () => {
    expect(resumenResultadoHerramienta({ type: "tool_result", content: "tests\\pages\\login.page.ts" }, "Glob")).toBe(
      "← Glob: tests\\pages\\login.page.ts"
    );
  });

  it("resumenResultadoHerramienta con varias líneas cuenta en vez de mostrar solo la primera", () => {
    const contenido = "tests\\pages\\login.page.ts\ntests\\pages\\inventory.page.ts\ntests\\specs\\login.spec.ts";
    expect(resumenResultadoHerramienta({ type: "tool_result", content: contenido }, "Glob")).toBe("← Glob: 3 resultados");
  });
});

describe("textoBloqueFinal / describirEvento — bug 2: el cierre de turno no repite el texto", () => {
  it("si el result del SDK coincide con el último texto del asistente, el bloque de cierre no lo repite", () => {
    const textoFinal = "Hecho: el login funciona con el usuario válido.";
    expect(textoBloqueFinal(evento("operation.completed", { result: textoFinal }), textoFinal)).toBe("Terminado.");
  });

  it("de punta a punta: assistant + result con el mismo texto solo se ven una vez", () => {
    const textoFinal = "Hecho: el login funciona con el usuario válido.";
    const eventos = [
      evento("agente.assistant", { message: { content: [{ type: "text", text: textoFinal }] } }),
      evento("operation.completed", { result: textoFinal }),
    ];
    let ultimo: string | null = null;
    const items = eventos.flatMap((e) => {
      const its = describirEvento(e, ultimo);
      ultimo = extraerTextoAsistente(e) ?? ultimo;
      return its;
    });
    const vecesQueApareceElTexto = items.filter((i) => "texto" in i && i.texto === textoFinal).length;
    expect(vecesQueApareceElTexto).toBe(1);
    expect(items[1]).toEqual({ tipo: "finTurno", error: false, texto: "Terminado." });
  });

  it("un error sí conserva su texto (no es duplicado de ningún bloque de texto previo)", () => {
    expect(textoBloqueFinal(evento("operation.error", { result: "fallo de API" }), "otro texto")).toBe("fallo de API");
  });
});

describe("formatearParametrosHerramienta / resumenEventoSistema — casos límite", () => {
  it("sin parámetros no añade paréntesis vacíos con contenido", () => {
    expect(formatearParametrosHerramienta({})).toBe("");
    expect(formatearParametrosHerramienta(undefined)).toBe("");
  });

  it("un subtype de system distinto de init no se resume (queda en null)", () => {
    expect(resumenEventoSistema({ subtype: "hook_completed" })).toBeNull();
  });
});

describe("rutaUltimoFicheroEscrito — Pieza 3: a qué pestaña saltar", () => {
  it("encuentra la ruta del último Write, buscando hacia atrás en los eventos", () => {
    const eventos = [
      evento("agente.assistant", {
        message: { content: [{ type: "tool_use", name: "Write", input: { file_path: "C:\\repo\\tests\\features\\login.feature" } }] },
      }),
      evento("agente.user", { message: { content: [{ type: "tool_result", content: "ok" }] } }),
    ];
    expect(rutaUltimoFicheroEscrito(eventos)).toBe("C:\\repo\\tests\\features\\login.feature");
  });

  it("un Edit posterior gana al Write anterior (se queda con el más reciente)", () => {
    const eventos = [
      evento("agente.assistant", { message: { content: [{ type: "tool_use", name: "Write", input: { file_path: "C:\\repo\\tests\\features\\a.feature" } }] } }),
      evento("agente.assistant", { message: { content: [{ type: "tool_use", name: "Edit", input: { file_path: "C:\\repo\\tests\\specs\\b.spec.ts" } }] } }),
    ];
    expect(rutaUltimoFicheroEscrito(eventos)).toBe("C:\\repo\\tests\\specs\\b.spec.ts");
  });

  it("ignora tool_use que no son Write ni Edit", () => {
    const eventos = [evento("agente.assistant", { message: { content: [{ type: "tool_use", name: "Read", input: { file_path: "x.ts" } }] } })];
    expect(rutaUltimoFicheroEscrito(eventos)).toBeNull();
  });

  it("sin ningún Write/Edit en la conversación, devuelve null", () => {
    expect(rutaUltimoFicheroEscrito([])).toBeNull();
  });

  it("no cruza al turno anterior: sin escritura en el turno actual, no encuentra la del turno viejo", () => {
    const eventos = [
      evento("usuario.mensaje", { texto: "añade un test de login" }),
      evento("agente.assistant", { message: { content: [{ type: "tool_use", name: "Write", input: { file_path: "C:\\repo\\tests\\features\\login.feature" } }] } }),
      evento("agente.pregunta", { requestId: "r1", questions: [] }),
      evento("usuario.mensaje", { texto: "Confirmo, sigue" }),
      evento("agente.assistant", { message: { content: [{ type: "tool_use", name: "Read", input: { file_path: "C:\\repo\\tests\\features\\login.feature" } }] } }),
    ];
    expect(rutaUltimoFicheroEscrito(eventos)).toBeNull();
  });

  it("salta una escritura que no mapea a ninguna pestaña y sigue buscando en el mismo turno", () => {
    const eventos = [
      evento("usuario.mensaje", { texto: "confirmo" }),
      evento("agente.assistant", { message: { content: [{ type: "tool_use", name: "Write", input: { file_path: "C:\\repo\\tests\\specs\\login.spec.ts" } }] } }),
      evento("agente.assistant", { message: { content: [{ type: "tool_use", name: "Write", input: { file_path: "C:\\repo\\tests\\setup\\auth.setup.ts" } }] } }),
    ];
    expect(rutaUltimoFicheroEscrito(eventos)).toBe("C:\\repo\\tests\\specs\\login.spec.ts");
  });
});
