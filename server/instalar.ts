// El comando `instalar` del Bloque 9: genera, desde `skill/skills/qa/SKILL.md`, los envoltorios
// para trabajar con la misma skill fuera de la consola web (Claude Code en terminal, Codex,
// Copilot). Módulo con lógica pura e inyectable + wrapper fino en bin/ — mismo patrón que doctor.ts.
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dirActual = path.dirname(fileURLToPath(import.meta.url));
// Igual que en agente.ts: en producción este fichero compila a dist-server/server/instalar.js, dos
// niveles por debajo de la raíz del paquete (skill/ es hermana de dist-server/ ahí). Bajo vitest,
// en cambio, se importa el .ts fuente directamente desde server/, un solo nivel por debajo de la
// raíz — de ahí el fallback: se prueba primero la ruta de producción y, si no existe, la de fuente.
async function resolverRutaSkillQa(): Promise<string> {
  const candidatas = [path.resolve(dirActual, "..", "..", "skill"), path.resolve(dirActual, "..", "skill")];
  for (const candidata of candidatas) {
    const rutaQa = path.join(candidata, "skills", "qa");
    try {
      await fs.access(rutaQa);
      return rutaQa;
    } catch {
      // Sigue con la siguiente candidata.
    }
  }
  return path.join(candidatas[0], "skills", "qa");
}

const MARCADOR = "Generado por `agente-qa instalar`. No editar a mano: los cambios se pierden en la siguiente instalación.";

type Destino = "claude" | "codex" | "copilot";
const DESTINOS: Destino[] = ["claude", "codex", "copilot"];

export interface OpcionesInstalar {
  solo?: Destino;
  confirmar?: (mensaje: string) => Promise<boolean>;
}

export interface ResultadoInstalar {
  escritos: string[];
  omitidos: string[];
}

function separarFrontmatter(contenido: string): { frontmatter: string; cuerpo: string } {
  const lineas = contenido.split("\n");
  if (lineas[0] !== "---") {
    return { frontmatter: "", cuerpo: contenido };
  }
  const finIndice = lineas.indexOf("---", 1);
  if (finIndice === -1) {
    return { frontmatter: "", cuerpo: contenido };
  }
  const frontmatter = lineas.slice(0, finIndice + 1).join("\n");
  const cuerpo = lineas
    .slice(finIndice + 1)
    .join("\n")
    .replace(/^\n+/, "");
  return { frontmatter, cuerpo };
}

async function leerSiExiste(ruta: string): Promise<string | undefined> {
  try {
    return await fs.readFile(ruta, "utf8");
  } catch {
    return undefined;
  }
}

/**
 * Escribe `contenido` en `ruta` respetando la propiedad del fichero: si ya existe y no lleva el
 * marcador, es de un tercero y hace falta confirmación explícita antes de sobrescribirlo.
 */
async function escribirConPermiso(
  ruta: string,
  rutaRelativa: string,
  contenido: string,
  opciones: Pick<OpcionesInstalar, "confirmar">,
  resultado: ResultadoInstalar,
): Promise<boolean> {
  try {
    const existente = await leerSiExiste(ruta);
    if (existente !== undefined && !existente.includes(MARCADOR)) {
      const confirmado = opciones.confirmar ? await opciones.confirmar(`${rutaRelativa} ya existe y no lo generó agente-qa instalar. ¿Sobrescribir?`) : false;
      if (!confirmado) {
        resultado.omitidos.push(rutaRelativa);
        return false;
      }
    }
    await fs.mkdir(path.dirname(ruta), { recursive: true });
    await fs.writeFile(ruta, contenido, "utf8");
    resultado.escritos.push(rutaRelativa);
    return true;
  } catch {
    resultado.omitidos.push(rutaRelativa);
    return false;
  }
}

export async function instalar(rootDir: string, opciones: OpcionesInstalar = {}): Promise<ResultadoInstalar> {
  const resultado: ResultadoInstalar = { escritos: [], omitidos: [] };
  const destinos = opciones.solo ? [opciones.solo] : DESTINOS;

  const rutaSkillQa = await resolverRutaSkillQa();
  const skillMd = await fs.readFile(path.join(rutaSkillQa, "SKILL.md"), "utf8");
  const localizadores = await fs.readFile(path.join(rutaSkillQa, "referencias", "localizadores.md"), "utf8");
  const plantillas = await fs.readFile(path.join(rutaSkillQa, "referencias", "plantillas.md"), "utf8");
  const { frontmatter, cuerpo } = separarFrontmatter(skillMd);
  const comentarioMarcador = `<!-- ${MARCADOR} -->`;

  if (destinos.includes("claude")) {
    const rutaSkillMdRelativa = path.join(".claude", "skills", "qa", "SKILL.md");
    const contenidoSkillMd = `${frontmatter}\n${comentarioMarcador}\n\n${cuerpo}`;
    const escrito = await escribirConPermiso(path.join(rootDir, rutaSkillMdRelativa), rutaSkillMdRelativa, contenidoSkillMd, opciones, resultado);

    if (escrito) {
      const rutaLocalizadoresRelativa = path.join(".claude", "skills", "qa", "referencias", "localizadores.md");
      const rutaPlantillasRelativa = path.join(".claude", "skills", "qa", "referencias", "plantillas.md");
      await fs.mkdir(path.dirname(path.join(rootDir, rutaLocalizadoresRelativa)), { recursive: true });
      await fs.writeFile(path.join(rootDir, rutaLocalizadoresRelativa), localizadores, "utf8");
      await fs.writeFile(path.join(rootDir, rutaPlantillasRelativa), plantillas, "utf8");
      resultado.escritos.push(rutaLocalizadoresRelativa, rutaPlantillasRelativa);
    }
  }

  const contenidoEnvoltorio = [comentarioMarcador, cuerpo, localizadores, plantillas].join("\n\n---\n\n");

  if (destinos.includes("codex")) {
    const rutaRelativa = "AGENTS.md";
    await escribirConPermiso(path.join(rootDir, rutaRelativa), rutaRelativa, contenidoEnvoltorio, opciones, resultado);
  }

  if (destinos.includes("copilot")) {
    const rutaRelativa = path.join(".github", "copilot-instructions.md");
    await escribirConPermiso(path.join(rootDir, rutaRelativa), rutaRelativa, contenidoEnvoltorio, opciones, resultado);
  }

  return resultado;
}
