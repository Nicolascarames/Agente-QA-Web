// Ejecuta Playwright de verdad sobre el proyecto activo — hasta ahora `server/reporter.ts` solo
// LEÍA `test-results/results.json` (decisión del Bloque 7: "no hay runner en el servidor, fuera de
// alcance"). El usuario pidió poder lanzar los tests desde la pestaña Ejecutar, así que ese runner
// entra ahora: mismo comando que ya exige `skill/skills/qa/SKILL.md` §4 para que el JSON exista
// (`PLAYWRIGHT_JSON_OUTPUT_NAME=test-results/results.json`, `--reporter=list,json`), lanzado por
// variable de entorno sin tocar el `playwright.config.ts` del repo destino (ajeno).
import { spawn } from "node:child_process";
import type { ResultadoEjecucionPlaywright } from "../shared/tipos.js";

export type { ResultadoEjecucionPlaywright } from "../shared/tipos.js";

/**
 * `rutaSpec`, si se pasa, limita la ejecución a ese fichero (botón por fila); sin ella, corre toda
 * la suite (botón "Ejecutar todos"). `npx` en Windows es un `.cmd`, así que hace falta `shell: true`
 * para poder lanzarlo — por eso `rutaSpec` se valida ANTES de llegar aquí (`rutaSpecSegura` en
 * `app.ts`, mismo patrón que `rutaGeneradaSegura`): con shell de por medio, un argumento sin validar
 * sería inyección de comandos, no solo path traversal.
 *
 * `credenciales` (Configuración → Credenciales) se pasan como variables de entorno al proceso de
 * Playwright: si el agente escribió el `.spec.ts` leyendo `process.env.<NOMBRE>` en vez de un valor
 * hardcodeado (buena práctica para no dejar secretos en el código versionado), la ejecución real
 * necesita esas mismas variables presentes o el test fallaría por credenciales ausentes, no por un
 * fallo real de la aplicación.
 */
export function ejecutarPlaywright(rootDir: string, rutaSpec?: string, credenciales: Record<string, string> = {}): Promise<ResultadoEjecucionPlaywright> {
  return new Promise((resolve) => {
    const args = ["playwright", "test", "--reporter=list,json"];
    if (rutaSpec) args.push(rutaSpec);

    const proceso = spawn("npx", args, {
      cwd: rootDir,
      env: { ...process.env, ...credenciales, PLAYWRIGHT_JSON_OUTPUT_NAME: "test-results/results.json" },
      shell: process.platform === "win32",
    });

    let salida = "";
    proceso.stdout?.on("data", (fragmento: Buffer) => {
      salida += fragmento.toString();
    });
    proceso.stderr?.on("data", (fragmento: Buffer) => {
      salida += fragmento.toString();
    });
    proceso.on("error", (err) => {
      resolve({ ok: false, codigo: null, salida: `No se pudo lanzar Playwright: ${err.message}` });
    });
    proceso.on("close", (codigo) => {
      resolve({ ok: codigo === 0, codigo, salida });
    });
  });
}
