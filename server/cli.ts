// Localización del binario `agente-qa-mcp` (spec Bloque 4, decisión 10 de la entrevista):
// PATH -> repo hermano compilado al lado -> ruta guardada a mano. Diagnóstico legible si no
// aparece en ningún sitio, nunca una excepción críptica.
import { existsSync, promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import spawn from "cross-spawn";
import type { ResultadoCli, ResultadoSubproceso } from "../shared/tipos.js";
import { carpetaDatosApp } from "./proyecto.js";

const NOMBRE_BINARIO = "agente-qa-mcp";

const dirActual = path.dirname(fileURLToPath(import.meta.url));
// Este fichero compila a dist-server/cli.js; en dev (tsx) vive en server/. En los dos casos
// está un nivel bajo la raíz del repo, así que subir un nivel llega a la raíz siempre.
const raizRepo = path.resolve(dirActual, "..");

function rutaRepoHermano(): string {
  return path.resolve(raizRepo, "..", "AGENTE-QA-MCP", "dist", "cli", "index.js");
}

function rutaCliGuardadoPath(): string {
  return path.join(carpetaDatosApp(), "cli-path.json");
}

async function leerRutaGuardada(): Promise<string | undefined> {
  try {
    const contenido = await fs.readFile(rutaCliGuardadoPath(), "utf8");
    const datos = JSON.parse(contenido) as { ruta?: string };
    return typeof datos.ruta === "string" && datos.ruta !== "" ? datos.ruta : undefined;
  } catch {
    return undefined;
  }
}

/** Guarda a mano la ruta del binario cuando ni PATH ni el repo hermano lo encuentran. */
export async function guardarRutaCli(ruta: string): Promise<void> {
  const destino = rutaCliGuardadoPath();
  await fs.mkdir(path.dirname(destino), { recursive: true });
  await fs.writeFile(destino, `${JSON.stringify({ ruta }, null, 2)}\n`, "utf8");
}

/** `cross-spawn` no expone la ruta resuelta: `!error` basta para saber que el binario existe en PATH. */
function encontradoEnPath(): boolean {
  const resultado = spawn.sync(NOMBRE_BINARIO, ["--version"], { stdio: "ignore" });
  return !resultado.error;
}

export interface CliLocalizado {
  comando: string;
  argsPrevios: string[];
  origen: "PATH" | "repo-hermano" | "guardado";
  ruta: string;
}

export type ResultadoLocalizarCli = { encontrado: true; cli: CliLocalizado } | { encontrado: false; diagnostico: string[] };

export interface OpcionesLocalizarCli {
  /** Seam de test: evita depender de si `agente-qa-mcp` está instalado de verdad en el PATH de la máquina. */
  comprobarPath?: () => boolean;
  /** Seam de test: evita depender de que el repo hermano compilado exista de verdad al lado de este repo. */
  rutaRepoHermano?: string;
}

/** PATH -> repo hermano compilado al lado -> ruta guardada a mano (`%APPDATA%/agente-qa-web/cli-path.json`). */
export async function localizarCli(opciones: OpcionesLocalizarCli = {}): Promise<ResultadoLocalizarCli> {
  const diagnostico: string[] = [];
  const comprobarPath = opciones.comprobarPath ?? encontradoEnPath;

  if (comprobarPath()) {
    return { encontrado: true, cli: { comando: NOMBRE_BINARIO, argsPrevios: [], origen: "PATH", ruta: NOMBRE_BINARIO } };
  }
  diagnostico.push(`PATH: no se encontró el binario "${NOMBRE_BINARIO}".`);

  const hermano = opciones.rutaRepoHermano ?? rutaRepoHermano();
  if (existsSync(hermano)) {
    return { encontrado: true, cli: { comando: process.execPath, argsPrevios: [hermano], origen: "repo-hermano", ruta: hermano } };
  }
  diagnostico.push(`Repo hermano: no existe ${hermano}.`);

  const guardada = await leerRutaGuardada();
  if (guardada === undefined) {
    diagnostico.push(`Ruta guardada: no hay ninguna en ${rutaCliGuardadoPath()}.`);
  } else if (existsSync(guardada)) {
    return { encontrado: true, cli: { comando: process.execPath, argsPrevios: [guardada], origen: "guardado", ruta: guardada } };
  } else {
    diagnostico.push(`Ruta guardada: ${guardada} no existe en disco.`);
  }

  return { encontrado: false, diagnostico };
}

export function aResultadoCli(resultado: ResultadoLocalizarCli): ResultadoCli {
  if (resultado.encontrado) {
    return { encontrado: true, ruta: resultado.cli.ruta, origen: resultado.cli.origen, diagnostico: [] };
  }
  return { encontrado: false, diagnostico: resultado.diagnostico };
}

function ejecutarProceso(comando: string, args: string[], cwd: string): Promise<ResultadoSubproceso> {
  return new Promise((resolve) => {
    const proceso = spawn(comando, args, { cwd });
    let stdout = "";
    let stderr = "";
    proceso.stdout?.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
    proceso.stderr?.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    proceso.on("error", (err) => {
      resolve({ codigo: null, stdout, stderr: `${stderr}\n${err.message}` });
    });
    proceso.on("close", (codigo) => resolve({ codigo, stdout, stderr }));
  });
}

/** Lanza `agente-qa-mcp <args>` en `cwd` con el binario ya localizado. Devuelve stdout/stderr/código tal cual, sin reinterpretar la salida. */
export async function ejecutarCli(args: string[], cwd: string): Promise<ResultadoSubproceso> {
  const localizado = await localizarCli();
  if (!localizado.encontrado) {
    return { codigo: null, stdout: "", stderr: `No se encontró el binario "${NOMBRE_BINARIO}":\n${localizado.diagnostico.join("\n")}` };
  }
  return ejecutarProceso(localizado.cli.comando, [...localizado.cli.argsPrevios, ...args], cwd);
}
