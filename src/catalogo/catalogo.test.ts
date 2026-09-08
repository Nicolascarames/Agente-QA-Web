// Guard determinista: siempre corre, no depende de tener el binario `agente-qa-mcp` a mano (para
// eso está `catalogo.cli-vivo.test.ts`). Compara `cli.generado.json` (ya congelado en disco) con
// las fichas de `comandos.ts`, así que un desajuste señala siempre al fichero equivocado: o el
// generado está desactualizado (falta `npm run catalogo:sync`) o `comandos.ts` no se actualizó.
import { describe, expect, it } from "vitest";
import { construirArgsComandoLibre, tokenizarComando } from "../../server/comandoLibre.js";
import { buscarFicha, comandosHoja, incompatiblesInvalidos } from "./catalogo";
import { COMANDOS } from "./comandos";

describe("catálogo editorial — guard determinista contra cli.generado.json", () => {
  it("hay exactamente 18 fichas (14 comandos + 4 operaciones pendientes)", () => {
    expect(COMANDOS.length).toBe(18);
  });

  it("toda ruta de comando del generado tiene ficha", () => {
    const sinFicha = comandosHoja()
      .filter((cli) => !buscarFicha(cli.ruta))
      .map((cli) => cli.ruta.join(" "));
    expect(sinFicha, `Comandos del CLI sin ficha editorial: ${sinFicha.join(", ")}`).toEqual([]);
  });

  it("toda opción del generado (incluidas las de subcomandos y las negables) está documentada", () => {
    const faltantes: string[] = [];
    for (const cli of comandosHoja()) {
      const ficha = buscarFicha(cli.ruta);
      if (!ficha) continue; // ya lo señala el test anterior, con nombre de comando
      for (const opcion of cli.opciones) {
        if (!(opcion.larga in ficha.opciones)) {
          faltantes.push(`${cli.ruta.join(" ")} ${opcion.larga}`);
        }
      }
    }
    expect(faltantes, `Opciones del CLI sin documentar en su ficha: ${faltantes.join(", ")}`).toEqual([]);
  });

  it("ninguna ficha documenta una opción que no exista en el generado", () => {
    const inventadas: string[] = [];
    for (const cli of comandosHoja()) {
      const ficha = buscarFicha(cli.ruta);
      if (!ficha) continue;
      const flagsReales = new Set(cli.opciones.map((opcion) => opcion.larga));
      for (const flag of Object.keys(ficha.opciones)) {
        if (!flagsReales.has(flag)) {
          inventadas.push(`${cli.ruta.join(" ")} ${flag}`);
        }
      }
    }
    expect(inventadas, `Opciones documentadas que no existen en el CLI real: ${inventadas.join(", ")}`).toEqual([]);
  });

  it("todo ejemplo.texto pasa construirArgsComandoLibre y solo usa flags que existen para su comando", () => {
    for (const ficha of COMANDOS) {
      const flagsValidas = new Set(Object.keys(ficha.opciones));
      for (const ejemplo of ficha.ejemplos) {
        const resultado = construirArgsComandoLibre(ejemplo.texto);
        expect(resultado.ok, `Ejemplo inválido de "${ficha.ruta.join(" ")}": "${ejemplo.texto}"${!resultado.ok ? ` → ${resultado.motivo}` : ""}`).toBe(
          true
        );

        const flagsUsadas = tokenizarComando(ejemplo.texto).filter((token) => token.startsWith("-"));
        for (const flag of flagsUsadas) {
          expect(
            flagsValidas.has(flag),
            `El ejemplo "${ejemplo.texto}" de "${ficha.ruta.join(" ")}" usa el flag "${flag}", que no está entre sus opciones documentadas.`
          ).toBe(true);
        }
      }
    }
  });

  it("toda entrada de incompatibles nombra flags que existen (vacío en este bloque: se rellena en el Bloque 8)", () => {
    for (const ficha of COMANDOS) {
      const invalidas = incompatiblesInvalidos(ficha);
      expect(invalidas, `"${ficha.ruta.join(" ")}" tiene "incompatibles" con flags que no existen: ${invalidas.join(", ")}`).toEqual([]);
    }
  });
});
