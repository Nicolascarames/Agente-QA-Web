// Ejecuta Playwright de verdad sobre el proyecto activo. Mismo comando que exige
// `skill/skills/qa/SKILL.md` §4 para que el JSON y el HTML existan
// (`PLAYWRIGHT_JSON_OUTPUT_NAME`, `--reporter=list,json,html`, `PLAYWRIGHT_HTML_OPEN=never`):
// `server/informes.ts` archiva `test-results/`/`playwright-report/` después de cada corrida, antes
// de que la siguiente los vacíe.
import { spawn } from "node:child_process";
import type { CategoriaCaptura, ResultadoEjecucionPlaywright } from "../shared/tipos.js";

export type { ResultadoEjecucionPlaywright } from "../shared/tipos.js";

/**
 * `rutaSpec`, si se pasa, limita la ejecución a ese fichero (botón por fila); sin ella, corre toda
 * la suite (botón "Ejecutar todos"). `npx` en Windows es un `.cmd`, así que hace falta `shell: true`
 * para poder lanzarlo — por eso `rutaSpec` se valida ANTES de llegar aquí (`rutaSpecSegura` en
 * `app.ts`): con shell de por medio, un argumento sin validar sería inyección de comandos.
 *
 * `credenciales` se pasan como variables de entorno al proceso de Playwright.
 *
 * `onLinea`, si se pasa, recibe cada línea completa de `stdout`/`stderr` según va saliendo, sin
 * códigos ANSI — canal en vivo de `GET /api/tests/eventos`.
 *
 * `capturas` (spec 2026-09-26) fija `AGENTE_QA_CAPTURAS` para `tests/soporte/agente-qa.ts`: sin
 * indicar, "validaciones" (mismo defecto que el fichero de apoyo si la variable faltase del todo);
 * una lista vacía apaga las capturas de esta ejecución.
 */
export function ejecutarPlaywright(
  rootDir: string,
  rutaSpec?: string,
  credenciales: Record<string, string> = {},
  onLinea?: (linea: string) => void,
  capturas: CategoriaCaptura[] = ["validaciones"],
): Promise<ResultadoEjecucionPlaywright> {
  return new Promise((resolve) => {
    const args = ["playwright", "test", "--reporter=list,json,html"];
    if (rutaSpec) args.push(rutaSpec);

    const proceso = spawn("npx", args, {
      cwd: rootDir,
      env: {
        ...process.env,
        ...credenciales,
        PLAYWRIGHT_JSON_OUTPUT_NAME: "test-results/results.json",
        PLAYWRIGHT_HTML_OPEN: "never",
        PLAYWRIGHT_HTML_OUTPUT_DIR: "playwright-report",
        AGENTE_QA_CAPTURAS: capturas.join(","),
      },
      shell: process.platform === "win32",
    });

    let salida = "";
    let bufferLinea = "";
    function volcarLineas(fragmento: string) {
      bufferLinea += fragmento;
      const lineas = bufferLinea.split(/\r?\n/);
      bufferLinea = lineas.pop() ?? "";
      for (const linea of lineas) onLinea?.(linea.replace(/\x1b\[[0-9;]*[A-Za-z]/g, ""));
    }
    proceso.stdout?.on("data", (fragmento: Buffer) => {
      const texto = fragmento.toString();
      salida += texto;
      volcarLineas(texto);
    });
    proceso.stderr?.on("data", (fragmento: Buffer) => {
      const texto = fragmento.toString();
      salida += texto;
      volcarLineas(texto);
    });
    proceso.on("error", (err) => {
      resolve({ ok: false, codigo: null, salida: `No se pudo lanzar Playwright: ${err.message}` });
    });
    proceso.on("close", (codigo) => {
      if (bufferLinea !== "") onLinea?.(bufferLinea.replace(/\x1b\[[0-9;]*[A-Za-z]/g, ""));
      resolve({ ok: codigo === 0, codigo, salida });
    });
  });
}
