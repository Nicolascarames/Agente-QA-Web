// Lectura/escritura de la configuración de proyecto (spec Bloque 4, `llm` desde Spec B/Bloque 3):
// el `config.json`/`.env` del proyecto activo (`projectPaths` del contrato). Puro en el sentido
// de que no guarda nada en memoria: cada lectura vuelve a tocar disco, igual que `estado.ts`.
import { promises as fs } from "node:fs";
import { parseProjectConfig, projectPaths, type LlmConfig, type ProjectConfig } from "agente-qa-contract/project";
import type {
  CambiosConfigProyecto,
  CampoConfig,
  CampoSecreto,
  ConfigProyecto,
  ConfigProyectoRespuesta,
  LlmProyecto,
} from "../shared/tipos.js";
import { VAR_PASSWORD_APP, VAR_USUARIO_APP, buscarVariable, escribirVariable, type CampoResuelto } from "./entornoMcp.js";

async function existeDirectorio(ruta: string): Promise<boolean> {
  try {
    const info = await fs.stat(ruta);
    return info.isDirectory();
  } catch {
    return false;
  }
}

function campoProyecto<T>(valor: T): CampoConfig<T> {
  return { valor, capa: "proyecto", editable: true };
}

/**
 * `llm` de `config.json`, o el valor por defecto (`api` sin proveedor ni modelo aún) si el
 * proyecto no lo tiene todavía — no dispara la migración silenciosa desde perfiles/roles que sí
 * hace `agente-qa-mcp config --show`: eso es cosa del CLI, esto solo refleja lo que ya hay en disco.
 */
function llmProyecto(llm: LlmConfig | undefined): LlmProyecto {
  if (llm === undefined) return { modalidad: "api", proveedor: null, modelo: null };
  if (llm.modalidad === "suscripcion") return { modalidad: "suscripcion", proveedor: null, modelo: null };
  return { modalidad: "api", proveedor: llm.proveedor ?? null, modelo: llm.modelo ?? null };
}

/** Nunca lleva el valor completo: mismo criterio que `ClaveInfo` de `claves.ts`. */
function campoSecreto(resuelto: CampoResuelto | undefined): CampoSecreto {
  if (resuelto === undefined) return { hayValor: false, ultimos4: null, capa: null, editable: true };
  return { hayValor: true, ultimos4: resuelto.valor.slice(-4), capa: resuelto.capa, editable: resuelto.capa !== "entorno" };
}

async function leerConfigJson(configPath: string): Promise<Partial<ProjectConfig>> {
  let raw: unknown;
  try {
    raw = JSON.parse(await fs.readFile(configPath, "utf8"));
  } catch {
    return {};
  }
  const parsed = parseProjectConfig(raw);
  return parsed.ok ? parsed.config : {};
}

async function leerMemoria(memoryPath: string): Promise<unknown> {
  try {
    return JSON.parse(await fs.readFile(memoryPath, "utf8"));
  } catch {
    return {};
  }
}

export type EscribirConfigProyectoResultado = { ok: true } | { ok: false; motivo: string };

export async function leerConfigProyecto(rootDir: string): Promise<ConfigProyectoRespuesta> {
  const paths = projectPaths(rootDir);
  if (!(await existeDirectorio(paths.dir))) {
    return { inicializado: false };
  }

  const base = await leerConfigJson(paths.configPath);
  const [usuario, password, memoria] = await Promise.all([
    buscarVariable(VAR_USUARIO_APP, rootDir),
    buscarVariable(VAR_PASSWORD_APP, rootDir),
    leerMemoria(paths.memoryPath),
  ]);

  const config: ConfigProyecto = {
    appUrl: campoProyecto(base.appUrl ?? ""),
    environment: campoProyecto(base.environment ?? "dev"),
    limits: {
      maxIterations: campoProyecto(base.limits?.maxIterations ?? 40),
      maxScreens: campoProyecto(base.limits?.maxScreens ?? 25),
      maxCostUsd: campoProyecto(base.limits?.maxCostUsd ?? 2),
    },
    llm: llmProyecto(base.llm),
    credenciales: {
      usuario: campoSecreto(usuario),
      password: campoSecreto(password),
    },
    memoria,
  };
  return { inicializado: true, config };
}

