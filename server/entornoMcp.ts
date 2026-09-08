// Replica (sin importar) las convenciones de configuración de `agente-qa-mcp` que no viven en
// el contrato: la carpeta de config global y el `.env` que hay dentro
// (`src/config/{paths,env}.ts`) y el orden de capas entorno > proyecto > global
// (`src/config/resolve.ts`). Son fórmulas de pocas líneas, no lógica de negocio: se copian a
// propósito para que el `.env` que edita esta web sea el mismo fichero que lee el CLI cuando se
// lanza como subproceso. La modalidad de LLM (`api`/`suscripcion`) y, con `api`, el proveedor y
// el modelo NO viven aquí (Spec B, Bloque 1: ya no son variables de entorno) — viven en `llm` de
// `config.json` del proyecto, y los lee/escribe `config.ts` directamente vía el contrato.
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";
import { projectPaths } from "agente-qa-contract/project";
import type { CapaConfig } from "../shared/tipos.js";

const NOMBRE_APP_MCP = "agente-qa-mcp";

/** Carpeta de configuración global de `agente-qa-mcp` (`src/config/paths.ts:configDir`). */
export function carpetaConfigGlobalMcp(): string {
  switch (platform()) {
    case "win32":
      return join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), NOMBRE_APP_MCP);
    case "darwin":
      return join(homedir(), "Library", "Preferences", NOMBRE_APP_MCP);
    default:
      return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), NOMBRE_APP_MCP);
  }
}

/** `.env` global de `agente-qa-mcp` (`src/config/paths.ts:configEnvPath`). */
export function envGlobalMcpPath(): string {
  return join(carpetaConfigGlobalMcp(), ".env");
}

// --- Lectura/escritura de `.env`, idéntico a `agente-qa-mcp/src/config/env.ts` ------------------

export function parseEnv(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key === "") continue;
    result[key] = value;
  }
  return result;
}

export function serializeEnv(vars: Record<string, string>): string {
  const lines = Object.entries(vars).map(([key, value]) => `${key}=${value}`);
  return lines.length === 0 ? "" : lines.join("\n") + "\n";
}

export async function leerEnv(filePath: string): Promise<Record<string, string>> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch {
    return {};
  }
  return parseEnv(raw);
}

/** Sobreescribe el fichero entero (quien llame ya debe haber combinado con lo existente). */
export async function escribirEnv(filePath: string, vars: Record<string, string>): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, serializeEnv(vars), { mode: 0o600 });
  try {
    await chmod(filePath, 0o600);
  } catch {
    // Windows u otro sistema sin permisos POSIX fiables: no hay nada que arreglar aquí.
  }
}

// --- Proveedores y claves (`src/config/resolve.ts`) ---------------------------------------------

export type Proveedor = "anthropic" | "openai" | "google" | "groq";
export const PROVEEDORES: readonly Proveedor[] = ["anthropic", "openai", "google", "groq"];

export function esProveedor(value: string): value is Proveedor {
  return (PROVEEDORES as readonly string[]).includes(value);
}

export function nombreVarClave(proveedor: Proveedor): string {
  switch (proveedor) {
    case "anthropic":
      return "ANTHROPIC_API_KEY";
    case "openai":
      return "OPENAI_API_KEY";
    case "google":
      return "GOOGLE_API_KEY";
    case "groq":
      return "GROQ_API_KEY";
  }
}

// --- Credenciales de la app bajo test (`src/agent/credentials.ts`) ---------------------------------

export const VAR_USUARIO_APP = "APP_USERNAME";
export const VAR_PASSWORD_APP = "APP_PASSWORD";

// --- Merge de las tres capas, igual que `buildLookup` de `resolve.ts` ------------------------------

export interface CampoResuelto {
  valor: string;
  capa: CapaConfig;
}

export async function buscarVariable(
  nombre: string,
  projectRoot: string,
  globalEnvPath: string = envGlobalMcpPath()
): Promise<CampoResuelto | undefined> {
  const fromEnv = process.env[nombre];
  if (fromEnv !== undefined && fromEnv !== "") {
    return { valor: fromEnv, capa: "entorno" };
  }
  const proyectoVars = await leerEnv(projectPaths(projectRoot).envPath);
  const fromProyecto = proyectoVars[nombre];
  if (fromProyecto !== undefined && fromProyecto !== "") {
    return { valor: fromProyecto, capa: "proyecto" };
  }
  const globalVars = await leerEnv(globalEnvPath);
  const fromGlobal = globalVars[nombre];
  if (fromGlobal !== undefined && fromGlobal !== "") {
    return { valor: fromGlobal, capa: "global" };
  }
  return undefined;
}

export type EscribirVariableResultado = { ok: true } | { ok: false; motivo: string };

/** Escribe `nombre=valor` en la capa `proyecto` o `global`. Rechaza si la variable ya viene del entorno. */
export async function escribirVariable(
  nombre: string,
  valor: string,
  capaDestino: "proyecto" | "global",
  projectRoot: string,
  globalEnvPath: string = envGlobalMcpPath()
): Promise<EscribirVariableResultado> {
  const actual = await buscarVariable(nombre, projectRoot, globalEnvPath);
  if (actual?.capa === "entorno") {
    return { ok: false, motivo: `${nombre} viene de una variable de entorno del sistema: no se puede editar desde la web.` };
  }
  const ruta = capaDestino === "proyecto" ? projectPaths(projectRoot).envPath : globalEnvPath;
  const vars = await leerEnv(ruta);
  vars[nombre] = valor;
  await escribirEnv(ruta, vars);
  return { ok: true };
}
