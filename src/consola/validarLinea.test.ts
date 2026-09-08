import { describe, expect, it } from "vitest";
import { catalogoResuelto } from "../catalogo/catalogo";
import { validarLinea } from "./validarLinea";

const catalogo = catalogoResuelto();

describe("validarLinea", () => {
  it("flag que no existe: sugiere la más parecida por distancia de edición", () => {
    const problemas = validarLinea("record --heded https://ejemplo.com", catalogo);
    expect(problemas).toEqual([{ motivo: "--heded no existe en record. ¿Querías decir --headed?" }]);
  });

  it("flag que no existe y no se parece a ninguna: sin sugerencia", () => {
    const problemas = validarLinea("record --zzzzzzzzzz https://ejemplo.com", catalogo);
    expect(problemas).toEqual([{ motivo: "--zzzzzzzzzz no existe en record." }]);
  });

  it("falta un argumento obligatorio", () => {
    const problemas = validarLinea("record --headed", catalogo);
    expect(problemas).toEqual([{ motivo: "falta el argumento obligatorio <url>." }]);
  });

  it("un flag que pide valor y no lo lleva", () => {
    const problemas = validarLinea("map --goal", catalogo);
    expect(problemas).toEqual([{ motivo: "--goal necesita un valor." }]);
  });

  it("otro flag que pide valor pero el siguiente token es otro flag, no un valor", () => {
    const problemas = validarLinea("map --goal --headed", catalogo);
    expect(problemas).toEqual([{ motivo: "--goal necesita un valor." }]);
  });

  it("valor fuera de la lista cerrada", () => {
    const problemas = validarLinea("init --env produccion", catalogo);
    expect(problemas).toEqual([{ motivo: "produccion no es un valor válido de --env: usa dev, test, staging, production." }]);
  });

  it("combinación prohibida (incompatibles de map)", () => {
    const problemas = validarLinea('map --goal "hacer login" --all', catalogo);
    expect(problemas).toContainEqual({ motivo: "--goal y --all son excluyentes: usa solo uno." });
  });

  it("combinación prohibida (incompatibles de record)", () => {
    const problemas = validarLinea("record https://ejemplo.com --allow-writes --no-writes", catalogo);
    expect(problemas).toEqual([{ motivo: "--allow-writes y --no-writes son excluyentes: usa solo uno." }]);
  });

  it("línea vacía: sin problemas", () => {
    expect(validarLinea("", catalogo)).toEqual([]);
  });

  it("comando todavía sin terminar de escribir: sin problemas (ya avisa el autocompletado)", () => {
    expect(validarLinea("reco", catalogo)).toEqual([]);
  });

  // Los 4 comandos de "sin falsos positivos" del paso 7 de la spec — ninguno debe dar problemas.
  it("sin falsos positivos: map --all", () => {
    expect(validarLinea("map --all", catalogo)).toEqual([]);
  });

  it("sin falsos positivos: record --auto con su url", () => {
    // La spec de este bloque pide probar literalmente `record --auto "haz login"`, pero `record`
    // exige un `<url>` posicional obligatorio (`src/cli/commands/record.ts:430`) con o sin
    // `--auto` — sin URL, el propio CLI real lo rechazaría, así que sería incorrecto que la
    // consola no dijera nada. Se prueba aquí con la URL puesta, que es la forma que de verdad no
    // debe dar ningún aviso.
    expect(validarLinea('record https://ejemplo.com --auto "haz login"', catalogo)).toEqual([]);
  });

  it("sin falsos positivos: snapshot <url>", () => {
    expect(validarLinea("snapshot <url>", catalogo)).toEqual([]);
  });

  it("sin falsos positivos: run con objetivo entrecomillado", () => {
    expect(validarLinea('run "repasa lo dudoso"', catalogo)).toEqual([]);
  });
});
