import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolverProyectoInicial } from "./proyecto.js";

describe("resolverProyectoInicial", () => {
  it("usa --project del argv si viene", () => {
    const resuelto = resolverProyectoInicial(["node", "index.js", "--project", "C:/proyectos/mi-app"], "C:/otra", {});
    expect(resuelto).toBe(path.resolve("C:/proyectos/mi-app"));
  });

  it("cae a AGENTE_QA_PROJECT si no hay --project en argv", () => {
    const resuelto = resolverProyectoInicial(["node", "index.js"], "C:/otra", { AGENTE_QA_PROJECT: "C:/proyectos/dev" });
    expect(resuelto).toBe(path.resolve("C:/proyectos/dev"));
  });

  it("cae a cwd si no hay ni argv ni env", () => {
    const resuelto = resolverProyectoInicial(["node", "index.js"], "C:/cwd", {});
    expect(resuelto).toBe("C:/cwd");
  });
});
