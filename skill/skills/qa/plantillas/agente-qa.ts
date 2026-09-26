// Fichero de apoyo que la skill copia (Read + Write, sin dependencia npm nueva) a
// `tests/soporte/agente-qa.ts` del repo destino si todavía no existe — ver `SKILL.md` y la spec
// docs/superpowers/specs/2026-09-26-capturas-e-informe-visual.md del repo agente-qa-web. Amplía
// `test` de Playwright con un fixture automático de captura de fallos, y añade `paso`/`validar`
// para que cada paso Gherkin y cada aserción de un `Entonces` dejen una captura recuadrada.
import { test as base, expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

type CategoriaCaptura = "validaciones" | "fallos" | "pasos";

const CATEGORIAS_VALIDAS: readonly CategoriaCaptura[] = ["validaciones", "fallos", "pasos"];

export function categoriasCapturaActivas(): CategoriaCaptura[] {
  const valor = process.env.AGENTE_QA_CAPTURAS;
  if (valor === undefined) return ["validaciones"];
  if (valor.trim() === "") return [];
  return valor
    .split(",")
    .map((v) => v.trim())
    .filter((v): v is CategoriaCaptura => (CATEGORIAS_VALIDAS as readonly string[]).includes(v));
}

// `paso`/`validar` solo reciben (titulo, fn) / (locator, esperado) — sin un `page` explícito no hay
// forma de llegar a la página desde fuera del cuerpo del test. Se guarda aquí, actualizada por el
// fixture `page` de abajo: un valor por worker de Playwright (proceso propio), un test a la vez por
// worker, así que no hay condición de carrera entre tests distintos.
let paginaActual: Page | null = null;
let pasoActual: string | null = null;

export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    paginaActual = page;
    await use(page);
    if (categoriasCapturaActivas().includes("fallos") && testInfo.status !== testInfo.expectedStatus) {
      const captura = await page.screenshot({ fullPage: true });
      await testInfo.attach("agente-qa:fallo", { body: captura, contentType: "image/png" });
    }
    paginaActual = null;
  },
});

export { expect };

/** Envuelve `test.step` con el mismo título (la trazabilidad de `server/trazabilidad.ts` cruza por
 *  título exacto, así que esto no la cambia). Con "pasos" activo, adjunta una captura de página
 *  completa al terminar CADA paso — no solo los `Entonces`, a diferencia de `validar`. */
export async function paso<T>(titulo: string, fn: () => Promise<T>): Promise<T> {
  return test.step(titulo, async () => {
    const anterior = pasoActual;
    pasoActual = titulo;
    try {
      const resultado = await fn();
      if (categoriasCapturaActivas().includes("pasos") && paginaActual) {
        const captura = await paginaActual.screenshot({ fullPage: true });
        await test.info().attach(`agente-qa:paso:${titulo}`, { body: captura, contentType: "image/png" });
      }
      return resultado;
    } finally {
      pasoActual = anterior;
    }
  });
}

/** Se usa dentro de un paso `Entonces`, después de sus `expect` — la aserción ya la hizo `expect`,
 *  así que un elemento no visible aquí no captura ni falla, solo se omite. Recuadra el elemento con
 *  un `outline` inyectado, captura la pantalla visible y lo quita para no dejarlo pintado si la
 *  página se reutiliza en el siguiente paso. */
export async function validar(locator: Locator, esperado: unknown): Promise<void> {
  if (!categoriasCapturaActivas().includes("validaciones")) return;
  if (!(await locator.isVisible())) return;
  const titulo = pasoActual ?? "validacion";
  await locator.evaluate((el: HTMLElement) => {
    el.dataset.agenteQaOutlinePrevio = el.style.outline;
    el.style.outline = "3px solid #ff3860";
  });
  const captura = await locator.page().screenshot();
  await locator.evaluate((el: HTMLElement) => {
    el.style.outline = el.dataset.agenteQaOutlinePrevio ?? "";
    delete el.dataset.agenteQaOutlinePrevio;
  });
  await test.info().attach(`agente-qa:validacion:${titulo}`, { body: captura, contentType: "image/png" });
  await test.info().attach(`agente-qa:validacion:${titulo}:esperado`, {
    body: Buffer.from(String(esperado)),
    contentType: "text/plain",
  });
}
