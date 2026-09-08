import { describe, expect, it } from "vitest";
import { construirCambiosLlm } from "./Configuracion";

describe("construirCambiosLlm", () => {
  it("con modalidad suscripcion no manda nada más, sin mirar proveedor ni modelo", () => {
    expect(construirCambiosLlm("suscripcion", "openai", "gpt")).toEqual({ modalidad: "suscripcion" });
    expect(construirCambiosLlm("suscripcion", "", "")).toEqual({ modalidad: "suscripcion" });
  });

  it("con modalidad api y proveedor+modelo completos, los manda tal cual", () => {
    expect(construirCambiosLlm("api", "anthropic", "claude-3-5-sonnet")).toEqual({
      modalidad: "api",
      proveedor: "anthropic",
      modelo: "claude-3-5-sonnet",
    });
  });

  it("con modalidad api sin proveedor, devuelve un error y no un objeto a medias", () => {
    const resultado = construirCambiosLlm("api", "", "claude-3-5-sonnet");
    expect("error" in resultado).toBe(true);
  });

  it("con modalidad api sin modelo (o solo espacios), devuelve un error", () => {
    expect("error" in construirCambiosLlm("api", "anthropic", "")).toBe(true);
    expect("error" in construirCambiosLlm("api", "anthropic", "   ")).toBe(true);
  });
});
