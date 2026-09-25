import { describe, expect, it } from "vitest";
import { PREFERENCIAS_POR_DEFECTO, leerPreferencias, normalizarPreferencias } from "./preferenciasUI";

describe("normalizarPreferencias", () => {
  it("devuelve los valores por defecto para un objeto vacío", () => {
    expect(normalizarPreferencias({})).toEqual(PREFERENCIAS_POR_DEFECTO);
  });

  it("devuelve los valores por defecto para un valor que no es objeto", () => {
    expect(normalizarPreferencias(null)).toEqual(PREFERENCIAS_POR_DEFECTO);
    expect(normalizarPreferencias("texto")).toEqual(PREFERENCIAS_POR_DEFECTO);
    expect(normalizarPreferencias(42)).toEqual(PREFERENCIAS_POR_DEFECTO);
  });

  it("conserva un ajusteTexto válido dentro de rango", () => {
    expect(normalizarPreferencias({ ajusteTexto: 3 })).toEqual({ ajusteTexto: 3, modoPaneles: "fijos" });
  });

  it("clampa un ajusteTexto fuera de rango a los límites [-4, 4]", () => {
    expect(normalizarPreferencias({ ajusteTexto: 99 }).ajusteTexto).toBe(4);
    expect(normalizarPreferencias({ ajusteTexto: -99 }).ajusteTexto).toBe(-4);
  });

  it("redondea un ajusteTexto no entero", () => {
    expect(normalizarPreferencias({ ajusteTexto: 1.6 }).ajusteTexto).toBe(2);
  });

  it("cae al valor por defecto si ajusteTexto no es un número finito", () => {
    expect(normalizarPreferencias({ ajusteTexto: "2" }).ajusteTexto).toBe(PREFERENCIAS_POR_DEFECTO.ajusteTexto);
    expect(normalizarPreferencias({ ajusteTexto: NaN }).ajusteTexto).toBe(PREFERENCIAS_POR_DEFECTO.ajusteTexto);
  });

  it("acepta modoPaneles 'movibles' y cae a 'fijos' para cualquier otro valor", () => {
    expect(normalizarPreferencias({ modoPaneles: "movibles" }).modoPaneles).toBe("movibles");
    expect(normalizarPreferencias({ modoPaneles: "algo-raro" }).modoPaneles).toBe("fijos");
    expect(normalizarPreferencias({ modoPaneles: "fijos" }).modoPaneles).toBe("fijos");
  });
});

describe("leerPreferencias", () => {
  it("devuelve los valores por defecto cuando no hay nada guardado", () => {
    expect(leerPreferencias({ getItem: () => null })).toEqual(PREFERENCIAS_POR_DEFECTO);
  });

  it("devuelve los valores por defecto cuando el JSON guardado es inválido", () => {
    expect(leerPreferencias({ getItem: () => "{no-es-json" })).toEqual(PREFERENCIAS_POR_DEFECTO);
  });

  it("devuelve los valores por defecto cuando el storage lanza", () => {
    const storage: Pick<Storage, "getItem"> = {
      getItem: () => {
        throw new Error("localStorage no disponible");
      },
    };
    expect(leerPreferencias(storage)).toEqual(PREFERENCIAS_POR_DEFECTO);
  });

  it("lee y normaliza unas preferencias guardadas válidas", () => {
    const storage: Pick<Storage, "getItem"> = { getItem: () => JSON.stringify({ ajusteTexto: 4, modoPaneles: "movibles" }) };
    expect(leerPreferencias(storage)).toEqual({ ajusteTexto: 4, modoPaneles: "movibles" });
  });
});
