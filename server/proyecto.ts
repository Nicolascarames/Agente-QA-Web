import { promises as fs } from "node:fs";
import path from "node:path";
import type { ConfigCredenciales, ConfigRaiz, PoliticaPuertas } from "../shared/tipos.js";

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

const POLITICAS_PUERTAS_VALIDAS: readonly PoliticaPuertas[] = ["escenario", "escenario-y-codigo", "por-artefacto", "por-fichero"];

function politicaPuertasValida(valor: unknown): PoliticaPuertas {
  return (POLITICAS_PUERTAS_VALIDAS as readonly unknown[]).includes(valor) ? (valor as PoliticaPuertas) : "escenario";
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
  return {
    schemaVersion: 1,
    appUrl: candidato.appUrl,
    entorno: typeof candidato.entorno === "string" ? candidato.entorno : "pruebas",
    barrera: typeof candidato.barrera === "boolean" ? candidato.barrera : false,
    listaBlanca: Array.isArray(candidato.listaBlanca) ? (candidato.listaBlanca as string[]) : [],
    puertas: politicaPuertasValida(candidato.puertas),
  };
}

export async function escribirConfigRaiz(rootDir: string, config: ConfigRaiz): Promise<void> {
  await fs.writeFile(configRaizPath(rootDir), JSON.stringify(config, null, 2) + "\n", "utf8");
}

/** Ruta de `agente-qa.credenciales.json`: aparte de `agente-qa.config.json` a propósito — ese
 *  fichero se versiona (ver `configRaizPath`) y este no debe hacerlo nunca, son secretos de prueba
 *  reales (usuario/contraseña u otra variable que el usuario decida). En `.gitignore` desde que
 *  existe esta función. */
export function credencialesPath(rootDir: string): string {
  return path.join(rootDir, "agente-qa.credenciales.json");
}

/** `[]` si el fichero no existe o no tiene forma válida — igual de tolerante que `leerConfigRaiz`,
 *  pero sin la puerta de "appUrl obligatorio": sin credenciales guardadas es un estado normal, no
 *  uno inválido. */
export async function leerCredenciales(rootDir: string): Promise<ConfigCredenciales> {
  let raw: unknown;
  try {
    raw = JSON.parse(await fs.readFile(credencialesPath(rootDir), "utf8"));
  } catch {
    return { schemaVersion: 1, variables: [] };
  }
  if (typeof raw !== "object" || raw === null) return { schemaVersion: 1, variables: [] };
  const candidato = raw as Record<string, unknown>;
  const variables = Array.isArray(candidato.variables)
    ? (candidato.variables as unknown[]).filter(
        (v): v is { nombre: string; valor: string } =>
          typeof v === "object" && v !== null && typeof (v as { nombre?: unknown }).nombre === "string" && typeof (v as { valor?: unknown }).valor === "string"
      )
    : [];
  return { schemaVersion: 1, variables };
}

const ENTRADA_GITIGNORE = "agente-qa.credenciales.json";

/** El repo destino es de quien lo usa: esta app no puede asumir que ya ignora
 *  `agente-qa.credenciales.json`. Sin esto, guardar una contraseña de prueba desde Configuración y
 *  hacer `git add -A` a la ligera la manda al historial de git — se añade la línea al `.gitignore`
 *  de la raíz (se crea si no existe) la primera vez que se escribe el fichero, solo si no está ya. */
async function asegurarGitignoreCredenciales(rootDir: string): Promise<void> {
  const ruta = path.join(rootDir, ".gitignore");
  let actual = "";
  try {
    actual = await fs.readFile(ruta, "utf8");
  } catch {
    // Sin .gitignore todavía: se crea con solo esta línea.
  }
  if (actual.split(/\r?\n/).some((linea) => linea.trim() === ENTRADA_GITIGNORE)) return;
  const separador = actual.length > 0 && !actual.endsWith("\n") ? "\n" : "";
  await fs.writeFile(ruta, `${actual}${separador}${ENTRADA_GITIGNORE}\n`, "utf8");
}

export async function escribirCredenciales(rootDir: string, credenciales: ConfigCredenciales): Promise<void> {
  await asegurarGitignoreCredenciales(rootDir);
  await fs.writeFile(credencialesPath(rootDir), JSON.stringify(credenciales, null, 2) + "\n", "utf8");
}
