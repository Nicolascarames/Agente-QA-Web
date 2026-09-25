import { execFile as execFileCb } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCb);

async function git(rootDir: string, args: string[]): Promise<string> {
  const { stdout } = await execFile("git", args, { cwd: rootDir });
  return stdout;
}

/**
 * Intent-to-add (`git add -N`) antes de diffear: sin él, un fichero nuevo sin trackear (el caso
 * normal recién generado por el agente) no aparece en `git diff -- <rutas>` — para git no existe
 * todavía. Sin `rutas`, diffea el repo entero.
 */
export async function diff(rootDir: string, rutas?: string[]): Promise<string> {
  const objetivo = rutas && rutas.length > 0 ? rutas : ["."];
  await git(rootDir, ["add", "-N", "--", ...objetivo]);
  return git(rootDir, ["diff", "--", ...objetivo]);
}

/**
 * Por qué `diff()` no tiene sentido para `ruta`, o `null` si sí lo tiene. Dos casos: el proyecto no
 * está bajo git (`git rev-parse` falla), o `ruta` está ignorada por un `.gitignore` — el caso real es
 * un proyecto sin git propio que vive dentro de este repo, bajo una carpeta que sí lo ignora (p.ej.
 * `pruebas/babia`, con `pruebas` en el `.gitignore` de este repo) — en ambos, `diff()` fallaría con
 * `git add -N` devolviendo "The following paths are ignored by one of your .gitignore files".
 * `git check-ignore -q` sale con 0 si está ignorada, 1 si no lo está y 128 si hay un error: solo el
 * 0 cuenta como "ignorada", el resto se trata igual que "no ignorada" (más simple y seguro aquí).
 */
export async function motivoSinControlDeVersiones(rootDir: string, ruta: string): Promise<string | null> {
  try {
    await git(rootDir, ["rev-parse", "--is-inside-work-tree"]);
  } catch {
    return "Este proyecto no está bajo git: no hay versión anterior con la que comparar.";
  }
  try {
    await execFile("git", ["check-ignore", "-q", "--", ruta], { cwd: rootDir });
    return "Esta ruta está ignorada por un .gitignore (el proyecto vive dentro de otro repositorio que lo excluye): no hay versión anterior con la que comparar. Para ver diffs, haz `git init` en la carpeta del proyecto.";
  } catch {
    return null;
  }
}

/** Rutas (relativas a `rootDir`) con cambios bajo `tests/`, en el formato corto de `git status`. */
export async function ficherosModificados(rootDir: string): Promise<string[]> {
  // `--untracked-files=all`: sin él, git agrupa un directorio recién creado entero en una sola
  // línea ("?? tests/") en vez de listar cada fichero nuevo dentro.
  const salida = await git(rootDir, ["status", "--porcelain", "--untracked-files=all", "--", "tests/"]);
  return salida
    .split("\n")
    .map((linea) => linea.trim())
    .filter((linea) => linea.length > 0)
    .map((linea) => linea.slice(2).trim());
}

export async function commit(rootDir: string, rutas: string[], mensaje: string): Promise<void> {
  await git(rootDir, ["add", "--", ...rutas]);
  await git(rootDir, ["commit", "-m", mensaje]);
}

/** true si `ruta` tiene un blob en HEAD (fichero ya trackeado, aunque esté modificado). */
async function existeEnHead(rootDir: string, ruta: string): Promise<boolean> {
  try {
    await git(rootDir, ["cat-file", "-e", `HEAD:${ruta}`]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Por ruta: si ya existía en HEAD, `git checkout --` revierte su contenido tal cual. Si es nueva
 * (el caso normal: el agente acaba de generarla), no hay blob en HEAD al que volver — un
 * `checkout --` sobre ella la deja en 0 bytes en vez de borrarla (comprobado a mano), así que se
 * borra del disco y se limpia el `add -N` que pudiera haber dejado `diff()` en el índice.
 */
export async function descartar(rootDir: string, rutas: string[]): Promise<void> {
  for (const ruta of rutas) {
    if (await existeEnHead(rootDir, ruta)) {
      await git(rootDir, ["checkout", "--", ruta]);
    } else {
      await fs.rm(path.join(rootDir, ruta), { force: true });
      await git(rootDir, ["reset", "--", ruta]);
    }
  }
}

/** Directorio inexistente (proyecto sin ningún fichero de ese tipo generado todavía) → lista vacía,
 *  nunca se crea aquí: solo escribir crea carpetas. Compartida por `app.ts`, `trazabilidad.ts` y
 *  `fragiles.ts` (Bloque 8). */
export async function listarFicheros(dir: string, extension: string): Promise<string[]> {
  let entradas;
  try {
    entradas = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entradas.filter((entrada) => entrada.isFile() && entrada.name.endsWith(extension)).map((entrada) => entrada.name);
}
