import { promises as fs } from "node:fs";
import path from "node:path";
import { listarFicheros } from "./git.js";
import { leerReporte } from "./reporter.js";
import type { CoberturaEscenario } from "../shared/tipos.js";

// --- Parseo del .feature: por texto, sin librería Gherkin (mismo criterio que server/git.ts para
// el spec: regex, no AST) --------------------------------------------------------------------------

const ESCENARIO_RE = /^\s*Escenario:\s*(.+)$/;
const PASO_RE = /^\s*(Dado|Cuando|Entonces|Y|Pero|\*)\b/i;

interface EscenarioParseado {
  escenario: string;
  pasos: string[];
}

function parsearEscenarios(contenido: string): EscenarioParseado[] {
  const escenarios: EscenarioParseado[] = [];
  let actual: EscenarioParseado | null = null;
  for (const lineaCruda of contenido.split(/\r?\n/)) {
    const matchEscenario = lineaCruda.match(ESCENARIO_RE);
    if (matchEscenario) {
      actual = { escenario: matchEscenario[1].trim(), pasos: [] };
      escenarios.push(actual);
      continue;
    }
    const linea = lineaCruda.trim();
    if (!linea || linea.startsWith("#")) continue;
    if (actual && PASO_RE.test(lineaCruda)) {
      actual.pasos.push(linea);
    }
  }
  return escenarios;
}

// --- Parseo del .spec.ts: por texto también, no AST. Segmenta en bloques por cada `test(` real
// (excluye `test.step(`/`test.describe(`, que nunca aparecen como substring "test(") -------------

const TEST_INICIO_RE = /(?<!\.)\btest\(/g;
const PASO_SPEC_RE = /test\.step\(\s*(['"`])(.*?)\1/g;

function bloquesDeTests(contenido: string): string[] {
  const indices: number[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(TEST_INICIO_RE);
  while ((match = regex.exec(contenido))) indices.push(match.index);
  return indices.map((inicio, i) => contenido.slice(inicio, i + 1 < indices.length ? indices[i + 1] : contenido.length));
}

function pasosDelBloque(bloque: string): string[] {
  const pasos: string[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(PASO_SPEC_RE);
  while ((match = regex.exec(bloque))) pasos.push(match[2]);
  return pasos;
}

function igualesEnOrden(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((valor, indice) => valor === b[indice]);
}

/**
 * Cruza cada escenario de cada `.feature` (`tests/features/*.feature`) contra los `test.step` de su
 * `.spec.ts` homónimo (`tests/specs/*.spec.ts`): "cubierto" si los pasos calzan palabra por palabra
 * y en orden con algún `test(...)` del spec, "desincronizado" si el spec existe pero ningún bloque
 * calza, "no-cubierto" si el spec ni siquiera existe. Para los "cubierto", añade el último
 * `resultado` conocido de `leerReporte`, si lo hay. Nunca lanza: un `.feature` ilegible o vacío
 * cuenta como "sin escenarios" en ese fichero, no aborta el resto.
 */
export async function cruzarTrazabilidad(rootDir: string): Promise<CoberturaEscenario[]> {
  const featuresDir = path.join(rootDir, "tests", "features");
  const specsDir = path.join(rootDir, "tests", "specs");
  const featureFicheros = await listarFicheros(featuresDir, ".feature");
  const resultadosReporte = await leerReporte(rootDir);

  const cobertura: CoberturaEscenario[] = [];

  for (const featureFichero of featureFicheros) {
    let contenidoFeature: string;
    try {
      contenidoFeature = await fs.readFile(path.join(featuresDir, featureFichero), "utf8");
    } catch {
      continue;
    }
    const escenarios = parsearEscenarios(contenidoFeature);
    const specFicheroEsperado = featureFichero.replace(/\.feature$/, ".spec.ts");

    let contenidoSpec: string | null;
    try {
      contenidoSpec = await fs.readFile(path.join(specsDir, specFicheroEsperado), "utf8");
    } catch {
      contenidoSpec = null;
    }

    if (contenidoSpec === null) {
      for (const escenario of escenarios) {
        cobertura.push({ featureFichero, escenario: escenario.escenario, estado: "no-cubierto" });
      }
      continue;
    }

    const bloquesDePasos = bloquesDeTests(contenidoSpec).map(pasosDelBloque);

    for (const escenario of escenarios) {
      const calza = bloquesDePasos.some((pasos) => igualesEnOrden(pasos, escenario.pasos));
      if (!calza) {
        cobertura.push({ featureFichero, escenario: escenario.escenario, estado: "desincronizado", specFichero: specFicheroEsperado });
        continue;
      }
      const resultado = resultadosReporte.find(
        (r) => r.ficheroSpec.endsWith(specFicheroEsperado) && igualesEnOrden(r.pasos.map((p) => p.titulo), escenario.pasos),
      );
      cobertura.push({
        featureFichero,
        escenario: escenario.escenario,
        estado: "cubierto",
        specFichero: specFicheroEsperado,
        resultado: resultado?.estado,
      });
    }
  }

  return cobertura;
}
