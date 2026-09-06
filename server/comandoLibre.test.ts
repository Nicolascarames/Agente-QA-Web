import { describe, expect, it } from "vitest";
import { construirArgsComandoLibre, tokenizarComando } from "./comandoLibre.js";

describe("tokenizarComando", () => {
  it("separa por espacios los tokens sueltos", () => {
    expect(tokenizarComando("record --headed https://ejemplo.com")).toEqual(["record", "--headed", "https://ejemplo.com"]);
  });

  it("mantiene como un solo token el contenido entre comillas dobles", () => {
    expect(tokenizarComando('record --auto "explorar el checkout" --headed')).toEqual([
      "record",
      "--auto",
      "explorar el checkout",
      "--headed",
    ]);
  });

  it("mantiene como un solo token el contenido entre comillas simples", () => {
    expect(tokenizarComando("map --goal 'ver el carrito'")).toEqual(["map", "--goal", "ver el carrito"]);
  });

  it("con texto vacío o solo espacios devuelve un array vacío", () => {
    expect(tokenizarComando("   ")).toEqual([]);
  });
});

describe("construirArgsComandoLibre", () => {
  it("acepta un comando conocido y devuelve su argv tal cual se escribió", () => {
    expect(construirArgsComandoLibre("record --headed https://ejemplo.com")).toEqual({
      ok: true,
      args: ["record", "--headed", "https://ejemplo.com"],
    });
  });

  it("rechaza un primer token que no es un comando reconocido, con un motivo legible", () => {
    expect(construirArgsComandoLibre("borrar-todo --force")).toEqual({
      ok: false,
      motivo: '"borrar-todo" no es un comando reconocido de agente-qa-mcp.',
    });
  });

  it("rechaza texto vacío", () => {
    expect(construirArgsComandoLibre("   ")).toEqual({ ok: false, motivo: "Escribe un comando." });
  });
});
