import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import type { EstadoProyecto, EstadoProyectoActivo } from "../shared/tipos.js";

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
});
