import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { escribirVariable, nombreVarClave } from "./entornoMcp.js";
import { escribirClave, listarClaves, verClave } from "./claves.js";

describe("claves", () => {
  let proyecto: string;
  let appDataTmp: string;

  beforeEach(async () => {
    proyecto = await mkdtemp(path.join(tmpdir(), "agente-qa-web-claves-"));
    appDataTmp = await mkdtemp(path.join(tmpdir(), "agente-qa-web-claves-appdata-"));
    process.env.APPDATA = appDataTmp;
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterEach(async () => {
    await rm(proyecto, { recursive: true, force: true });
    await rm(appDataTmp, { recursive: true, force: true });
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("listarClaves nunca incluye la clave completa, solo los 4 últimos caracteres", async () => {
    await escribirVariable(nombreVarClave("anthropic"), "sk-esto-es-una-clave-larga-de-prueba", "proyecto", proyecto);
    const claves = await listarClaves(proyecto);
    const anthropic = claves.find((c) => c.proveedor === "anthropic");
    expect(anthropic?.hayClave).toBe(true);
    expect(anthropic?.ultimos4).toBe("ueba");
    expect(anthropic?.capa).toBe("proyecto");
    expect(JSON.stringify(claves)).not.toContain("sk-esto-es-una-clave-larga-de-prueba");
  });

  it("los 4 proveedores aparecen aunque ninguno tenga clave", async () => {
    const claves = await listarClaves(proyecto);
    expect(claves.map((c) => c.proveedor).sort()).toEqual(["anthropic", "google", "groq", "openai"]);
    expect(claves.every((c) => !c.hayClave && c.ultimos4 === null && c.capa === null)).toBe(true);
  });

  it("verClave sí devuelve la clave completa", async () => {
    await escribirVariable(nombreVarClave("groq"), "gsk-clave-completa", "global", proyecto);
    const resultado = await verClave(proyecto, "groq");
    expect(resultado).toEqual({ ok: true, valor: "gsk-clave-completa" });
  });

  it("verClave falla con motivo legible si no hay clave configurada", async () => {
    const resultado = await verClave(proyecto, "openai");
    expect(resultado.ok).toBe(false);
  });

  it("escribirClave rechaza si la variable ya viene del entorno", async () => {
    process.env.ANTHROPIC_API_KEY = "clave-de-entorno";
    const resultado = await escribirClave(proyecto, "anthropic", "clave-nueva", "proyecto");
    expect(resultado.ok).toBe(false);
  });
});
