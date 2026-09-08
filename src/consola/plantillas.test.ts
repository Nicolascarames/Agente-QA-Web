import { describe, expect, it } from "vitest";
import { siguienteHueco } from "./plantillas";

describe("siguienteHueco", () => {
  it("sin ningún <...>, devuelve null", () => {
    expect(siguienteHueco("record https://ejemplo.com --headed")).toBeNull();
  });

  it("un solo hueco: sus posiciones exactas del < al >", () => {
    const texto = "record <url> --headed";
    const hueco = siguienteHueco(texto);
    expect(hueco).toEqual({ inicio: 7, fin: 12 });
    expect(texto.slice(hueco!.inicio, hueco!.fin)).toBe("<url>");
  });

  it("con varios huecos, sin 'desde' encuentra siempre el primero", () => {
    const texto = 'record <url> --auto "<objetivo>"';
    const hueco = siguienteHueco(texto);
    expect(texto.slice(hueco!.inicio, hueco!.fin)).toBe("<url>");
  });

  it("pasando 'desde' el final del primer hueco, salta al segundo", () => {
    const texto = 'record <url> --auto "<objetivo>"';
    const primero = siguienteHueco(texto)!;
    const segundo = siguienteHueco(texto, primero.fin);
    expect(texto.slice(segundo!.inicio, segundo!.fin)).toBe("<objetivo>");
  });

  it("desde después del último hueco, no queda ninguno", () => {
    const texto = 'record <url> --auto "<objetivo>"';
    const segundo = siguienteHueco(texto, siguienteHueco(texto)!.fin);
    const tercero = siguienteHueco(texto, segundo!.fin);
    expect(tercero).toBeNull();
  });

  it("tras reescribir el primer hueco (desaparece del texto), el siguiente sigue siendo el que queda", () => {
    // Simula lo que hace el input real: la persona escribe encima de la selección del primer
    // hueco, que lo borra y pone el valor real en su lugar.
    const textoTrasEscribir = 'record https://www.mi-app.com --auto "<objetivo>"';
    const hueco = siguienteHueco(textoTrasEscribir);
    expect(textoTrasEscribir.slice(hueco!.inicio, hueco!.fin)).toBe("<objetivo>");
  });
});
