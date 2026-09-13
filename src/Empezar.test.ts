import { describe, expect, it } from "vitest";
import { construirTextoEjemplo } from "./Empezar";

describe("construirTextoEjemplo", () => {
  it("usa la appUrl real del proyecto cuando existe", () => {
    expect(construirTextoEjemplo("https://sauce-demo.example.com")).toBe(
      "Entra en https://sauce-demo.example.com y comprueba que se puede iniciar sesión con un usuario válido"
    );
  });

  it("cae a un ejemplo genérico cuando no hay appUrl configurada", () => {
    expect(construirTextoEjemplo("")).toBe(
      "Entra en https://tu-web-de-pruebas.com y comprueba que se puede iniciar sesión con un usuario válido"
    );
  });

  it("ignora una appUrl que solo tiene espacios", () => {
    expect(construirTextoEjemplo("   ")).toBe(
      "Entra en https://tu-web-de-pruebas.com y comprueba que se puede iniciar sesión con un usuario válido"
    );
  });
});
