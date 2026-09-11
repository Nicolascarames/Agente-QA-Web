import { promises as fs } from "node:fs";
import path from "node:path";
import { listarFicheros } from "./git.js";
import type { ElementoFragil } from "../shared/tipos.js";

// Convención de la skill (skill/skills/qa/referencias/localizadores.md): cuando ningún localizador
// fiable existe, se marca el que se usa con este comentario para que el equipo de desarrollo lo
// revise — Bloque 8 cuenta esas marcas reales, no inventa otra señal.
const FRAGIL_RE = /\/\/\s*FRÁGIL:\s*(.+)$/i;

const CARPETAS = ["pages", "specs"] as const;

/** Recorre `tests/pages/*.ts` y `tests/specs/*.ts` en busca de comentarios `// FRÁGIL: <motivo>`.
 *  `[]` si no hay ninguno o las carpetas no existen todavía — nunca lanza. */
export async function listarFragiles(rootDir: string): Promise<ElementoFragil[]> {
  const fragiles: ElementoFragil[] = [];

  for (const carpeta of CARPETAS) {
    const dir = path.join(rootDir, "tests", carpeta);
    const ficheros = await listarFicheros(dir, ".ts");
    for (const nombre of ficheros) {
      let contenido: string;
      try {
        contenido = await fs.readFile(path.join(dir, nombre), "utf8");
      } catch {
        continue;
      }
      contenido.split(/\r?\n/).forEach((linea, indice) => {
        const match = linea.match(FRAGIL_RE);
        if (match) {
          fragiles.push({ fichero: `tests/${carpeta}/${nombre}`, linea: indice + 1, motivo: match[1].trim() });
        }
      });
    }
  }

  return fragiles;
}
