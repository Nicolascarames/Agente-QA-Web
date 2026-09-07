#!/usr/bin/env node
// @ts-check
// Genera `src/catalogo/cli.generado.json` ejecutando `agente-qa-mcp catalog --pretty` con el
// binario real. Localización idéntica a la cascada de `server/cli.ts` (PATH -> repo hermano
// compilado al lado -> ruta guardada a mano en %APPDATA%/agente-qa-web/cli-path.json): este
// script es la única otra puerta que necesita encontrar el binario, así que replica esa lógica
// en vez de duplicarla a su manera (no puede importar `server/cli.ts` directamente: ese fichero
// es TypeScript y este script corre con `node` a pelo, antes de cualquier compilación).
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import spawn from "cross-spawn";

const NOMBRE_BINARIO = "agente-qa-mcp";

const dirActual = path.dirname(fileURLToPath(import.meta.url));
const raizRepo = path.resolve(dirActual, "..");
const destino = path.join(raizRepo, "src", "catalogo", "cli.generado.json");

function rutaRepoHermano() {
  return path.resolve(raizRepo, "..", "AGENTE-QA-MCP", "dist", "cli", "index.js");
}

function rutaCliGuardadoPath() {
  const appData = process.env.APPDATA;
  return appData ? path.join(appData, "agente-qa-web", "cli-path.json") : undefined;
}

/**
 * @param {unknown} datos
 * @returns {string | undefined}
 */
function extraerRuta(datos) {
  if (datos && typeof datos === "object" && "ruta" in datos && typeof datos.ruta === "string" && datos.ruta !== "") {
    return datos.ruta;
  }
  return undefined;
}

function leerRutaGuardada() {
  const ruta = rutaCliGuardadoPath();
  if (!ruta) return undefined;
  try {
    return extraerRuta(JSON.parse(readFileSync(ruta, "utf8")));
  } catch {
    return undefined;
  }
}

/** `cross-spawn` no expone la ruta resuelta: `!error` basta para saber que el binario existe en PATH. */
function encontradoEnPath() {
  const resultado = spawn.sync(NOMBRE_BINARIO, ["--version"], { stdio: "ignore" });
  return !resultado.error;
}

/**
 * PATH -> repo hermano compilado al lado -> ruta guardada a mano. Sale con código 1 si no aparece en ningún sitio.
 * @returns {{ comando: string; argsPrevios: string[] }}
 */
function localizarCliOMorir() {
  const diagnostico = [];

  if (encontradoEnPath()) {
    return { comando: NOMBRE_BINARIO, argsPrevios: [] };
  }
  diagnostico.push(`PATH: no se encontró el binario "${NOMBRE_BINARIO}".`);

  const hermano = rutaRepoHermano();
  if (existsSync(hermano)) {
    return { comando: process.execPath, argsPrevios: [hermano] };
  }
  diagnostico.push(`Repo hermano: no existe ${hermano}.`);

  const guardada = leerRutaGuardada();
  const rutaGuardadoPath = rutaCliGuardadoPath();
  if (guardada === undefined) {
    diagnostico.push(`Ruta guardada: no hay ninguna en ${rutaGuardadoPath ?? "(APPDATA no está definido)"}.`);
  } else if (existsSync(guardada)) {
    return { comando: process.execPath, argsPrevios: [guardada] };
  } else {
    diagnostico.push(`Ruta guardada: ${guardada} no existe en disco.`);
  }

  console.error(`[catalogo:sync] No se encontró el binario "${NOMBRE_BINARIO}":\n${diagnostico.join("\n")}`);
  process.exit(1);
}

async function main() {
  const localizado = localizarCliOMorir();
  const resultado = spawn.sync(localizado.comando, [...localizado.argsPrevios, "catalog", "--pretty"], { encoding: "utf8" });

  if (resultado.error || resultado.status !== 0) {
    console.error(`[catalogo:sync] "agente-qa-mcp catalog --pretty" falló:\n${resultado.stderr || resultado.error?.message || ""}`);
    process.exit(1);
  }

  await mkdir(path.dirname(destino), { recursive: true });
  await writeFile(destino, `${resultado.stdout.trimEnd()}\n`, "utf8");
  console.log(`[catalogo:sync] Catálogo escrito en ${destino}`);
}

await main();
