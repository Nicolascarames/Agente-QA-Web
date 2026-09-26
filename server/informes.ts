// Archiva cada ejecución de Playwright fuera de `test-results/` (que Playwright vacía al empezar la
// siguiente) y genera un informe HTML autocontenido — spec
// docs/superpowers/specs/2026-09-26-capturas-e-informe-visual.md. Se llama tras `POST
// /api/tests/ejecutar` (server/app.ts) y tras cada turno del agente (server/agente.ts), porque el
// agente también corre Playwright por su cuenta desde su propio Bash.
import { existsSync, promises as fs } from "node:fs";
import path from "node:path";
import type { ResumenInforme } from "../shared/tipos.js";
import { asegurarGitignore } from "./proyecto.js";

const ENTRADA_GITIGNORE_INFORMES = "agente-qa-informes/";

interface AdjuntoCrudo {
  name?: string;
  contentType?: string;
  path?: string;
  /** Adjunto de texto (p.ej. `agente-qa:validacion:<titulo>:esperado`, escrito por `validar()` en
   *  `skill/skills/qa/plantillas/agente-qa.ts` vía `body`, no `path`): el reporter JSON de
   *  Playwright lo serializa en base64. */
  body?: string;
}

interface PasoCrudo {
  title: string;
  duration?: number;
  error?: { message?: string };
  steps?: PasoCrudo[];
}

interface ResultadoCrudo {
  status?: string;
  attachments?: AdjuntoCrudo[];
  steps?: PasoCrudo[];
  error?: { message?: string };
  errors?: { message?: string }[];
}

interface TestCrudo {
  results?: ResultadoCrudo[];
}

interface SpecCrudo {
  title: string;
  file?: string;
  tests?: TestCrudo[];
}

interface SuiteCruda {
  file?: string;
  specs?: SpecCrudo[];
  suites?: SuiteCruda[];
}

export interface ReporteCrudo {
  stats?: { startTime?: string; duration?: number };
  suites?: SuiteCruda[];
}

/** Un `startTime` ausente o no parseable cae a la hora actual: con `NaN-NaN-…` la carpeta no pasaría
 *  `idInformeValido`, así que nunca se listaría ni se podaría. */
function fechaDeInforme(startTime: string | undefined): Date {
  const fecha = startTime ? new Date(startTime) : new Date();
  return Number.isNaN(fecha.getTime()) ? new Date() : fecha;
}

function idDeInforme(fecha: Date): string {
  const parte = (n: number) => String(n).padStart(2, "0");
  return `${fecha.getUTCFullYear()}-${parte(fecha.getUTCMonth() + 1)}-${parte(fecha.getUTCDate())}_${parte(fecha.getUTCHours())}-${parte(fecha.getUTCMinutes())}-${parte(fecha.getUTCSeconds())}`;
}

/** Ids ordenan cronológicamente por construcción (AAAA-MM-DD_HH-mm-ss): un `sort()` de cadenas
 *  basta. También sirve para validar el `id` de `GET /informes/<id>/*` antes de tocar el filesystem
 *  (server/app.ts) — un id que no cumpla este formato no puede contener `..` ni `/`. */
export function idInformeValido(id: string): boolean {
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{2}-[0-9]{2}-[0-9]{2}$/.test(id);
}

type EstadoInforme = "verde" | "rojo" | "omitido";

/** `passed` es verde y `skipped` es su propio estado (igual que `server/reporter.ts`); todo lo demás
 *  (`failed`, `timedOut`, `interrupted`) cuenta como rojo. */
function clasificarEstado(status: string | undefined): EstadoInforme {
  if (status === "passed") return "verde";
  if (status === "skipped") return "omitido";
  return "rojo";
}

interface Recuento {
  verdes: number;
  rojos: number;
  omitidos: number;
  specs: Set<string>;
  adjuntos: { name: string; path: string }[];
  /** Valor esperado de cada `validar()`, clave = título del paso (mismo texto que sigue a
   *  `agente-qa:validacion:` antes del sufijo `:esperado`). Estos adjuntos van por `body`
   *  (texto en base64), no por `path`, así que quedan fuera de `adjuntos` arriba. */
  esperados: Map<string, string>;
}

