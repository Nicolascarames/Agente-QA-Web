import { promises as fs } from "node:fs";
import path from "node:path";
import type { FilaTest, ResultadoTest, Sugerencia } from "../shared/tipos.js";

// `ResultadoTest`/`Sugerencia`/`FilaTest` viven en shared/tipos.ts (no aquí): src/api.ts los
// necesita para tipar la respuesta de las rutas nuevas y la frontera
// tsconfig.app.json/tsconfig.server.json le impide importar de server/. Se re-exportan para que
// este módulo siga teniendo la forma pública descrita en la spec.
export type { FilaTest, ResultadoTest, Sugerencia } from "../shared/tipos.js";

// --- Forma del JSON que emite el reporter `json` de Playwright (solo el subconjunto que leemos) -

interface ReporteJson {
  suites?: SuiteJson[];
}

interface SuiteJson {
  file?: string;
  specs?: SpecJson[];
  suites?: SuiteJson[];
}

interface SpecJson {
  title: string;
  file?: string;
  tests?: TestJson[];
}

interface TestJson {
  results?: ResultJson[];
}

interface ResultJson {
  status?: string;
  duration?: number;
  error?: { message?: string };
  errors?: { message?: string }[];
  steps?: StepJson[];
}

interface StepJson {
  title: string;
  error?: { message?: string };
  steps?: StepJson[];
}

const ESTADOS_VALIDOS = new Set<ResultadoTest["estado"]>(["passed", "failed", "skipped", "timedOut"]);

function normalizarEstado(status: string | undefined): ResultadoTest["estado"] {
  // Playwright también puede emitir "interrupted" (ejecución cortada a mano): no forma parte de la
  // unión cerrada de esta web, así que se trata como fallo — es la lectura más segura para un badge.
  if (status && ESTADOS_VALIDOS.has(status as ResultadoTest["estado"])) return status as ResultadoTest["estado"];
  return "failed";
}

// Playwright no marca los pasos como "skipped" en el JSON: solo aparecen los que se ejecutaron, y
// se distinguen por la presencia de `error`. `pasos[].estado` admite "skipped" en el tipo por
// compatibilidad con `ResultadoTest`, pero esta lectura nunca la produce.
function aplanarPasos(steps: StepJson[] | undefined): ResultadoTest["pasos"] {
  const pasos: ResultadoTest["pasos"] = [];
  for (const paso of steps ?? []) {
    pasos.push({ titulo: paso.title, estado: paso.error ? "failed" : "passed" });
    pasos.push(...aplanarPasos(paso.steps));
  }
  return pasos;
}

function recorrerSuite(suite: SuiteJson, resultados: ResultadoTest[]): void {
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      const results = test.results ?? [];
      const ultimo = results[results.length - 1];
      if (!ultimo) continue;
      resultados.push({
        nombre: spec.title,
        ficheroSpec: spec.file ?? suite.file ?? "",
        estado: normalizarEstado(ultimo.status),
        duracionMs: ultimo.duration ?? 0,
        reintentos: results.length - 1,
        mensajeError: ultimo.error?.message ?? ultimo.errors?.[0]?.message,
        pasos: aplanarPasos(ultimo.steps),
      });
    }
  }
  for (const hija of suite.suites ?? []) {
    recorrerSuite(hija, resultados);
  }
}

// La skill (skill/skills/qa/SKILL.md, sección 4) obliga a ejecutar los tests con
// `PLAYWRIGHT_JSON_OUTPUT_NAME=test-results/results.json npx playwright test --reporter=list,json`
// — por variable de entorno, sin tocar el `playwright.config.ts` del repo destino, que es ajeno.
// Verificado de punta a punta contra `pruebas/sauce/`: sin esos flags, Playwright no escribe
// ningún JSON (el `reporter: 'html'` de ese repo no lo genera) y esta función siempre devolvía `[]`.
function rutaUltimaCorrida(rootDir: string): string {
  return path.join(rootDir, "test-results", "results.json");
}

// Playwright vacía `test-results/` al empezar cada corrida y el reporter `json` reescribe
// `results.json` entero: una corrida sin `--reporter=json` lo borra, y una corrida de un solo spec
// lo deja con solo ese spec. `agente-qa.resultados.json`, en la raíz del proyecto (no en
// `test-results/`, que Playwright controla), acumula entre corridas lo que `results.json` por sí
// solo no conserva.
function rutaAcumulado(rootDir: string): string {
  return path.join(rootDir, "agente-qa.resultados.json");
}

async function leerJsonCrudo(ruta: string): Promise<ReporteJson | null> {
  let bruto: string;
  try {
    bruto = await fs.readFile(ruta, "utf8");
  } catch {
    return null;
  }
  try {
    return JSON.parse(bruto) as ReporteJson;
  } catch {
    return null;
  }
}

function aplanarReporte(reporte: ReporteJson): ResultadoTest[] {
  const resultados: ResultadoTest[] = [];
  for (const suite of reporte.suites ?? []) {
    recorrerSuite(suite, resultados);
  }
  return resultados;
}

/**
 * Lector fiel del JSON de Playwright de la ÚLTIMA corrida únicamente (regla 2 de la spec: el
 * código nunca juzga lo que produce el agente, quien juzga es Playwright ejecutando el test). Este
 * módulo solo aplana esa estructura a `ResultadoTest[]`, nunca reinterpreta un resultado. `[]` si
 * el reporte no existe todavía — nunca lanza, ni con el fichero ausente ni con un JSON corrupto a
 * medio escribir. Para la vista persistente entre corridas, ver `leerReporte`.
 */
