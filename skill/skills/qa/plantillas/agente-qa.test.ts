import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { categoriasCapturaActivas, expect as expectReexportado, paso, test, validar } from "./agente-qa.js";

describe("categoriasCapturaActivas — lee AGENTE_QA_CAPTURAS", () => {
  const original = process.env.AGENTE_QA_CAPTURAS;

  beforeEach(() => {
    delete process.env.AGENTE_QA_CAPTURAS;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.AGENTE_QA_CAPTURAS;
    else process.env.AGENTE_QA_CAPTURAS = original;
  });

  it("sin la variable, vale ['validaciones']", () => {
    expect(categoriasCapturaActivas()).toEqual(["validaciones"]);
  });

  it("variable vacía, no captura nada", () => {
    process.env.AGENTE_QA_CAPTURAS = "";
    expect(categoriasCapturaActivas()).toEqual([]);
  });

  it("lista separada por comas, con espacios", () => {
    process.env.AGENTE_QA_CAPTURAS = "validaciones, fallos";
    expect(categoriasCapturaActivas()).toEqual(["validaciones", "fallos"]);
  });

  it("descarta categorías desconocidas", () => {
    process.env.AGENTE_QA_CAPTURAS = "fallos,inventada";
    expect(categoriasCapturaActivas()).toEqual(["fallos"]);
  });
});

describe("exports del fichero de apoyo", () => {
  it("expone test, expect, paso y validar como funciones/objeto utilizables", () => {
    expect(typeof test).toBe("function");
    expect(typeof expectReexportado).toBe("function");
    expect(typeof paso).toBe("function");
    expect(typeof validar).toBe("function");
  });
});
