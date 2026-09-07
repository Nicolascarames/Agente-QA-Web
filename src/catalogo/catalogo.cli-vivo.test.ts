// Guard vivo: ejecuta el binario real de `agente-qa-mcp` (misma cascada de localización que usa
// la app — `server/cli.ts`) y compara su `catalog --pretty` con `src/catalogo/cli.generado.json`.
// Si el binario no aparece (máquina sin el repo hermano compilado ni el CLI instalado), se salta
// con un mensaje claro en vez de fallar: `catalogo.test.ts` es el guard que corre siempre.
import { describe, expect, it } from "vitest";
import { ejecutarCli, localizarCli } from "../../server/cli.js";
import { cliGenerado } from "./catalogo";

const localizado = await localizarCli();

if (!localizado.encontrado) {
  console.warn(
    `[catalogo.cli-vivo.test] Binario "agente-qa-mcp" no encontrado, guard vivo omitido:\n${localizado.diagnostico.join("\n")}`
  );
}

describe.skipIf(!localizado.encontrado)("catálogo editorial — guard contra el binario real", () => {
  it("cli.generado.json coincide con lo que imprime `agente-qa-mcp catalog --pretty` ahora mismo", async () => {
    const resultado = await ejecutarCli(["catalog", "--pretty"], process.cwd());
    expect(resultado.codigo, `"agente-qa-mcp catalog --pretty" falló:\n${resultado.stderr}`).toBe(0);

    const catalogoVivo = JSON.parse(resultado.stdout) as unknown;
    expect(
      catalogoVivo,
      'cli.generado.json está desactualizado respecto al binario real — corre "npm run catalogo:sync".'
    ).toEqual(cliGenerado);
  });
});
