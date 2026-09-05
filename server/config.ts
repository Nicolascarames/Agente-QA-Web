// Lectura/escritura de las dos capas de configuración (spec Bloque 4): el `config.json`/`.env`
// del proyecto activo (`projectPaths` del contrato) y el `.env` global de `agente-qa-mcp`
// (`entornoMcp.ts`). Puro en el sentido de que no guarda nada en memoria: cada lectura vuelve a
// tocar disco, igual que `estado.ts`.
import { promises as fs } from "node:fs";
import { parseProjectConfig, projectPaths, type ProjectConfig } from "agente-qa-contract/project";
import type {
  CambiosConfigGlobal,
  CambiosConfigProyecto,
  CampoConfig,
  CampoConfigVacio,
  CampoSecreto,
  ConfigGlobal,
  ConfigProyecto,
  ConfigProyectoRespuesta,
  ModoCoste,
  Perfil,
  PerfilConfig,
  Proveedor,
  Rol,
} from "../shared/tipos.js";
import {
  MODO_COSTE_POR_DEFECTO,
  PERFILES,
  PERFIL_POR_DEFECTO_ROL,
  ROLES,
  VAR_MODO_COSTE,
  VAR_PASSWORD_APP,
  VAR_USUARIO_APP,
  buscarVariable,
  envGlobalMcpPath,
  escribirVariable,
  esModoCoste,
  esProveedor,
  nombreVarPerfilModelo,
  nombreVarPerfilProveedor,
  nombreVarRol,
  type CampoResuelto,
  type EscribirVariableResultado,
} from "./entornoMcp.js";

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

function campoVacio<T extends string>(resuelto: CampoResuelto | undefined): CampoConfigVacio<T> {
  if (resuelto === undefined) return { valor: null, capa: null, editable: true };
  return { valor: resuelto.valor as T, capa: resuelto.capa, editable: resuelto.capa !== "entorno" };
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

export async function leerConfigGlobal(rootDir: string): Promise<ConfigGlobal> {
  const perfiles = {} as Record<Perfil, PerfilConfig>;
  for (const perfil of PERFILES) {
    const provider = await buscarVariable(nombreVarPerfilProveedor(perfil), rootDir);
    const model = await buscarVariable(nombreVarPerfilModelo(perfil), rootDir);
    perfiles[perfil] = {
      provider: provider && esProveedor(provider.valor) ? campoVacio<Proveedor>(provider) : { valor: null, capa: null, editable: true },
      model: campoVacio<string>(model),
    };
  }

  const modoCosteResuelto = await buscarVariable(VAR_MODO_COSTE, rootDir);
  const modoCoste: CampoConfig<ModoCoste> =
    modoCosteResuelto && esModoCoste(modoCosteResuelto.valor)
      ? { valor: modoCosteResuelto.valor, capa: modoCosteResuelto.capa, editable: modoCosteResuelto.capa !== "entorno" }
      : { valor: MODO_COSTE_POR_DEFECTO, capa: "global", editable: true };

  const roles = {} as Record<Rol, CampoConfig<Perfil>>;
  for (const rol of ROLES) {
    const resuelto = await buscarVariable(nombreVarRol(rol), rootDir);
    roles[rol] =
      resuelto && (PERFILES as readonly string[]).includes(resuelto.valor)
        ? { valor: resuelto.valor as Perfil, capa: resuelto.capa, editable: resuelto.capa !== "entorno" }
        : { valor: PERFIL_POR_DEFECTO_ROL[rol], capa: "global", editable: true };
  }

  return { perfiles, modoCoste, roles };
}

/** Todo lo global se escribe en el `.env` de `agente-qa-mcp`, nunca en el del proyecto activo. */
export async function escribirConfigGlobal(rootDir: string, cambios: CambiosConfigGlobal): Promise<EscribirVariableResultado> {
  const globalEnvPath = envGlobalMcpPath();

  for (const perfil of PERFILES) {
    const cambiosPerfil = cambios.perfiles?.[perfil];
    if (cambiosPerfil?.provider !== undefined) {
      const resultado = await escribirVariable(nombreVarPerfilProveedor(perfil), cambiosPerfil.provider, "global", rootDir, globalEnvPath);
      if (!resultado.ok) return resultado;
    }
    if (cambiosPerfil?.model !== undefined) {
      const resultado = await escribirVariable(nombreVarPerfilModelo(perfil), cambiosPerfil.model, "global", rootDir, globalEnvPath);
      if (!resultado.ok) return resultado;
    }
  }

  if (cambios.modoCoste !== undefined) {
    const resultado = await escribirVariable(VAR_MODO_COSTE, cambios.modoCoste, "global", rootDir, globalEnvPath);
    if (!resultado.ok) return resultado;
  }

  for (const rol of ROLES) {
    const valor = cambios.roles?.[rol];
    if (valor !== undefined) {
      const resultado = await escribirVariable(nombreVarRol(rol), valor, "global", rootDir, globalEnvPath);
      if (!resultado.ok) return resultado;
    }
  }

  return { ok: true };
}
