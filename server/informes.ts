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
}

interface ResultadoCrudo {
  status?: string;
  attachments?: AdjuntoCrudo[];
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

function idDeInforme(startTime: string | undefined): string {
  const fecha = startTime ? new Date(startTime) : new Date();
  const parte = (n: number) => String(n).padStart(2, "0");
  return `${fecha.getUTCFullYear()}-${parte(fecha.getUTCMonth() + 1)}-${parte(fecha.getUTCDate())}_${parte(fecha.getUTCHours())}-${parte(fecha.getUTCMinutes())}-${parte(fecha.getUTCSeconds())}`;
}

/** Ids ordenan cronológicamente por construcción (AAAA-MM-DD_HH-mm-ss): un `sort()` de cadenas
 *  basta. También sirve para validar el `id` de `GET /informes/<id>/*` antes de tocar el filesystem
 *  (server/app.ts) — un id que no cumpla este formato no puede contener `..` ni `/`. */
export function idInformeValido(id: string): boolean {
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{2}-[0-9]{2}-[0-9]{2}$/.test(id);
}

interface Recuento {
  verdes: number;
  rojos: number;
  specs: Set<string>;
  adjuntos: { name: string; path: string }[];
}

function recorrerSuite(suite: SuiteCruda, acc: Recuento): void {
  for (const spec of suite.specs ?? []) {
    acc.specs.add(spec.file ?? suite.file ?? "");
    for (const test of spec.tests ?? []) {
      const resultados = test.results ?? [];
      const ultimo = resultados[resultados.length - 1];
      if (!ultimo) continue;
      if (ultimo.status === "passed") acc.verdes++;
      else acc.rojos++;
      for (const adjunto of ultimo.attachments ?? []) {
        if (adjunto.name?.startsWith("agente-qa:") && adjunto.path) {
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

    const id = idDeInforme(reporte.stats?.startTime);
    const destino = path.join(rootDir, "agente-qa-informes", id);
    if (existsSync(destino)) return;

    const acc: Recuento = { verdes: 0, rojos: 0, specs: new Set(), adjuntos: [] };
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
    if (existsSync(origenHtml)) {
      await fs.cp(origenHtml, path.join(destino, "playwright"), { recursive: true });
    }

    const resumen: ResumenInforme = {
      id,
      fecha: reporte.stats?.startTime ?? new Date().toISOString(),
      duracionMs: reporte.stats?.duration ?? 0,
      verdes: acc.verdes,
      rojos: acc.rojos,
      specs: [...acc.specs],
    };
    await fs.writeFile(path.join(destino, "resumen.json"), JSON.stringify(resumen, null, 2) + "\n", "utf8");
    await fs.writeFile(path.join(destino, "informe.html"), generarInformeHtml(reporte, capturasCopiadas), "utf8");

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
      resumenes.push(JSON.parse(bruto) as ResumenInforme);
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

/** Imita el informe HTML de Playwright (spec: "de momento imita el de Playwright, el diseño propio
 *  llega en otra tarea"). Pura: recibe el JSON crudo ya leído y los basenames de las capturas ya
 *  copiadas a `capturas/`, junto a este fichero. */
export function generarInformeHtml(reporte: ReporteCrudo, capturasCopiadas: string[]): string {
  const copiadas = new Set(capturasCopiadas);
  let totalVerdes = 0;
  let totalRojos = 0;
  const porFichero = new Map<string, string[]>();

  function recorrerParaHtml(suite: SuiteCruda): void {
    for (const spec of suite.specs ?? []) {
      const fichero = spec.file ?? suite.file ?? "";
      for (const test of spec.tests ?? []) {
        const resultados = test.results ?? [];
        const ultimo = resultados[resultados.length - 1];
        if (!ultimo) continue;
        const ok = ultimo.status === "passed";
        ok ? totalVerdes++ : totalRojos++;

        const adjuntos = (ultimo.attachments ?? []).filter((a) => a.name?.startsWith("agente-qa:") && a.path && copiadas.has(path.basename(a.path)));
        const fallo = adjuntos.find((a) => a.name === "agente-qa:fallo");
        const capturasPorPaso = new Map<string, string>();
        for (const adjunto of adjuntos) {
          if (!adjunto.name || !adjunto.path) continue;
          const esValidacion = adjunto.name.startsWith("agente-qa:validacion:") && !adjunto.name.endsWith(":esperado");
          const esPaso = adjunto.name.startsWith("agente-qa:paso:");
          if (!esValidacion && !esPaso) continue;
          const titulo = esValidacion ? adjunto.name.slice("agente-qa:validacion:".length) : adjunto.name.slice("agente-qa:paso:".length);
          capturasPorPaso.set(titulo, path.basename(adjunto.path));
        }

        const bloque = `
          <details class="test ${ok ? "ok" : "fail"}">
            <summary>${ok ? "✅" : "❌"} ${escaparHtml(spec.title)}</summary>
            ${fallo ? `<div class="fallo"><img src="capturas/${escaparHtml(path.basename(fallo.path ?? ""))}" alt="captura de fallo" /></div>` : ""}
            <ul class="pasos">
              ${[...capturasPorPaso.entries()]
                .map(([titulo, archivo]) => `<li><p>${escaparHtml(titulo)}</p><img class="miniatura" src="capturas/${escaparHtml(archivo)}" alt="${escaparHtml(titulo)}" /></li>`)
                .join("")}
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
  header .verdes { color: #3fb950; } header .rojos { color: #f85149; }
  details.test { border: 1px solid #30363d; border-radius: 6px; margin-bottom: 0.5rem; padding: 0.5rem 0.75rem; }
  details.test.fail { border-color: #f85149; }
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
    <span class="verdes">${totalVerdes} verdes</span>
    <span class="rojos">${totalRojos} rojos</span>
    <span>${duracionS}s</span>
    <a class="enlace" href="playwright/index.html" target="_blank" rel="noopener">Informe de Playwright</a>
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