function recorrerSuite(suite: SuiteCruda, acc: Recuento): void {
  for (const spec of suite.specs ?? []) {
    acc.specs.add(spec.file ?? suite.file ?? "");
    for (const test of spec.tests ?? []) {
      const resultados = test.results ?? [];
      const ultimo = resultados[resultados.length - 1];
      if (!ultimo) continue;
      const estado = clasificarEstado(ultimo.status);
      if (estado === "verde") acc.verdes++;
      else if (estado === "omitido") acc.omitidos++;
      else acc.rojos++;
      for (const adjunto of ultimo.attachments ?? []) {
        if (!adjunto.name?.startsWith("agente-qa:")) continue;
        if (adjunto.name.startsWith("agente-qa:validacion:") && adjunto.name.endsWith(":esperado")) {
          if (adjunto.body) {
            const titulo = adjunto.name.slice("agente-qa:validacion:".length, -":esperado".length);
            acc.esperados.set(titulo, Buffer.from(adjunto.body, "base64").toString("utf8"));
          }
          continue;
        }
        if (adjunto.path) {
          acc.adjuntos.push({ name: adjunto.name, path: adjunto.path });
        }
      }
    }
  }
  for (const hija of suite.suites ?? []) recorrerSuite(hija, acc);
}

async function leerResultadosCrudos(rootDir: string): Promise<ReporteCrudo | null> {
  try {
    const bruto = await fs.readFile(path.join(rootDir, "test-results", "results.json"), "utf8");
    return JSON.parse(bruto) as ReporteCrudo;
  } catch {
    return null;
  }
}

async function podarInformes(rootDir: string, limite: number): Promise<void> {
  const base = path.join(rootDir, "agente-qa-informes");
  let entradas: string[];
  try {
    entradas = (await fs.readdir(base)).filter(idInformeValido).sort();
  } catch {
    return;
  }
  const sobran = entradas.length - limite;
  if (sobran <= 0) return;
  for (const id of entradas.slice(0, sobran)) {
    await fs.rm(path.join(base, id), { recursive: true, force: true });
  }
}

/** Nunca lanza: un informe no archivado es peor que perder un informe puntual, pero no tan malo como
 *  tumbar la ejecución de tests o el turno del agente que la dispara (mismo criterio que
 *  `server/reporter.ts`/`server/costes.ts`). Llamable las veces que haga falta para la MISMA
 *  ejecución: si `agente-qa-informes/<id>/` ya existe, no hace nada. */
export async function archivarUltimaEjecucion(rootDir: string, config: { historial: number | null }): Promise<void> {
  try {
    const reporte = await leerResultadosCrudos(rootDir);
    if (!reporte) return;

    const fecha = fechaDeInforme(reporte.stats?.startTime);
    const id = idDeInforme(fecha);
    const destino = path.join(rootDir, "agente-qa-informes", id);
    if (existsSync(destino)) return;

    const acc: Recuento = { verdes: 0, rojos: 0, omitidos: 0, specs: new Set(), adjuntos: [], esperados: new Map() };
    for (const suite of reporte.suites ?? []) recorrerSuite(suite, acc);

    await fs.mkdir(path.join(destino, "capturas"), { recursive: true });
    await fs.copyFile(path.join(rootDir, "test-results", "results.json"), path.join(destino, "results.json"));

    const capturasCopiadas: string[] = [];
    for (const adjunto of acc.adjuntos) {
      try {
        const nombreFichero = path.basename(adjunto.path);
        await fs.copyFile(adjunto.path, path.join(destino, "capturas", nombreFichero));
        capturasCopiadas.push(nombreFichero);
      } catch (error) {
        console.error(`agente-qa: no se pudo copiar la captura ${adjunto.path}`, error);
      }
    }

    const origenHtml = path.join(rootDir, "playwright-report");
    const conInformePlaywright = existsSync(origenHtml);
    if (conInformePlaywright) {
      await fs.cp(origenHtml, path.join(destino, "playwright"), { recursive: true });
    }

    const resumen: ResumenInforme = {
      id,
      fecha: fecha.toISOString(),
      duracionMs: reporte.stats?.duration ?? 0,
      verdes: acc.verdes,
      rojos: acc.rojos,
      omitidos: acc.omitidos,
      specs: [...acc.specs],
    };
    await fs.writeFile(path.join(destino, "resumen.json"), JSON.stringify(resumen, null, 2) + "\n", "utf8");
    await fs.writeFile(path.join(destino, "informe.html"), generarInformeHtml(reporte, capturasCopiadas, acc.esperados, conInformePlaywright), "utf8");

    await asegurarGitignore(rootDir, ENTRADA_GITIGNORE_INFORMES);

    if (typeof config.historial === "number") {
      await podarInformes(rootDir, config.historial);
    }
  } catch (error) {
    console.error("agente-qa: no se pudo archivar la ejecución", error);
  }
}

