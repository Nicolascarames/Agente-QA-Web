import path from "node:path";
import { describe, expect, it } from "vitest";
import { elegirCartel } from "./bienvenida.mjs";

const RAIZ = path.resolve("C:/paquete/qa-web-agent");

describe("elegirCartel", () => {
  it("--dev con INIT_CWD igual a la raíz del paquete devuelve el cartel de desarrollo", () => {
    const cartel = elegirCartel({ INIT_CWD: RAIZ }, ["--dev"], RAIZ);

    expect(cartel).toContain("npm run empezar");
  });

  it("--dev con INIT_CWD igual salvo mayúsculas también cuenta como la misma raíz (Windows)", () => {
    const cartel = elegirCartel({ INIT_CWD: RAIZ.toUpperCase() }, ["--dev"], RAIZ);

    expect(cartel).toContain("npm run empezar");
  });

  it("sin --dev y con npm_config_global=true devuelve el cartel de instalación global", () => {
    const cartel = elegirCartel({ npm_config_global: "true" }, [], RAIZ);

    expect(cartel).toContain("qa-web-agent");
  });

  it("--dev con un INIT_CWD que no es la raíz del paquete no imprime nada", () => {
    const cartel = elegirCartel({ INIT_CWD: path.resolve("C:/otro-proyecto") }, ["--dev"], RAIZ);

    expect(cartel).toBeNull();
  });

  it("sin --dev y sin instalación global no imprime nada", () => {
    const cartel = elegirCartel({}, [], RAIZ);

    expect(cartel).toBeNull();
  });
});
