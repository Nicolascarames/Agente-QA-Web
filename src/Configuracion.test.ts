import { describe, expect, it } from "vitest";
import { calcularCambiosGlobal } from "./Configuracion";

const ROLES_POR_DEFECTO = {
  "map-loop": "experto",
  "run-translate": "rapido",
  "login-fallback": "experto",
  "web-chat": "experto",
  diagnosis: "experto",
} as const;

describe("calcularCambiosGlobal", () => {
  it("solo manda modoCoste si es lo único que cambió, sin tocar un perfil bloqueado por entorno", () => {
    const inicial = {
      modoCoste: "equilibrado" as const,
      perfiles: {
        rapido: { provider: "groq" as const, model: "" }, // bloqueado por entorno, nadie lo toca
        experto: { provider: "anthropic" as const, model: "claude" },
      },
      roles: { ...ROLES_POR_DEFECTO },
    };
    const actual = { ...inicial, modoCoste: "ahorro" as const };

    const cambios = calcularCambiosGlobal(actual, inicial);

    expect(cambios).toEqual({ modoCoste: "ahorro" });
  });

  it("no manda un provider inventado si el perfil sigue sin configurar", () => {
    const inicial = {
      modoCoste: "equilibrado" as const,
      perfiles: {
        rapido: { provider: null, model: "" },
        experto: { provider: "anthropic" as const, model: "claude" },
      },
      roles: { ...ROLES_POR_DEFECTO },
    };
    const actual = { ...inicial, modoCoste: "ahorro" as const };

    const cambios = calcularCambiosGlobal(actual, inicial);

    expect(cambios).toEqual({ modoCoste: "ahorro" });
    expect(cambios.perfiles).toBeUndefined();
  });

  it("manda el provider elegido cuando el usuario sí lo configura", () => {
    const inicial = {
      modoCoste: "equilibrado" as const,
      perfiles: {
        rapido: { provider: null, model: "" },
        experto: { provider: "anthropic" as const, model: "claude" },
      },
      roles: { ...ROLES_POR_DEFECTO },
    };
    const actual = {
      ...inicial,
      perfiles: { ...inicial.perfiles, rapido: { provider: "openai" as const, model: "" } },
    };

    const cambios = calcularCambiosGlobal(actual, inicial);

    expect(cambios).toEqual({ perfiles: { rapido: { provider: "openai" } } });
  });

  it("sin ningún cambio no manda nada", () => {
    const inicial = {
      modoCoste: "equilibrado" as const,
      perfiles: {
        rapido: { provider: null, model: "" },
        experto: { provider: "anthropic" as const, model: "claude" },
      },
      roles: { ...ROLES_POR_DEFECTO },
    };

    expect(calcularCambiosGlobal(inicial, inicial)).toEqual({});
  });
});