export async function leerReporteUltimaCorrida(rootDir: string): Promise<ResultadoTest[]> {
  const reporte = await leerJsonCrudo(rutaUltimaCorrida(rootDir));
  return reporte ? aplanarReporte(reporte) : [];
}

/**
 * Fusiona el JSON crudo de la última corrida (`test-results/results.json`) dentro del acumulado
 * persistente (`agente-qa.resultados.json`), por suite de primer nivel usando `suite.file` como
 * clave: las suites nuevas reemplazan a las del acumulado con el mismo fichero, el resto del
 * acumulado se conserva. Sin `results.json` (corrida sin `--reporter=json`, o ninguna corrida
 * todavía) no toca el acumulado. Nunca lanza — misma filosofía que `leerReporte`.
 */
export async function acumularReporte(rootDir: string): Promise<void> {
  try {
    const nuevo = await leerJsonCrudo(rutaUltimaCorrida(rootDir));
    if (!nuevo) return;
    const previo = await leerJsonCrudo(rutaAcumulado(rootDir));
    const suitesNuevas = nuevo.suites ?? [];
    const ficherosNuevos = new Set(suitesNuevas.map((suite) => suite.file));
    const suitesConservadas = (previo?.suites ?? []).filter((suite) => !ficherosNuevos.has(suite.file));
    const fusionado: ReporteJson = { suites: [...suitesConservadas, ...suitesNuevas] };
    await fs.writeFile(rutaAcumulado(rootDir), JSON.stringify(fusionado), "utf8");
  } catch {
    // Un acumulado no actualizado es peor que perder una fusión, pero no tan malo como tumbar la
    // ejecución que lo dispara (agente.ts / app.ts) — mismo criterio que el resto del módulo.
  }
}

/**
 * Vista persistente de los resultados: lee el acumulado (`agente-qa.resultados.json`) y, si
 * todavía no existe — proyecto que nunca llamó a `acumularReporte`, o repo existente de antes de
 * que el acumulado existiera —, cae a `test-results/results.json` de la última corrida, igual que
 * el comportamiento anterior de esta función.
 */
export async function leerReporte(rootDir: string): Promise<ResultadoTest[]> {
  const acumulado = await leerJsonCrudo(rutaAcumulado(rootDir));
  if (acumulado) return aplanarReporte(acumulado);
  return leerReporteUltimaCorrida(rootDir);
}

/**
 * Añade a la lista de Ejecutar los `.spec.ts` que existen en `tests/specs/` pero nunca se
 * ejecutaron (fila "noEjecutado", sin datos de Playwright) y quita del reporte los que ya no
 * existen en disco (spec borrado tras la última corrida). `basenamesEnDisco` es el listado crudo
 * de `tests/specs/*.spec.ts` (p. ej. de `git.listarFicheros`), sin la carpeta por delante.
 */
export function combinarConSpecsEnDisco(resultados: ResultadoTest[], basenamesEnDisco: string[]): FilaTest[] {
  const enDisco = new Set(basenamesEnDisco);
  const vivos = resultados.filter((resultado) => enDisco.has(path.basename(resultado.ficheroSpec)));
  const conReporte = new Set(vivos.map((resultado) => path.basename(resultado.ficheroSpec)));
  const noEjecutados: FilaTest[] = basenamesEnDisco
    .filter((basename) => !conReporte.has(basename))
    .map((basename) => ({
      nombre: basename.replace(/\.spec\.ts$/, ""),
      ficheroSpec: `specs/${basename}`,
      estado: "noEjecutado",
      duracionMs: 0,
      reintentos: 0,
      pasos: [],
    }));
  return [...vivos, ...noEjecutados];
}

// --- Sugerencia de veredicto (Bloque 7) ----------------------------------------------------------
//
// Heurística simple sobre el texto de `mensajeError`. Es SOLO una etiqueta sugerida para el badge
// visual de la lista en Reparar — nunca bloquea ni habilita nada por sí sola. La clasificación real
// (fallo del test vs. fallo de la aplicación) la hace el agente, visible en el chat: es quien mira
// el sitio y decide, no esta función.

const PATRONES_LOCALIZADOR_ROTO = [/waiting for locator/i, /strict mode violation/i, /element is not visible/i];
const PATRONES_ESPERA_VISIBILIDAD = [/toBeVisible/, /toBeAttached/];
const PATRONES_ASERCION_DE_VALOR = [/toHaveText/, /toEqual/, /expect\(received\)/];

export function sugerirVeredicto(resultado: ResultadoTest): Sugerencia {
  if (resultado.estado !== "failed" || !resultado.mensajeError) return "desconocido";
  const mensaje = resultado.mensajeError;

  if (PATRONES_LOCALIZADOR_ROTO.some((patron) => patron.test(mensaje))) return "fallo-test";
  if (/Timeout/.test(mensaje) && PATRONES_ESPERA_VISIBILIDAD.some((patron) => patron.test(mensaje))) return "fallo-test";

  // Una aserción sobre un valor real solo cuenta como fallo de la aplicación si no es, en el fondo,
  // un timeout esperando a que algo aparezca — eso ya lo cubre la rama de arriba.
  const esperandoAlgo = /waiting for/i.test(mensaje) || /Timeout/.test(mensaje);
  if (!esperandoAlgo && PATRONES_ASERCION_DE_VALOR.some((patron) => patron.test(mensaje))) return "fallo-aplicacion";

  return "desconocido";
}
