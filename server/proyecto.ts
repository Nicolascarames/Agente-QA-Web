import { promises as fs } from "node:fs";
import path from "node:path";

const MAX_RECIENTES = 10;

interface FicheroRecientes {
  proyectos: string[];
}

function rutaFicheroRecientes(): string {
  const appData = process.env.APPDATA;
  if (!appData) {
    throw new Error("APPDATA no está definido: no se puede persistir la lista de proyectos recientes");
  }
  return path.join(appData, "agente-qa-web", "recientes.json");
}

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

export async function leerRecientes(): Promise<string[]> {
  try {
    const contenido = await fs.readFile(rutaFicheroRecientes(), "utf8");
    const datos = JSON.parse(contenido) as FicheroRecientes;
    return Array.isArray(datos.proyectos) ? datos.proyectos : [];
  } catch {
    return [];
  }
}

/** Mete `ruta` en primera posición de los recientes (sin duplicados), persiste y devuelve la lista. */
export async function anadirReciente(ruta: string): Promise<string[]> {
  const actuales = await leerRecientes();
  const nuevos = [ruta, ...actuales.filter((p) => p !== ruta)].slice(0, MAX_RECIENTES);
  const destino = rutaFicheroRecientes();
  await fs.mkdir(path.dirname(destino), { recursive: true });
  await fs.writeFile(destino, `${JSON.stringify({ proyectos: nuevos }, null, 2)}\n`, "utf8");
  return nuevos;
}
