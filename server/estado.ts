import { promises as fs } from "node:fs";
import type { Dirent } from "node:fs";
import path from "node:path";
import type { EstadoBloque, EstadoFicheros, EstadoProyecto } from "../shared/tipos.js";
import { projectPaths } from "./proyecto.js";

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

async function leerEstadoFicheros(dir: string, extension?: string): Promise<EstadoFicheros> {
  if (!(await existeDirectorio(dir))) {
    return { estado: "no existe", ficheros: 0 };
  }
  const ficheros = await contarFicheros(dir, extension);
  return { estado: ficheros > 0 ? "listo" : "borrador", ficheros };
}

/** Deriva el estado del proyecto activo del disco, en cada llamada: nada se cachea. */
export async function leerEstadoProyecto(rootDir: string): Promise<EstadoProyecto> {
  const paths = projectPaths(rootDir);
  const agenteQaInicializado = await existeDirectorio(paths.dir);

  const [features, e2e, reporte] = await Promise.all([
    leerEstadoFicheros(paths.featuresDir, ".feature"),
    leerEstadoFicheros(path.join(rootDir, "e2e"), ".ts"),
    leerEstadoFicheros(path.join(rootDir, "playwright-report")),
  ]);

  const reporteEstado: EstadoBloque = reporte.estado;
  return {
    proyecto: rootDir,
    agenteQaInicializado,
    features,
    e2e,
    reporte: { estado: reporteEstado },
  };
}
