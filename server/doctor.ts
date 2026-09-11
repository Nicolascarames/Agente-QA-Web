// El `doctor` del Bloque 3: cuatro comprobaciones del entorno, cada una con un mensaje accionable.
// No hay función documentada del SDK para esto (ver ESTADO.md): se construye a mano.
import { promises as fs } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

const requerirDesdeAqui = createRequire(import.meta.url);

export interface ResultadoComprobacion {
  nombre: string;
  ok: boolean;
  mensaje: string;
}

export interface ResultadoDoctor {
  ok: boolean;
  comprobaciones: ResultadoComprobacion[];
}

async function existeFichero(ruta: string): Promise<boolean> {
  try {
    await fs.access(ruta);
    return true;
  } catch {
    return false;
  }
}

/**
 * Rutas de credenciales de Claude Code por plataforma (comprobado contra documentación oficial,
 * ver ESTADO.md): `%USERPROFILE%\.claude\.credentials.json` en Windows, `~/.claude/.credentials.json`
 * en Linux, y en macOS el llavero con fallback al mismo fichero. `CLAUDE_CONFIG_DIR` sustituye a
 * `~/.claude` si está definida, en cualquier plataforma.
 *
 * La comprobación real del llavero de macOS (`security find-generic-password`) no se implementa
 * aquí: no hay forma de verificar el nombre exacto del servicio sin una máquina macOS a mano, y
 * adivinarlo daría falsos negativos silenciosos. Queda como comprobación de fichero únicamente en
 * las tres plataformas — anotado en PROXIMOS-PASOS.md como deuda.
 */
export async function comprobarCredenciales(env: NodeJS.ProcessEnv = process.env, homedir: string = os.homedir()): Promise<ResultadoComprobacion> {
  const nombre = "Sesión de Claude Code";
  const dirBase = env.CLAUDE_CONFIG_DIR ? path.resolve(env.CLAUDE_CONFIG_DIR) : path.join(homedir, ".claude");
  const rutaArchivo = path.join(dirBase, ".credentials.json");

  if (await existeFichero(rutaArchivo)) {
    return { nombre, ok: true, mensaje: `Sesión encontrada en ${rutaArchivo}.` };
  }
  return {
    nombre,
    ok: false,
    mensaje: "No has iniciado sesión en Claude Code en este ordenador. Ejecuta: claude login",
  };
}

/**
 * El SDK publica el binario nativo como paquete opcional por plataforma+arquitectura
 * (`@anthropic-ai/claude-agent-sdk-<plataforma>-<arco>[-musl]`, comprobado instalándolo: ver
 * ESTADO.md). `resolverPaquete` es inyectable para el test — por defecto usa resolución real de
 * Node sobre este propio paquete (`agente-qa-web`), no sobre el proyecto destino.
 */
export async function comprobarBinarioSdk(
  resolverPaquete: (especificador: string) => string = (especificador) => requerirDesdeAqui.resolve(especificador)
): Promise<ResultadoComprobacion> {
  const nombre = "Binario nativo del SDK";
  const plataforma = process.platform;
  const arco = process.arch;
  const nombreBinario = plataforma === "win32" ? "claude.exe" : "claude";
  const sufijos = plataforma === "linux" ? ["", "-musl"] : [""];

  for (const sufijo of sufijos) {
    const paquete = `@anthropic-ai/claude-agent-sdk-${plataforma}-${arco}${sufijo}`;
    let rutaPackageJson: string;
    try {
      rutaPackageJson = resolverPaquete(`${paquete}/package.json`);
    } catch {
      continue;
    }
    const rutaBinario = path.join(path.dirname(rutaPackageJson), nombreBinario);
    if (await existeFichero(rutaBinario)) {
      return { nombre, ok: true, mensaje: `Encontrado en ${rutaBinario}.` };
    }
  }
  return {
    nombre,
    ok: false,
    mensaje: "Falta el binario del SDK. Reinstala sin --omit=optional",
  };
}

const NODE_MINIMO = 18;

export function comprobarNode(version: string = process.versions.node): ResultadoComprobacion {
  const nombre = "Versión de Node";
  const mayor = Number(version.split(".")[0]);
  const ok = mayor >= NODE_MINIMO;
  return {
    nombre,
    ok,
    mensaje: ok ? `Node ${version} (mínimo ${String(NODE_MINIMO)}).` : `Node ${version} encontrado; hace falta ${String(NODE_MINIMO)} o superior.`,
  };
}

export async function comprobarPlaywright(rootDir: string): Promise<ResultadoComprobacion> {
  const nombre = "Playwright en el proyecto";
  const ruta = path.join(rootDir, "node_modules", "@playwright", "test", "package.json");
  const ok = await existeFichero(ruta);
  return {
    nombre,
    ok,
    mensaje: ok ? "@playwright/test está instalado." : "npm i -D @playwright/test && npx playwright install chromium",
  };
}

export async function ejecutarDoctor(rootDir: string, env: NodeJS.ProcessEnv = process.env): Promise<ResultadoDoctor> {
  const comprobaciones = await Promise.all([comprobarCredenciales(env), comprobarBinarioSdk(), Promise.resolve(comprobarNode()), comprobarPlaywright(rootDir)]);
  return { ok: comprobaciones.every((c) => c.ok), comprobaciones };
}
