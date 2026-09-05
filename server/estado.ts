import { promises as fs } from "node:fs";
import type { Dirent } from "node:fs";
import path from "node:path";
import { parseAppMap } from "agente-qa-contract";
import { projectPaths } from "agente-qa-contract/project";
import type { EstadoFicheros, EstadoMapa, EstadoProyecto, MapaCompleto } from "../shared/tipos.js";

async function existeDirectorio(ruta: string): Promise<boolean> {
  try {
    const info = await fs.stat(ruta);
    return info.isDirectory();
  } catch {
    return false;
  }
}

async function contarFicheros(dir: string, extension?: string): Promise<number> {
  let entradas: Dirent[];
  try {
    entradas = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  const ficheros = entradas.filter((entrada) => entrada.isFile());
  return extension ? ficheros.filter((f) => f.name.endsWith(extension)).length : ficheros.length;
}

/**
 * `map.json` se lee y valida SOLO con el parser del contrato (`agente-qa-contract`):
 * esta web nunca interpreta su forma a mano.
 */
async function leerEstadoMapa(mapPath: string): Promise<EstadoMapa> {
  const vacio: EstadoMapa = { estado: "no existe", pantallas: 0, localizadores: 0, candidatosEscenario: 0 };

  let contenido: string;
  try {
    contenido = await fs.readFile(mapPath, "utf8");
  } catch {
    return vacio;
  }

  let json: unknown;
  try {
    json = JSON.parse(contenido);
  } catch {
    return { ...vacio, estado: "borrador" };
  }

  const resultado = parseAppMap(json);
  if (!resultado.ok) {
    return { ...vacio, estado: "borrador" };
  }

  const { map } = resultado;
  const localizadores = map.screens.reduce((total, screen) => total + screen.locators.length, 0);
  return {
    estado: map.screens.length > 0 ? "listo" : "borrador",
    pantallas: map.screens.length,
    localizadores,
    candidatosEscenario: map.scenarios.length,
  };
}

async function leerEstadoFicheros(dir: string, extension?: string): Promise<EstadoFicheros> {
  if (!(await existeDirectorio(dir))) {
    return { estado: "no existe", ficheros: 0 };
  }
  const ficheros = await contarFicheros(dir, extension);
  return { estado: ficheros > 0 ? "listo" : "borrador", ficheros };
}

/**
 * Pantallas y candidatos de escenario tal como los valida `parseAppMap`, para el árbol/detalle de
 * Explorar (Bloque 5) — `leerEstadoMapa` de arriba solo cuenta, no basta para pintar localizadores
 * ni transiciones de una pantalla seleccionada. Mismo parser del contrato, nunca JSON a mano.
 */
export async function leerMapaCompleto(rootDir: string): Promise<MapaCompleto> {
  const paths = projectPaths(rootDir);
  let contenido: string;
  try {
    contenido = await fs.readFile(paths.mapPath, "utf8");
  } catch {
    return { existe: false };
  }

  let json: unknown;
  try {
    json = JSON.parse(contenido);
  } catch {
    return { existe: false };
  }

  const resultado = parseAppMap(json);
  if (!resultado.ok) {
    return { existe: false };
  }
  return { existe: true, screens: resultado.map.screens, scenarios: resultado.map.scenarios };
}

/** Deriva el estado del proyecto activo del disco, en cada llamada: nada se cachea. */
export async function leerEstadoProyecto(rootDir: string): Promise<EstadoProyecto> {
  const paths = projectPaths(rootDir);
  const agenteQaInicializado = await existeDirectorio(paths.dir);

  const [mapa, features, e2e, reporte] = await Promise.all([
    leerEstadoMapa(paths.mapPath),
    leerEstadoFicheros(paths.featuresDir, ".feature"),
    leerEstadoFicheros(path.join(rootDir, "e2e"), ".ts"),
    leerEstadoFicheros(path.join(rootDir, "playwright-report")),
  ]);

  return {
    proyecto: rootDir,
    agenteQaInicializado,
    mapa,
    features,
    e2e,
    reporte: { estado: reporte.estado },
  };
}
