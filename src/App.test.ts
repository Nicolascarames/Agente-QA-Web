import { describe, expect, it } from "vitest";
import { decidirPestanaInicial } from "./App";

describe("decidirPestanaInicial", () => {
  it("abre en Empezar cuando no hay nada guardado (primera vez)", () => {
    expect(decidirPestanaInicial(null)).toBe("Empezar");
  });

  it("abre en Dashboard cuando la guía ya se descartó", () => {
    expect(decidirPestanaInicial("1")).toBe("Dashboard");
  });
});