export async function listarInformes(rootDir: string): Promise<ResumenInforme[]> {
  const base = path.join(rootDir, "agente-qa-informes");
  let entradas: string[];
  try {
    entradas = (await fs.readdir(base)).filter(idInformeValido);
  } catch {
    return [];
  }
  const resumenes: ResumenInforme[] = [];
  for (const id of entradas) {
    try {
      const bruto = await fs.readFile(path.join(base, id, "resumen.json"), "utf8");
      const resumen = JSON.parse(bruto) as ResumenInforme;
      resumen.conInformePlaywright = existsSync(path.join(base, id, "playwright", "index.html"));
      resumenes.push(resumen);
    } catch {
      // resumen.json corrupto o ausente: se omite esa ejecución en vez de tumbar la lista entera.
    }
  }
  return resumenes.sort((a, b) => b.id.localeCompare(a.id));
}

// --- El informe HTML autocontenido ----------------------------------------------------------------

function escaparHtml(texto: string): string {
  const mapa: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return texto.replace(/[&<>"']/g, (c) => mapa[c] ?? c);
}

interface PasoAplanado {
  titulo: string;
  duracionMs: number;
}

// Misma aplanación que `aplanarPasos` de server/reporter.ts, pero conservando la duración.
function aplanarPasos(pasos: PasoCrudo[] | undefined): PasoAplanado[] {
  const resultado: PasoAplanado[] = [];
  for (const paso of pasos ?? []) {
    resultado.push({ titulo: paso.title, duracionMs: paso.duration ?? 0 });
    resultado.push(...aplanarPasos(paso.steps));
  }
  return resultado;
}

// Los mensajes de error de Playwright traen códigos de color ANSI; la regex se construye sin
// literal porque `no-control-regex` rechaza el carácter ESC escrito directamente.
const CODIGOS_ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

interface CapturasDePaso {
  imgValidacion?: string;
  imgPaso?: string;
  esperado?: string;
}

function htmlImagen(fichero: string, alt: string): string {
  return `<img class="miniatura" src="capturas/${escaparHtml(fichero)}" alt="${escaparHtml(alt)}" />`;
}

function htmlPaso(titulo: string, duracionMs: number | null, c: CapturasDePaso | undefined): string {
  const duracion = duracionMs === null ? "" : ` <span class="duracion">${duracionMs} ms</span>`;
  const esperado = c?.esperado ? ` — esperado: <code>${escaparHtml(c.esperado)}</code>` : "";
  // La captura recuadrada de la validación va antes que la de página completa del paso.
  const imagenes = `${c?.imgValidacion ? htmlImagen(c.imgValidacion, titulo) : ""}${c?.imgPaso ? htmlImagen(c.imgPaso, titulo) : ""}`;
  return `<li><p>${escaparHtml(titulo)}${duracion}${esperado}</p>${imagenes}</li>`;
}

/** Imita el informe HTML de Playwright (spec: "de momento imita el de Playwright, el diseño propio
 *  llega en otra tarea"). Pura: recibe el JSON crudo ya leído y los basenames de las capturas ya
 *  copiadas a `capturas/`, junto a este fichero. `esperados` (opcional) es el mapa titulo→texto
 *  construido por `archivarUltimaEjecucion` (ver `Recuento.esperados`) — solo hace falta como
 *  respaldo, porque `reporte` ya trae sus propios adjuntos `:esperado` con `body`, que esta función
 *  decodifica directamente por su cuenta (Pieza 4 de la spec: cada captura muestra el texto del
 *  paso Y el valor esperado). */
export function generarInformeHtml(
  reporte: ReporteCrudo,
  capturasCopiadas: string[],
  esperados: Map<string, string> = new Map(),
  conInformePlaywright = false,
): string {
  const copiadas = new Set(capturasCopiadas);
  let totalVerdes = 0;
  let totalRojos = 0;
  let totalOmitidos = 0;
  const porFichero = new Map<string, string[]>();

  function recorrerParaHtml(suite: SuiteCruda): void {
    for (const spec of suite.specs ?? []) {
      const fichero = spec.file ?? suite.file ?? "";
      for (const test of spec.tests ?? []) {
        const resultados = test.results ?? [];
        const ultimo = resultados[resultados.length - 1];
        if (!ultimo) continue;
        const estado = clasificarEstado(ultimo.status);
        if (estado === "verde") totalVerdes++;
        else if (estado === "omitido") totalOmitidos++;
        else totalRojos++;

        const adjuntos = (ultimo.attachments ?? []).filter((a) => a.name?.startsWith("agente-qa:") && a.path && copiadas.has(path.basename(a.path)));
        const fallo = adjuntos.find((a) => a.name === "agente-qa:fallo");
        // Playwright cuelga los adjuntos del resultado, no del paso: se cruzan con los pasos por título.
        const capturasPorPaso = new Map<string, CapturasDePaso>();
        for (const adjunto of adjuntos) {
          if (!adjunto.name || !adjunto.path) continue;
          const esValidacion = adjunto.name.startsWith("agente-qa:validacion:") && !adjunto.name.endsWith(":esperado");
          const esPaso = adjunto.name.startsWith("agente-qa:paso:");
          if (!esValidacion && !esPaso) continue;
          const titulo = esValidacion ? adjunto.name.slice("agente-qa:validacion:".length) : adjunto.name.slice("agente-qa:paso:".length);
          const entrada = capturasPorPaso.get(titulo) ?? {};
          // `validar()` (dentro del paso) y `paso()` (al terminarlo) comparten título: se guardan
          // las dos imágenes por separado para que la de página completa no pise la recuadrada.
          if (esValidacion) entrada.imgValidacion = path.basename(adjunto.path);
          else entrada.imgPaso = path.basename(adjunto.path);
          capturasPorPaso.set(titulo, entrada);
        }
        // Los `:esperado` van por `body` (texto en base64), no por `path`, así que quedan fuera del
        // filtro de `adjuntos` de arriba: se buscan aparte en los attachments crudos de este test.
        // Si el propio `reporte` no trae el `body` (p.ej. un `reporte` ya recortado por quien llama),
        // se cae al mapa `esperados` recibido como respaldo.
        for (const adjunto of ultimo.attachments ?? []) {
          if (!adjunto.name?.startsWith("agente-qa:validacion:") || !adjunto.name.endsWith(":esperado")) continue;
          const titulo = adjunto.name.slice("agente-qa:validacion:".length, -":esperado".length);
          const texto = adjunto.body ? Buffer.from(adjunto.body, "base64").toString("utf8") : esperados.get(titulo);
          if (texto === undefined) continue;
          const entrada = capturasPorPaso.get(titulo) ?? {};
          entrada.esperado = texto;
          capturasPorPaso.set(titulo, entrada);
        }

        // Cada paso consume su entrada al casar: dos pasos con el mismo título no repiten la imagen.
        const pendientes = new Map(capturasPorPaso);
        const pasosHtml = aplanarPasos(ultimo.steps).map((p) => {
          const c = pendientes.get(p.titulo);
          pendientes.delete(p.titulo);
          return htmlPaso(p.titulo, p.duracionMs, c);
        });
        // Capturas cuyo título no casa con ningún paso (p.ej. un `validar()` fuera de `paso()`): no se pierden.
        for (const [titulo, c] of pendientes) pasosHtml.push(htmlPaso(titulo, null, c));

        const mensajeError = ultimo.error?.message ?? ultimo.errors?.[0]?.message;
        const clase = estado === "verde" ? "ok" : estado === "omitido" ? "skip" : "fail";
        const icono = estado === "verde" ? "✅" : estado === "omitido" ? "⏭️" : "❌";
        const bloque = `
          <details class="test ${clase}">
            <summary>${icono} ${escaparHtml(spec.title)}</summary>
            ${estado === "rojo" && mensajeError ? `<pre class="error">${escaparHtml(mensajeError.replace(CODIGOS_ANSI, ""))}</pre>` : ""}
            ${fallo ? `<div class="fallo"><img src="capturas/${escaparHtml(path.basename(fallo.path ?? ""))}" alt="captura de fallo" /></div>` : ""}
            <ul class="pasos">
              ${pasosHtml.join("")}
            </ul>
          </details>`;
        const lista = porFichero.get(fichero) ?? [];
        lista.push(bloque);
        porFichero.set(fichero, lista);
      }
    }
    for (const hija of suite.suites ?? []) recorrerParaHtml(hija);
  }

  for (const suite of reporte.suites ?? []) recorrerParaHtml(suite);

  const duracionS = ((reporte.stats?.duration ?? 0) / 1000).toFixed(1);
  const secciones = [...porFichero.entries()]
    .map(([fichero, bloques]) => `<section><h2>${escaparHtml(fichero)}</h2>${bloques.join("")}</section>`)
    .join("\n");

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Informe agente-qa</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 0; padding: 1.5rem; background: #0d1117; color: #e6edf3; }
  header { display: flex; gap: 1.5rem; align-items: baseline; margin-bottom: 1rem; }
  header .verdes { color: #3fb950; } header .rojos { color: #f85149; } header .omitidos { color: #d29922; }
  details.test { border: 1px solid #30363d; border-radius: 6px; margin-bottom: 0.5rem; padding: 0.5rem 0.75rem; }
  details.test.fail { border-color: #f85149; }
  details.test.skip { border-color: #d29922; }
  pre.error { white-space: pre-wrap; color: #f85149; background: #161b22; padding: 0.5rem; border-radius: 4px; }
  span.duracion { color: #8b949e; font-size: 0.85em; }
  summary { cursor: pointer; font-weight: 600; }
  ul.pasos { list-style: none; padding-left: 0.5rem; }
  img.miniatura { max-width: 160px; border-radius: 4px; cursor: zoom-in; display: block; margin-top: 0.25rem; }
  .fallo img { max-width: 480px; border-radius: 4px; border: 1px solid #f85149; }
  a.enlace { color: #58a6ff; }
  dialog { border: none; border-radius: 8px; padding: 0; background: transparent; }
  dialog img { max-width: 90vw; max-height: 90vh; }
</style>
</head>
<body>
  <header>
    <h1>Informe agente-qa</h1>
    <span>${totalVerdes + totalRojos + totalOmitidos} tests</span>
    <span class="verdes">${totalVerdes} verdes</span>
    <span class="rojos">${totalRojos} rojos</span>
    <span class="omitidos">${totalOmitidos} omitidos</span>
    <span>${duracionS}s</span>
    ${conInformePlaywright ? '<a class="enlace" href="playwright/index.html" target="_blank" rel="noopener">Informe de Playwright</a>' : ""}
  </header>
  ${secciones}
  <dialog id="lightbox"><img id="lightbox-img" src="" alt="" /></dialog>
  <script>
    document.querySelectorAll("img.miniatura").forEach(function (img) {
      img.addEventListener("click", function () {
        document.getElementById("lightbox-img").src = img.src;
        document.getElementById("lightbox").showModal();
      });
    });
    document.getElementById("lightbox").addEventListener("click", function (e) { e.currentTarget.close(); });
  </script>
</body>
</html>`;
}
