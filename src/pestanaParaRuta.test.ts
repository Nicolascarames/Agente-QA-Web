import { describe, expect, it } from "vitest";
import { pestanaParaRuta } from "./pestanaParaRuta";

describe("pestanaParaRuta", () => {
  it("una ruta absoluta de Windows a un .feature va a Redactar", () => {
    expect(pestanaParaRuta("C:\\GitHub\\Agente-QA-Web\\pruebas\\babia\\tests\\features\\login.feature")).toBe("Redactar");
  });

  it("una ruta absoluta de Windows a un .page.ts va a Generar", () => {
    expect(pestanaParaRuta("C:\\GitHub\\Agente-QA-Web\\pruebas\\babia\\tests\\pages\\login.page.ts")).toBe("Generar");
  });

  it("una ruta absoluta de Windows a un .spec.ts va a Generar", () => {
    expect(pestanaParaRuta("C:\\GitHub\\Agente-QA-Web\\pruebas\\babia\\tests\\specs\\login.spec.ts")).toBe("Generar");
  });

  it("una ruta relativa (POSIX) también funciona", () => {
    expect(pestanaParaRuta("tests/features/login.feature")).toBe("Redactar");
  });

  it("un fichero fuera de tests/, o el setup de Playwright, no salta a ninguna pestaña", () => {
    expect(pestanaParaRuta("C:\\GitHub\\Agente-QA-Web\\pruebas\\babia\\playwright.config.ts")).toBeNull();
    expect(pestanaParaRuta("C:\\GitHub\\Agente-QA-Web\\pruebas\\babia\\tests\\setup\\auth.setup.ts")).toBeNull();
  });
});