export type VerCredencialResultado = { ok: true; valor: string } | { ok: false; motivo: string };

/** Única función que devuelve el valor completo de una credencial de proyecto (mismo criterio que `claves.ts:verClave`). */
export async function verCredencialProyecto(rootDir: string, campo: "usuario" | "password"): Promise<VerCredencialResultado> {
  const nombre = campo === "usuario" ? VAR_USUARIO_APP : VAR_PASSWORD_APP;
  const resuelto = await buscarVariable(nombre, rootDir);
  if (!resuelto) {
    return { ok: false, motivo: `No hay ${campo === "usuario" ? "usuario" : "contraseña"} configurado para este proyecto.` };
  }
  return { ok: true, valor: resuelto.valor };
}

/** Escribe `config.json` (URL/entorno/límites), `.env` de proyecto (credenciales) y `memory.json`. */
export async function escribirConfigProyecto(
  rootDir: string,
  cambios: CambiosConfigProyecto
): Promise<EscribirConfigProyectoResultado> {
  const paths = projectPaths(rootDir);
  if (!(await existeDirectorio(paths.dir))) {
    return { ok: false, motivo: "El proyecto no tiene .agente-qa/: ejecuta init antes de configurar." };
  }

  const actualParcial = await leerConfigJson(paths.configPath);
  const actual: ProjectConfig = {
    schemaVersion: 1,
    appUrl: actualParcial.appUrl ?? cambios.appUrl ?? "http://localhost",
    environment: actualParcial.environment ?? cambios.environment ?? "dev",
    limits: {
      maxIterations: actualParcial.limits?.maxIterations ?? 40,
      maxScreens: actualParcial.limits?.maxScreens ?? 25,
      maxCostUsd: actualParcial.limits?.maxCostUsd ?? 2,
    },
    ...(actualParcial.loginRecipe !== undefined ? { loginRecipe: actualParcial.loginRecipe } : {}),
    ...(actualParcial.testIdAttribute !== undefined ? { testIdAttribute: actualParcial.testIdAttribute } : {}),
    ...(actualParcial.llm !== undefined ? { llm: actualParcial.llm } : {}),
  };

  const siguiente: ProjectConfig = {
    ...actual,
    appUrl: cambios.appUrl ?? actual.appUrl,
    environment: cambios.environment ?? actual.environment,
    limits: {
      maxIterations: cambios.limits?.maxIterations ?? actual.limits.maxIterations,
      maxScreens: cambios.limits?.maxScreens ?? actual.limits.maxScreens,
      maxCostUsd: cambios.limits?.maxCostUsd ?? actual.limits.maxCostUsd,
    },
    ...(cambios.llm !== undefined ? { llm: cambios.llm } : {}),
  };

  const validado = parseProjectConfig(siguiente);
  if (!validado.ok) {
    return { ok: false, motivo: validado.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ") };
  }
  await fs.writeFile(paths.configPath, JSON.stringify(validado.config, null, 2) + "\n", "utf8");

  if (cambios.credenciales?.usuario !== undefined) {
    const resultado = await escribirVariable(VAR_USUARIO_APP, cambios.credenciales.usuario, "proyecto", rootDir);
    if (!resultado.ok) return resultado;
  }
  if (cambios.credenciales?.password !== undefined) {
    const resultado = await escribirVariable(VAR_PASSWORD_APP, cambios.credenciales.password, "proyecto", rootDir);
    if (!resultado.ok) return resultado;
  }
  if (cambios.memoria !== undefined) {
    await fs.writeFile(paths.memoryPath, JSON.stringify(cambios.memoria, null, 2) + "\n", "utf8");
  }

  return { ok: true };
}
