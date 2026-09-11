import { promises as fs } from "node:fs";
import path from "node:path";
import type { ConfigRaiz } from "../shared/tipos.js";

/** Resuelve el proyecto activo: `--project <ruta>` del argv gana, si no, la ruta de `npm run dev` (env), si no, cwd. */
export function resolverProyectoInicial(argv: readonly string[], cwd: string, env: NodeJS.ProcessEnv = process.env): string {
  const index = argv.indexOf("--project");
  if (index !== -1 && argv[index + 1]) {
    return path.resolve(argv[index + 1]);
  }
  if (env.AGENTE_QA_PROJECT) {
    return path.resolve(env.AGENTE_QA_PROJECT);
  }
  return cwd;
}

/**
 * Reemplaza a mano `projectPaths` de `agente-qa-contract/project` (Bloque 2: esa dependencia se
 * quita del todo). Mismas rutas que el contrato calculaba bajo `.agente-qa/`; solo el campo que
 * este repo usa hoy (features) — el resto (mapa, estado, capturas, config/credenciales del
 * sistema viejo retirado en el Bloque 3) pertenecía al CLI/mapa antiguo o a una spec anterior.
 */
export function projectPaths(rootDir: string): {
  root: string;
  dir: string;
  featuresDir: string;
} {
  const dir = path.join(rootDir, ".agente-qa");
  return {
    root: rootDir,
    dir,
    featuresDir: path.join(dir, "features"),
  };
}

/** Ruta de `agente-qa.config.json` en la raíz del repo (Bloque 3): distinto de `.agente-qa/`, que
 *  es solo para lo derivado en disco (features, informes). Este fichero sí se versiona. */
export function configRaizPath(rootDir: string): string {
  return path.join(rootDir, "agente-qa.config.json");
}

/**
 * Lee `agente-qa.config.json` de la raíz del repo. `null` si no existe o no tiene forma válida:
 * quien llama decide qué hacer — `bin/agente-qa.mjs` lo crea preguntando la URL base.
 */
export async function leerConfigRaiz(rootDir: string): Promise<ConfigRaiz | null> {
  let raw: unknown;
  try {
    raw = JSON.parse(await fs.readFile(configRaizPath(rootDir), "utf8"));
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;
  const candidato = raw as Record<string, unknown>;
  if (typeof candidato.appUrl !== "string" || candidato.appUrl === "") return null;
  return { schemaVersion: 1, appUrl: candidato.appUrl };
}

export async function escribirConfigRaiz(rootDir: string, config: ConfigRaiz): Promise<void> {
  await fs.writeFile(configRaizPath(rootDir), JSON.stringify(config, null, 2) + "\n", "utf8");
}
