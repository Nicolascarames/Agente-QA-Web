# Capturas en cada validación e informe visual — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada `Entonces` de un test deja una captura recuadrada del elemento comprobado; cada ejecución de Playwright se archiva aparte (JSON + capturas + informe HTML de Playwright) y genera un `informe.html` propio, autocontenido, visible en Reports y abrible suelto.

**Architecture:** Un fichero de apoyo (`tests/soporte/agente-qa.ts`, plantilla en `skill/skills/qa/plantillas/agente-qa.ts`) amplía `test`/`expect` de Playwright con `paso()`/`validar()`, que adjuntan capturas nombradas `agente-qa:*` vía `testInfo.attach`. El ejecutor del servidor (`server/ejecutorTests.ts`) pasa esa categoría por `AGENTE_QA_CAPTURAS` y activa el reporter `html` de Playwright. Un módulo nuevo (`server/informes.ts`) copia `test-results/` y `playwright-report/` a `agente-qa-informes/<id>/` antes de que la siguiente ejecución los borre, y genera un `informe.html` propio con una función pura. Dos rutas nuevas (`GET /api/informes`, `GET /informes/<id>/*`) exponen el archivo a la web.

**Tech Stack:** TypeScript, Fastify + `@fastify/static`, Playwright (`@playwright/test` `^1.63.0`), React, Vitest.

**Spec:** [`docs/superpowers/specs/2026-09-26-capturas-e-informe-visual.md`](../specs/2026-09-26-capturas-e-informe-visual.md) — este plan argumenta contra ella; quien ejecute las tareas debe leer las dos.

## Global Constraints

- La línea de comandos manda sobre `playwright.config.ts` del repo destino — nunca se edita ese fichero (es ajeno). Todo se fija por variable de entorno o flag de CLI.
- `capturas` por defecto es `["validaciones"]`; `historial` por defecto es `null` (guarda todo). Si un campo no existe en `agente-qa.config.json`, vale el defecto; si `capturas` es `[]` explícito, no se captura nada.
- Node mínimo 22 (`fs.cp`/`fs.readdir` con las firmas usadas aquí ya están disponibles).
- Ningún módulo nuevo debe tumbar la ejecución de tests ni el turno del agente si falla: `server/informes.ts` atrapa sus propios errores y los manda a `console.error`, nunca los propaga (mismo criterio que `server/reporter.ts`/`server/costes.ts`).
- Tests con `vitest` (`server/**/*.test.ts`), patrón de directorio temporal real (`mkdtemp`/`rm` en `beforeEach`/`afterEach`), nunca mocks de `node:fs`.
- Todo nombre de identificador nuevo en castellano, siguiendo la convención ya establecida del repo (`archivarUltimaEjecucion`, no `archiveLatestRun`).

## Review Focus

- `capturas: []` enviado desde Ejecutar debe distinguirse de "no enviado": `POST /api/tests/ejecutar` debe comprobar `req.body?.capturas !== undefined`, nunca un chequeo truthy — con `||` o `??` mal puestos, una lista vacía elegida a propósito caería al valor de Configuración y SÍ capturaría. (Task 6)
- `historial` inválido (`0`, negativo, no numérico, escrito a mano en `agente-qa.config.json`) debe caer a `null` (guardar todo) sin lanzar ni guardar un número que borre todo el histórico en la próxima poda. (Task 1)
- `GET /informes/<id>/*` con un `id` que contenga `..`, `/` o su forma codificada (`%2e%2e`, `%2f`) debe rechazarse con 400 antes de tocar el filesystem — no basta con confiar en que `@fastify/static` normalice la ruta. (Task 6)
- `test-results/results.json` corrupto, incompleto (sin `stats`) o ausente no debe tumbar `archivarUltimaEjecucion` ni el turno del agente que la llama después. (Task 5)
- Dos ejecuciones reales dentro del mismo segundo de reloj (mismo id derivado de `stats.startTime`) no deben hacer que `archivarUltimaEjecucion` lance una excepción — es una pérdida silenciosa aceptada (ver nota de idempotencia en Task 5), pero el proceso debe seguir vivo.

---

## Task 1: Tipos de captura/historial y su lectura en `agente-qa.config.json`

**Files:**
- Modify: `shared/tipos.ts`
- Modify: `server/proyecto.ts`
- Test: `server/proyecto.test.ts`

**Interfaces:**
- Produces: `CategoriaCaptura = "validaciones" | "fallos" | "pasos"` (exportado desde `shared/tipos.ts`); `ConfigRaiz` gana `capturas: CategoriaCaptura[]` y `historial: number | null`; `ResumenInforme { id: string; fecha: string; duracionMs: number; verdes: number; rojos: number; specs: string[] }` (usado por Task 5/6/8/11); `asegurarGitignore(rootDir: string, entrada: string): Promise<void>` exportado desde `server/proyecto.ts` (usado por Task 5).

- [ ] **Step 1: Escribir los tests que fallan**

Añadir al final de `server/proyecto.test.ts` (respeta el patrón `mkdtemp`/`afterEach` ya usado en ese fichero):

```ts
describe("leerConfigRaiz — capturas e historial (spec 2026-09-26)", () => {
  it("capturas por defecto es ['validaciones'] si el campo no existe", async () => {
    await writeFile(configRaizPath(proyecto), JSON.stringify({ appUrl: "https://x" }), "utf8");
    const config = await leerConfigRaiz(proyecto);
    expect(config?.capturas).toEqual(["validaciones"]);
  });

  it("respeta capturas: [] explícito (ninguna captura)", async () => {
    await writeFile(configRaizPath(proyecto), JSON.stringify({ appUrl: "https://x", capturas: [] }), "utf8");
    const config = await leerConfigRaiz(proyecto);
    expect(config?.capturas).toEqual([]);
  });

  it("descarta categorías desconocidas sin tumbar la lectura", async () => {
    await writeFile(configRaizPath(proyecto), JSON.stringify({ appUrl: "https://x", capturas: ["fallos", "inventada"] }), "utf8");
    const config = await leerConfigRaiz(proyecto);
    expect(config?.capturas).toEqual(["fallos"]);
  });

  it("historial por defecto es null (guarda todo) si el campo no existe", async () => {
    await writeFile(configRaizPath(proyecto), JSON.stringify({ appUrl: "https://x" }), "utf8");
    const config = await leerConfigRaiz(proyecto);
    expect(config?.historial).toBeNull();
  });

  it("historial acepta un número entero >= 1", async () => {
    await writeFile(configRaizPath(proyecto), JSON.stringify({ appUrl: "https://x", historial: 15 }), "utf8");
    const config = await leerConfigRaiz(proyecto);
    expect(config?.historial).toBe(15);
  });

  it("historial inválido (0, negativo, no numérico) cae a null en vez de tumbar la lectura", async () => {
    await writeFile(configRaizPath(proyecto), JSON.stringify({ appUrl: "https://x", historial: -3 }), "utf8");
    const config = await leerConfigRaiz(proyecto);
    expect(config?.historial).toBeNull();
  });
});

describe("asegurarGitignore (generalizada de la spec de capturas)", () => {
  it("crea .gitignore con la entrada si no existe el fichero", async () => {
    await asegurarGitignore(proyecto, "agente-qa-informes/");
    const contenido = await readFile(path.join(proyecto, ".gitignore"), "utf8");
    expect(contenido).toContain("agente-qa-informes/");
  });

  it("no duplica la entrada si ya está", async () => {
    await asegurarGitignore(proyecto, "agente-qa-informes/");
    await asegurarGitignore(proyecto, "agente-qa-informes/");
    const contenido = await readFile(path.join(proyecto, ".gitignore"), "utf8");
    expect(contenido.split("\n").filter((l) => l.trim() === "agente-qa-informes/")).toHaveLength(1);
  });
});
```

Añadir `asegurarGitignore` al import existente de `./proyecto.js` en la cabecera del test.

- [ ] **Step 2: Ejecutar y comprobar que fallan**

Run: `npx vitest run server/proyecto.test.ts`
Expected: FAIL — `capturas`/`historial` no existen en `ConfigRaiz`, `asegurarGitignore` no está exportada.

- [ ] **Step 3: `shared/tipos.ts` — añadir los tipos**

En `shared/tipos.ts`, justo antes de `export interface ConfigRaiz {`:

```ts
export type CategoriaCaptura = "validaciones" | "fallos" | "pasos";
```

Y dentro de `ConfigRaiz`, después de `presupuestoUsd: number;`:

```ts
  capturas: CategoriaCaptura[];
  historial: number | null;
```

Después de la interfaz `ResultadoEjecucionPlaywright` (o al final del fichero), añadir:

```ts
export interface ResumenInforme {
  id: string;
  fecha: string;
  duracionMs: number;
  verdes: number;
  rojos: number;
  specs: string[];
}
```

- [ ] **Step 4: `server/proyecto.ts` — defaults y generalizar el gitignore**

Añadir el import de `CategoriaCaptura` a la cabecera:

```ts
import type { CategoriaCaptura, ConfigCredenciales, ConfigRaiz, ModeloAgente, PoliticaPuertas } from "../shared/tipos.js";
```

Después de `function modeloValido(...)`, añadir:

```ts
const CATEGORIAS_CAPTURA_VALIDAS: readonly CategoriaCaptura[] = ["validaciones", "fallos", "pasos"];

function capturasValidas(valor: unknown): CategoriaCaptura[] {
  if (!Array.isArray(valor)) return ["validaciones"];
  return valor.filter((v): v is CategoriaCaptura => (CATEGORIAS_CAPTURA_VALIDAS as readonly unknown[]).includes(v));
}

function historialValido(valor: unknown): number | null {
  if (typeof valor === "number" && Number.isFinite(valor) && valor >= 1) return Math.floor(valor);
  return null;
}
```

En `leerConfigRaiz`, dentro del `return`, añadir tras `presupuestoUsd: ...`:

```ts
      capturas: capturasValidas(candidato.capturas),
      historial: historialValido(candidato.historial),
```

Sustituir el bloque `const ENTRADA_GITIGNORE = ...` / `asegurarGitignoreCredenciales` / `escribirCredenciales` por:

```ts
const ENTRADA_GITIGNORE_CREDENCIALES = "agente-qa.credenciales.json";

/** Generalizada (spec de capturas, 2026-09-26): antes solo servía a `agente-qa.credenciales.json`,
 *  hardcodeada dentro de `escribirCredenciales`. `server/informes.ts` la reutiliza para ignorar
 *  `agente-qa-informes/` la primera vez que se archiva una ejecución. */
export async function asegurarGitignore(rootDir: string, entrada: string): Promise<void> {
  const ruta = path.join(rootDir, ".gitignore");
  let actual = "";
  try {
    actual = await fs.readFile(ruta, "utf8");
  } catch {
    // Sin .gitignore todavía: se crea con solo esta línea.
  }
  if (actual.split(/\r?\n/).some((linea) => linea.trim() === entrada)) return;
  const separador = actual.length > 0 && !actual.endsWith("\n") ? "\n" : "";
  await fs.writeFile(ruta, `${actual}${separador}${entrada}\n`, "utf8");
}

export async function escribirCredenciales(rootDir: string, credenciales: ConfigCredenciales): Promise<void> {
  await asegurarGitignore(rootDir, ENTRADA_GITIGNORE_CREDENCIALES);
  await fs.writeFile(credencialesPath(rootDir), JSON.stringify(credenciales, null, 2) + "\n", "utf8");
}
```

- [ ] **Step 5: Ejecutar y comprobar que pasan**

Run: `npx vitest run server/proyecto.test.ts`
Expected: PASS (todos los `it` nuevos y los preexistentes).

- [ ] **Step 6: Typecheck y commit**

Run: `npm run typecheck`
Expected: sin errores (revisa que ningún otro lugar construya un `ConfigRaiz` literal sin `capturas`/`historial` — `server/app.ts` y `src/Configuracion.tsx` se actualizan en Task 6 y Task 9 respectivamente; hasta entonces el typecheck de ESTE paso puede fallar en esos dos ficheros, lo cual es esperado y se resuelve en sus tareas).

```bash
git add shared/tipos.ts server/proyecto.ts server/proyecto.test.ts
git commit -m "feat: capturas e historial en ConfigRaiz, gitignore genérico"
```

---

## Task 2: Fichero de apoyo `tests/soporte/agente-qa.ts` (plantilla)

**Files:**
- Create: `skill/skills/qa/plantillas/agente-qa.ts`
- Test: `skill/skills/qa/plantillas/agente-qa.test.ts`

**Interfaces:**
- Consumes: nada de tareas anteriores (fichero autocontenido, fuera del `tsconfig` del repo).
- Produces: `test`, `expect`, `paso(titulo, fn)`, `validar(locator, esperado)`, `categoriasCapturaActivas(): CategoriaCaptura[]` — usados por specs del repo destino (Task 3 los referencia desde `SKILL.md`) y probados aquí de forma aislada.

- [ ] **Step 1: Escribir el test de la única lógica pura del fichero**

`skill/skills/qa/plantillas/agente-qa.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { categoriasCapturaActivas, expect as expectReexportado, paso, test, validar } from "./agente-qa.js";

describe("categoriasCapturaActivas — lee AGENTE_QA_CAPTURAS", () => {
  const original = process.env.AGENTE_QA_CAPTURAS;

  beforeEach(() => {
    delete process.env.AGENTE_QA_CAPTURAS;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.AGENTE_QA_CAPTURAS;
    else process.env.AGENTE_QA_CAPTURAS = original;
  });

  it("sin la variable, vale ['validaciones']", () => {
    expect(categoriasCapturaActivas()).toEqual(["validaciones"]);
  });

  it("variable vacía, no captura nada", () => {
    process.env.AGENTE_QA_CAPTURAS = "";
    expect(categoriasCapturaActivas()).toEqual([]);
  });

  it("lista separada por comas, con espacios", () => {
    process.env.AGENTE_QA_CAPTURAS = "validaciones, fallos";
    expect(categoriasCapturaActivas()).toEqual(["validaciones", "fallos"]);
  });

  it("descarta categorías desconocidas", () => {
    process.env.AGENTE_QA_CAPTURAS = "fallos,inventada";
    expect(categoriasCapturaActivas()).toEqual(["fallos"]);
  });
});

describe("exports del fichero de apoyo", () => {
  it("expone test, expect, paso y validar como funciones/objeto utilizables", () => {
    expect(typeof test).toBe("function");
    expect(typeof expectReexportado).toBe("function");
    expect(typeof paso).toBe("function");
    expect(typeof validar).toBe("function");
  });
});
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx vitest run skill/skills/qa/plantillas/agente-qa.test.ts`
Expected: FAIL — el módulo `./agente-qa.js` no existe todavía.

- [ ] **Step 3: Escribir la plantilla**

`skill/skills/qa/plantillas/agente-qa.ts`:

```ts
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
```

- [ ] **Step 4: Ejecutar y comprobar que pasa**

Run: `npx vitest run skill/skills/qa/plantillas/agente-qa.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add skill/skills/qa/plantillas/agente-qa.ts skill/skills/qa/plantillas/agente-qa.test.ts
git commit -m "feat: plantilla tests/soporte/agente-qa.ts con paso()/validar()"
```

---

## Task 3: `SKILL.md` — copiar el soporte, usar `paso`/`validar`, comando con `html`

**Files:**
- Modify: `skill/skills/qa/SKILL.md`

**Interfaces:**
- Consumes: `skill/skills/qa/plantillas/agente-qa.ts` (Task 2), referenciado por ruta relativa.
- Produces: texto que el agente lee al escribir specs — ninguna interfaz de código.

- [ ] **Step 1: Sección 3 — añadir el aviso del fichero de apoyo**

En `skill/skills/qa/SKILL.md`, dentro de la lista de los tres pasos (después de `3. **Test** — el \`.spec.ts\` que ejecuta el escenario y lo pone en verde.` y antes del párrafo "**Cuántas de estas puertas...**"), insertar:

```
Antes de escribir el `.spec.ts`, si `tests/soporte/agente-qa.ts` todavía no existe en este repo,
cópialo tal cual desde [plantillas/agente-qa.ts](../plantillas/agente-qa.ts). Los specs importan
`test`, `expect`, `paso` y `validar` desde `../soporte/agente-qa` — nunca `test`/`expect` sueltos de
`@playwright/test`. Usan `paso(titulo, fn)` en vez de `test.step(titulo, fn)` (mismo título, la
trazabilidad no cambia), y cada `Entonces` termina con `validar(locator, esperado)` sobre el
elemento que acaba de comprobar, después de su `expect`.
```

- [ ] **Step 2: Sección 4 — el comando exacto**

Sustituir el bloque de comando de la sección "4. Definición de terminado":

Antes:
```
PLAYWRIGHT_JSON_OUTPUT_NAME=test-results/results.json npx playwright test --reporter=list,json
```

Después:
```
PLAYWRIGHT_JSON_OUTPUT_NAME=test-results/results.json PLAYWRIGHT_HTML_OPEN=never npx playwright test --reporter=list,json,html
```

- [ ] **Step 3: Sección 5 — estructura de carpetas**

Añadir una línea a la estructura de `tests/`:

```
tests/
  features/   *.feature       — el Gherkin
  pages/      *.page.ts       — Page Objects
  specs/      *.spec.ts       — los tests
  soporte/    agente-qa.ts    — test/expect/paso/validar ampliados con capturas (copiado de la skill)
```

- [ ] **Step 4: Verificación (sin vitest — fichero de texto)**

Run: `grep -c "reporter=list,json,html" skill/skills/qa/SKILL.md` (o el equivalente con el tool Grep)
Expected: `1` — y `grep -c "reporter=list,json\"" skill/skills/qa/SKILL.md` (sin `,html`) da `0`, confirmando que no queda el comando viejo.

- [ ] **Step 5: Commit**

```bash
git add skill/skills/qa/SKILL.md
git commit -m "docs: SKILL.md copia el soporte de capturas y activa el reporter html"
```

---

## Task 4: `server/ejecutorTests.ts` — reporter `html` y `AGENTE_QA_CAPTURAS`

**Files:**
- Modify: `server/ejecutorTests.ts`
- Test: `server/ejecutorTests.test.ts`

**Interfaces:**
- Consumes: `CategoriaCaptura` (Task 1, `shared/tipos.ts`).
- Produces: `ejecutarPlaywright(rootDir, rutaSpec?, credenciales?, onLinea?, capturas?)` — el 5º parámetro es nuevo; el resto del contrato no cambia. Usado por `server/app.ts` (Task 6).

- [ ] **Step 1: Escribir los tests que fallan**

Añadir a `server/ejecutorTests.test.ts` (mismo patrón `vi.mock("node:child_process")` + `crearProcesoFalso` ya presente en el fichero):

```ts
describe("ejecutarPlaywright — reporter html y AGENTE_QA_CAPTURAS (spec 2026-09-26)", () => {
  it("pasa --reporter=list,json,html y PLAYWRIGHT_HTML_OPEN=never", async () => {
    const promesa = ejecutarPlaywright("/repo");
    procesoFalso.emit("close", 0);
    await promesa;
    expect(spawn).toHaveBeenCalledWith(
      "npx",
      expect.arrayContaining(["--reporter=list,json,html"]),
      expect.objectContaining({ env: expect.objectContaining({ PLAYWRIGHT_HTML_OPEN: "never" }) }),
    );
  });

  it("sin capturas explícitas, AGENTE_QA_CAPTURAS vale 'validaciones'", async () => {
    const promesa = ejecutarPlaywright("/repo");
    procesoFalso.emit("close", 0);
    await promesa;
    expect(spawn).toHaveBeenCalledWith("npx", expect.any(Array), expect.objectContaining({ env: expect.objectContaining({ AGENTE_QA_CAPTURAS: "validaciones" }) }));
  });

  it("con capturas: [] explícito, AGENTE_QA_CAPTURAS es una cadena vacía", async () => {
    const promesa = ejecutarPlaywright("/repo", undefined, {}, undefined, []);
    procesoFalso.emit("close", 0);
    await promesa;
    expect(spawn).toHaveBeenCalledWith("npx", expect.any(Array), expect.objectContaining({ env: expect.objectContaining({ AGENTE_QA_CAPTURAS: "" }) }));
  });

  it("con capturas: ['fallos','pasos'], AGENTE_QA_CAPTURAS las une con coma", async () => {
    const promesa = ejecutarPlaywright("/repo", undefined, {}, undefined, ["fallos", "pasos"]);
    procesoFalso.emit("close", 0);
    await promesa;
    expect(spawn).toHaveBeenCalledWith("npx", expect.any(Array), expect.objectContaining({ env: expect.objectContaining({ AGENTE_QA_CAPTURAS: "fallos,pasos" }) }));
  });
});
```

- [ ] **Step 2: Ejecutar y comprobar que fallan**

Run: `npx vitest run server/ejecutorTests.test.ts`
Expected: FAIL — el comando sigue siendo `list,json` y no existe `AGENTE_QA_CAPTURAS` en el entorno pasado a `spawn`.

- [ ] **Step 3: Modificar `server/ejecutorTests.ts`**

Reemplazar el fichero completo por:

```ts
// Ejecuta Playwright de verdad sobre el proyecto activo. Mismo comando que exige
// `skill/skills/qa/SKILL.md` §4 para que el JSON y el HTML existan
// (`PLAYWRIGHT_JSON_OUTPUT_NAME`, `--reporter=list,json,html`, `PLAYWRIGHT_HTML_OPEN=never`):
// `server/informes.ts` archiva `test-results/`/`playwright-report/` después de cada corrida, antes
// de que la siguiente los vacíe.
import { spawn } from "node:child_process";
import type { CategoriaCaptura, ResultadoEjecucionPlaywright } from "../shared/tipos.js";

export type { ResultadoEjecucionPlaywright } from "../shared/tipos.js";

/**
 * `rutaSpec`, si se pasa, limita la ejecución a ese fichero (botón por fila); sin ella, corre toda
 * la suite (botón "Ejecutar todos"). `npx` en Windows es un `.cmd`, así que hace falta `shell: true`
 * para poder lanzarlo — por eso `rutaSpec` se valida ANTES de llegar aquí (`rutaSpecSegura` en
 * `app.ts`): con shell de por medio, un argumento sin validar sería inyección de comandos.
 *
 * `credenciales` se pasan como variables de entorno al proceso de Playwright.
 *
 * `onLinea`, si se pasa, recibe cada línea completa de `stdout`/`stderr` según va saliendo, sin
 * códigos ANSI — canal en vivo de `GET /api/tests/eventos`.
 *
 * `capturas` (spec 2026-09-26) fija `AGENTE_QA_CAPTURAS` para `tests/soporte/agente-qa.ts`: sin
 * indicar, "validaciones" (mismo defecto que el fichero de apoyo si la variable faltase del todo);
 * una lista vacía apaga las capturas de esta ejecución.
 */
export function ejecutarPlaywright(
  rootDir: string,
  rutaSpec?: string,
  credenciales: Record<string, string> = {},
  onLinea?: (linea: string) => void,
  capturas: CategoriaCaptura[] = ["validaciones"],
): Promise<ResultadoEjecucionPlaywright> {
  return new Promise((resolve) => {
    const args = ["playwright", "test", "--reporter=list,json,html"];
    if (rutaSpec) args.push(rutaSpec);

    const proceso = spawn("npx", args, {
      cwd: rootDir,
      env: {
        ...process.env,
        ...credenciales,
        PLAYWRIGHT_JSON_OUTPUT_NAME: "test-results/results.json",
        PLAYWRIGHT_HTML_OPEN: "never",
        PLAYWRIGHT_HTML_OUTPUT_DIR: "playwright-report",
        AGENTE_QA_CAPTURAS: capturas.join(","),
      },
      shell: process.platform === "win32",
    });

    let salida = "";
    let bufferLinea = "";
    function volcarLineas(fragmento: string) {
      bufferLinea += fragmento;
      const lineas = bufferLinea.split(/\r?\n/);
      bufferLinea = lineas.pop() ?? "";
      for (const linea of lineas) onLinea?.(linea.replace(/\[[0-9;]*[A-Za-z]/g, ""));
    }
    proceso.stdout?.on("data", (fragmento: Buffer) => {
      const texto = fragmento.toString();
      salida += texto;
      volcarLineas(texto);
    });
    proceso.stderr?.on("data", (fragmento: Buffer) => {
      const texto = fragmento.toString();
      salida += texto;
      volcarLineas(texto);
    });
    proceso.on("error", (err) => {
      resolve({ ok: false, codigo: null, salida: `No se pudo lanzar Playwright: ${err.message}` });
    });
    proceso.on("close", (codigo) => {
      if (bufferLinea !== "") onLinea?.(bufferLinea.replace(/\[[0-9;]*[A-Za-z]/g, ""));
      resolve({ ok: codigo === 0, codigo, salida });
    });
  });
}
```

- [ ] **Step 4: Ejecutar y comprobar que pasan**

Run: `npx vitest run server/ejecutorTests.test.ts`
Expected: PASS (incluidos los tests preexistentes de troceado de líneas, que no tocan `args`/`env`).

- [ ] **Step 5: Commit**

```bash
git add server/ejecutorTests.ts server/ejecutorTests.test.ts
git commit -m "feat: ejecutorTests activa el reporter html y AGENTE_QA_CAPTURAS"
```

---

## Task 5: `server/informes.ts` — archivar la ejecución y generar `informe.html`

**Files:**
- Create: `server/informes.ts`
- Test: `server/informes.test.ts`

**Interfaces:**
- Consumes: `asegurarGitignore(rootDir, entrada)` (Task 1, `server/proyecto.ts`); `ResumenInforme` (Task 1, `shared/tipos.ts`).
- Produces: `archivarUltimaEjecucion(rootDir: string, config: { historial: number | null }): Promise<void>`; `listarInformes(rootDir: string): Promise<ResumenInforme[]>`; `idInformeValido(id: string): boolean`; `generarInformeHtml(reporte: ReporteCrudo, capturasCopiadas: string[]): string`. Usados por `server/app.ts` (Task 6) y `server/agente.ts` (Task 7). `ReporteCrudo` se exporta también, para que Task 6 no tenga que redefinirlo si necesita tipar la ruta estática.

- [ ] **Step 1: Escribir los tests que fallan**

`server/informes.test.ts`:

```ts
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { archivarUltimaEjecucion, generarInformeHtml, idInformeValido, listarInformes } from "./informes.js";
import type { ResumenInforme } from "../shared/tipos.js";

function reporteEjemplo(startTime: string, adjuntos: { path: string; name: string }[] = []) {
  return {
    stats: { startTime, duration: 1234 },
    suites: [
      {
        file: "specs/anadir-al-carrito.spec.ts",
        specs: [
          {
            title: "añade una mochila al carrito",
            file: "specs/anadir-al-carrito.spec.ts",
            tests: [{ results: [{ status: "passed", attachments: adjuntos }] }],
          },
        ],
      },
    ],
  };
}

describe("archivarUltimaEjecucion", () => {
  let proyecto: string;

  beforeEach(async () => {
    proyecto = await mkdtemp(path.join(tmpdir(), "agente-qa-web-informes-"));
  });

  afterEach(async () => {
    await rm(proyecto, { recursive: true, force: true });
  });

  it("no hace nada si test-results/results.json no existe", async () => {
    await archivarUltimaEjecucion(proyecto, { historial: null });
    await expect(readdir(path.join(proyecto, "agente-qa-informes")).catch(() => [])).resolves.toEqual([]);
  });

  it("archiva results.json, capturas y el resumen", async () => {
    const capturaAbs = path.join(proyecto, "captura-fallo.png");
    await writeFile(capturaAbs, Buffer.from([1, 2, 3]));
    await mkdir(path.join(proyecto, "test-results"), { recursive: true });
    await writeFile(
      path.join(proyecto, "test-results", "results.json"),
      JSON.stringify(reporteEjemplo("2026-09-26T10:15:30.000Z", [{ name: "agente-qa:validacion:Entonces veo el carrito", path: capturaAbs }])),
      "utf8",
    );

    await archivarUltimaEjecucion(proyecto, { historial: null });

    const base = path.join(proyecto, "agente-qa-informes", "2026-09-26_10-15-30");
    const resumen = JSON.parse(await readFile(path.join(base, "resumen.json"), "utf8")) as ResumenInforme;
    expect(resumen).toMatchObject({ id: "2026-09-26_10-15-30", verdes: 1, rojos: 0 });
    await expect(readFile(path.join(base, "capturas", "captura-fallo.png"))).resolves.toBeInstanceOf(Buffer);
    await expect(readFile(path.join(base, "informe.html"), "utf8")).resolves.toContain("<html");

    const gitignore = await readFile(path.join(proyecto, ".gitignore"), "utf8");
    expect(gitignore).toContain("agente-qa-informes/");
  });

  it("no duplica una ejecución ya archivada (llamable varias veces)", async () => {
    await mkdir(path.join(proyecto, "test-results"), { recursive: true });
    await writeFile(path.join(proyecto, "test-results", "results.json"), JSON.stringify(reporteEjemplo("2026-09-26T10:15:30.000Z")), "utf8");

    await archivarUltimaEjecucion(proyecto, { historial: null });
    await archivarUltimaEjecucion(proyecto, { historial: null });

    const entradas = await readdir(path.join(proyecto, "agente-qa-informes"));
    expect(entradas).toHaveLength(1);
  });

  it("poda hasta N ejecuciones cuando historial es un número", async () => {
    await mkdir(path.join(proyecto, "test-results"), { recursive: true });
    for (const hora of ["08", "09", "10"]) {
      await writeFile(path.join(proyecto, "test-results", "results.json"), JSON.stringify(reporteEjemplo(`2026-09-26T${hora}:00:00.000Z`)), "utf8");
      await archivarUltimaEjecucion(proyecto, { historial: 2 });
    }
    const entradas = (await readdir(path.join(proyecto, "agente-qa-informes"))).sort();
    expect(entradas).toEqual(["2026-09-26_09-00-00", "2026-09-26_10-00-00"]);
  });

  it("un results.json corrupto no lanza", async () => {
    await mkdir(path.join(proyecto, "test-results"), { recursive: true });
    await writeFile(path.join(proyecto, "test-results", "results.json"), "{ esto no es json", "utf8");
    await expect(archivarUltimaEjecucion(proyecto, { historial: null })).resolves.toBeUndefined();
  });
});

describe("listarInformes", () => {
  let proyecto: string;

  beforeEach(async () => {
    proyecto = await mkdtemp(path.join(tmpdir(), "agente-qa-web-informes-listar-"));
  });

  afterEach(async () => {
    await rm(proyecto, { recursive: true, force: true });
  });

  it("devuelve [] si no hay ninguna ejecución archivada", async () => {
    await expect(listarInformes(proyecto)).resolves.toEqual([]);
  });

  it("devuelve las ejecuciones de más reciente a más antigua", async () => {
    await mkdir(path.join(proyecto, "test-results"), { recursive: true });
    await writeFile(path.join(proyecto, "test-results", "results.json"), JSON.stringify(reporteEjemplo("2026-09-26T08:00:00.000Z")), "utf8");
    await archivarUltimaEjecucion(proyecto, { historial: null });
    await writeFile(path.join(proyecto, "test-results", "results.json"), JSON.stringify(reporteEjemplo("2026-09-26T09:00:00.000Z")), "utf8");
    await archivarUltimaEjecucion(proyecto, { historial: null });

    const informes = await listarInformes(proyecto);
    expect(informes.map((i) => i.id)).toEqual(["2026-09-26_09-00-00", "2026-09-26_08-00-00"]);
  });
});

describe("idInformeValido", () => {
  it("acepta el formato AAAA-MM-DD_HH-mm-ss", () => {
    expect(idInformeValido("2026-09-26_10-15-30")).toBe(true);
  });

  it("rechaza cualquier intento de path traversal", () => {
    expect(idInformeValido("..")).toBe(false);
    expect(idInformeValido("../../etc")).toBe(false);
    expect(idInformeValido("2026-09-26_10-15-30/../etc")).toBe(false);
  });
});

describe("generarInformeHtml", () => {
  it("incluye el título del test, el conteo de verdes/rojos y un <img> con ruta relativa", () => {
    const html = generarInformeHtml(reporteEjemplo("2026-09-26T10:15:30.000Z", [{ name: "agente-qa:validacion:Entonces veo el carrito", path: "/x/captura.png" }]), ["captura.png"]);
    expect(html).toContain("añade una mochila al carrito");
    expect(html).toContain("1 verdes");
    expect(html).toContain('src="capturas/captura.png"');
  });
});
```

- [ ] **Step 2: Ejecutar y comprobar que fallan**

Run: `npx vitest run server/informes.test.ts`
Expected: FAIL — el módulo `./informes.js` no existe.

- [ ] **Step 3: Escribir `server/informes.ts`**

```ts
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
```

- [ ] **Step 4: Ejecutar y comprobar que pasan**

Run: `npx vitest run server/informes.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck y commit**

Run: `npm run typecheck`

```bash
git add server/informes.ts server/informes.test.ts
git commit -m "feat: archivar ejecuciones e informe.html autocontenido"
```

---

## Task 6: `server/app.ts` — capturas en el body, `GET /api/informes`, `GET /informes/<id>/*`

**Files:**
- Modify: `server/app.ts`

**Interfaces:**
- Consumes: `archivarUltimaEjecucion`, `listarInformes`, `idInformeValido` (Task 5); `CategoriaCaptura`, `ResumenInforme` (Task 1).
- Produces: `POST /api/tests/ejecutar` acepta `{ ruta?: string; capturas?: CategoriaCaptura[] }`; `GET /api/informes` devuelve `ResumenInforme[]`; `GET /informes/<id>/*` sirve los ficheros archivados. Usado por `src/api.ts` (Task 8).

- [ ] **Step 1: Escribir los tests que fallan**

Añadir a `server/app.test.ts` (usa el `proyecto` de `mkdtemp` ya declarado en el `describe("buildApp", ...)` existente):

```ts
describe("POST /api/tests/ejecutar — capturas (spec 2026-09-26)", () => {
  it("capturas: [] explícito no cae al defecto de config (['validaciones'])", async () => {
    await writeFile(
      path.join(proyecto, "agente-qa.config.json"),
      JSON.stringify({ appUrl: "https://x", capturas: ["fallos"] }),
      "utf8",
    );
    const ejecutarFn = vi.fn(async (rootDir: string, _ruta: string | undefined, _cred: Record<string, string>, _onLinea: unknown, capturas: string[]) => {
      await mkdir(path.join(rootDir, "test-results"), { recursive: true });
      await writeFile(path.join(rootDir, "test-results", "results.json"), JSON.stringify({ suites: [] }), "utf8");
      return { ok: true, codigo: 0, salida: "" };
    });
    const app = buildApp({ proyectoInicial: proyecto, ejecutarFn });
    await app.inject({ method: "POST", url: "/api/tests/ejecutar", payload: { capturas: [] } });
    expect(ejecutarFn).toHaveBeenCalledWith(proyecto, undefined, expect.any(Object), expect.any(Function), []);
    await app.close();
  });

  it("sin capturas en el body, usa el capturas de la config", async () => {
    await writeFile(path.join(proyecto, "agente-qa.config.json"), JSON.stringify({ appUrl: "https://x", capturas: ["fallos"] }), "utf8");
    const ejecutarFn = vi.fn(async (rootDir: string) => {
      await mkdir(path.join(rootDir, "test-results"), { recursive: true });
      await writeFile(path.join(rootDir, "test-results", "results.json"), JSON.stringify({ suites: [] }), "utf8");
      return { ok: true, codigo: 0, salida: "" };
    });
    const app = buildApp({ proyectoInicial: proyecto, ejecutarFn });
    await app.inject({ method: "POST", url: "/api/tests/ejecutar", payload: {} });
    expect(ejecutarFn).toHaveBeenCalledWith(proyecto, undefined, expect.any(Object), expect.any(Function), ["fallos"]);
    await app.close();
  });

  it("archiva la ejecución tras ejecutarFn, visible en GET /api/informes", async () => {
    const ejecutarFn = vi.fn(async (rootDir: string) => {
      await mkdir(path.join(rootDir, "test-results"), { recursive: true });
      await writeFile(
        path.join(rootDir, "test-results", "results.json"),
        JSON.stringify({ stats: { startTime: "2026-09-26T10:00:00.000Z", duration: 100 }, suites: [] }),
        "utf8",
      );
      return { ok: true, codigo: 0, salida: "" };
    });
    const app = buildApp({ proyectoInicial: proyecto, ejecutarFn });
    await app.inject({ method: "POST", url: "/api/tests/ejecutar", payload: {} });
    const respuesta = await app.inject({ method: "GET", url: "/api/informes" });
    expect(respuesta.json()).toEqual([expect.objectContaining({ id: "2026-09-26_10-00-00" })]);
    await app.close();
  });
});

describe("GET /informes/<id>/* — validación de path traversal", () => {
  it("rechaza un id con .. antes de tocar el filesystem", async () => {
    const app = buildApp({ proyectoInicial: proyecto });
    const respuesta = await app.inject({ method: "GET", url: "/informes/../../etc/informe.html" });
    expect(respuesta.statusCode).toBe(400);
    await app.close();
  });
});
```

Añadir `mkdir, writeFile` al import de `node:fs/promises` en la cabecera del test si no están ya.

- [ ] **Step 2: Ejecutar y comprobar que fallan**

Run: `npx vitest run server/app.test.ts`
Expected: FAIL — `capturas` no llega a `ejecutarFn`, `/api/informes` da 404, `/informes/...` no está validado.

- [ ] **Step 3: Modificar `server/app.ts`**

Añadir a los imports:

```ts
import { archivarUltimaEjecucion, idInformeValido, listarInformes } from "./informes.js";
```

y `CategoriaCaptura`, `ResumenInforme` al bloque `import type { ... } from "../shared/tipos.js"`.

Extender `CONFIG_RAIZ_POR_DEFECTO` (después de `presupuestoUsd: 2,`):

```ts
  capturas: ["validaciones"],
  historial: null,
```

Extender `AppOptions.ejecutarFn` (Task 4 añadió el 5º parámetro a la función real; el tipo inyectable debe aceptarlo también):

```ts
  ejecutarFn?: (
    rootDir: string,
    rutaSpec?: string,
    credenciales?: Record<string, string>,
    onLinea?: (linea: string) => void,
    capturas?: CategoriaCaptura[],
  ) => Promise<ResultadoEjecucionPlaywright>;
```

Reemplazar el handler `POST /api/tests/ejecutar` completo por:

```ts
  app.post<{ Body: { ruta?: string; capturas?: CategoriaCaptura[] } }>("/api/tests/ejecutar", async (req, reply): Promise<void> => {
    const rutaPedida = req.body?.ruta;
    if (rutaPedida !== undefined && rutaSpecSegura(rutaPedida) === null) {
      await reply.status(400).send({ error: "ruta de spec inválida" });
      return;
    }
    const config = (await leerConfigRaiz(proyectoActivo)) ?? CONFIG_RAIZ_POR_DEFECTO;
    // `capturas` puede llegar como `[]` a propósito (ninguna captura en ESTA ejecución): un chequeo
    // truthy aquí (`req.body?.capturas || config.capturas`) perdería esa elección y usaría siempre
    // el defecto de config. Solo `undefined` (el campo no llegó) cae al config.
    const capturas = req.body?.capturas !== undefined ? req.body.capturas : config.capturas;
    const credenciales = Object.fromEntries((await leerCredenciales(proyectoActivo)).variables.map((v) => [v.nombre, v.valor]));
    difusorTests.emitir({ tipo: "inicio", ruta: rutaPedida });
    const inicio = Date.now();
    let resultado: ResultadoEjecucionPlaywright | undefined;
    try {
      resultado = await ejecutarFn(proyectoActivo, rutaPedida, credenciales, (texto) => {
        difusorTests.emitir({ tipo: "linea", texto });
      }, capturas);
    } finally {
      difusorTests.emitir({ tipo: "fin", ok: resultado?.ok ?? false, codigo: resultado?.codigo ?? null });
    }
    const reporte = await leerReporteUltimaCorrida(proyectoActivo);
    const resultadosEjecucion = (rutaPedida ? reporte.filter((r) => r.ficheroSpec === rutaPedida) : reporte).map((r) => ({
      nombre: r.nombre,
      ficheroSpec: r.ficheroSpec,
      estado: r.estado,
    }));
    await acumularReporte(proyectoActivo);
    await archivarUltimaEjecucion(proyectoActivo, { historial: config.historial });
    await registrarEjecucion(proyectoActivo, {
      costeUsd: 0,
      duracionMs: Date.now() - inicio,
      numTurnos: 0,
      resultados: resultadosEjecucion,
    });
    await reply.send(resultado);
  });
```

Añadir, justo después del bloque `app.get("/api/fragiles", ...)`:

```ts
  // --- Informes visuales (spec 2026-09-26) --------------------------------------------------------

  app.get("/api/informes", async (): Promise<ResumenInforme[]> => listarInformes(proyectoActivo));

  const informesDir = path.join(proyectoActivo, "agente-qa-informes");

  // Defensa en profundidad: `@fastify/static` ya normaliza `..`, pero el resto del repo valida
  // explícitamente cualquier segmento que llegue a una ruta de disco (`rutaGeneradaSegura`,
  // `rutaSpecSegura`, `nombreEscenarioSeguro`) — este hook sigue el mismo patrón para `/informes/`.
  app.addHook("onRequest", async (request, reply) => {
    if (!request.url.startsWith("/informes/")) return;
    const id = decodeURIComponent(request.url.split("/")[2] ?? "");
    if (!idInformeValido(id)) {
      await reply.status(400).send({ error: "id de informe inválido" });
    }
  });

  app.register(fastifyStatic, { root: informesDir, prefix: "/informes/", decorateReply: false });
```

- [ ] **Step 4: Ejecutar y comprobar que pasan**

Run: `npx vitest run server/app.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck y commit**

Run: `npm run typecheck`

```bash
git add server/app.ts server/app.test.ts
git commit -m "feat: capturas por ejecución, GET /api/informes y /informes/<id>/*"
```

---

## Task 7: `server/agente.ts` — archivar también tras el turno del agente

**Files:**
- Modify: `server/agente.ts`
- Modify: `server/app.ts` (una línea: pasar `historial` a `lanzarFn`)
- Test: `server/agente.test.ts`

**Interfaces:**
- Consumes: `archivarUltimaEjecucion` (Task 5).
- Produces: `OpcionesLanzar` gana `historial?: number | null`.

- [ ] **Step 1: Escribir el test que falla**

Localizar en `server/agente.test.ts` el test que verifica la llamada a `acumularReporte`/`registrarEjecucion` tras `operation.completed` (mismo patrón: `vi.mock("./informes.js", ...)` o inspección de un directorio temporal, según cómo ese fichero ya mockee `./reporter.js`/`./costes.js` — sigue el patrón existente en ese fichero para esos dos módulos). Añadir:

```ts
it("archiva la ejecución (server/informes.ts) tras operation.completed, con el historial de las opciones", async () => {
  // Sigue el mismo patrón de mock que ya usa este fichero para acumularReporte/registrarEjecucion:
  // si esos dos se mockean con vi.mock("./reporter.js")/vi.mock("./costes.js"), añade aquí
  // vi.mock("./informes.js", () => ({ archivarUltimaEjecucion: vi.fn() })) al principio del fichero
  // (junto a los otros vi.mock) y espía la llamada igual que ya se hace con registrarEjecucion.
  const { archivarUltimaEjecucion } = await import("./informes.js");
  const sesion = lanzar("hazlo", { cwd: "/repo", historial: 5, queryFn: crearQueryFalsa([{ type: "result", is_error: false }]) });
  await drenarSesion(sesion); // usa el helper de drenado ya existente en este fichero, si lo hay
  expect(archivarUltimaEjecucion).toHaveBeenCalledWith("/repo", { historial: 5 });
});
```

Si el fichero no tiene un helper `drenarSesion`/`crearQueryFalsa`, usar el patrón exacto que ya empleen los tests vecinos de `operation.completed` en ese mismo fichero (cópialo, no lo reinventes).

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx vitest run server/agente.test.ts`
Expected: FAIL — `archivarUltimaEjecucion` no se llama todavía.

- [ ] **Step 3: Modificar `server/agente.ts`**

Añadir el import junto a los demás de módulos `./*.js`:

```ts
import { archivarUltimaEjecucion } from "./informes.js";
```

Añadir a `OpcionesLanzar`, junto a `presupuestoUsd`:

```ts
  /** Spec de capturas (2026-09-26): cuántas ejecuciones archivadas en `agente-qa-informes/`
   *  conservar tras el turno del agente. `null`/sin indicar, guarda todas. */
  historial?: number | null;
```

Dentro del bloque `try` que ya llama a `acumularReporte(opciones.cwd)` (dentro del `if (mensaje.type === "result")`), añadir justo después de esa línea:

```ts
            await archivarUltimaEjecucion(opciones.cwd, { historial: opciones.historial ?? null });
```

- [ ] **Step 4: `server/app.ts` — pasar `historial` a `lanzarFn`**

En el objeto de opciones de `lanzarFn(texto, { ... })` dentro de `POST /api/comando`, añadir tras `presupuestoUsd: config?.presupuestoUsd,`:

```ts
        historial: config?.historial,
```

- [ ] **Step 5: Ejecutar y comprobar que pasan**

Run: `npx vitest run server/agente.test.ts server/app.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck y commit**

Run: `npm run typecheck`

```bash
git add server/agente.ts server/app.ts server/agente.test.ts
git commit -m "feat: el agente también archiva su ejecución tras cada turno"
```

---

## Task 8: `src/api.ts` — `obtenerInformes` y `ejecutarTests` con `capturas`

**Files:**
- Modify: `src/api.ts`

**Interfaces:**
- Consumes: `GET /api/informes`, `POST /api/tests/ejecutar` con `capturas` (Task 6).
- Produces: `obtenerInformes(): Promise<ResumenInforme[]>`; `ejecutarTests(ruta?: string, capturas?: CategoriaCaptura[]): Promise<ResultadoEjecucionPlaywright>` — firma ampliada, compatible con las llamadas existentes de un solo argumento. Usado por Task 9, 10, 11.

No hay test dedicado a este fichero en el repo (`src/api.ts` es una capa fina sobre `fetch`, sin tests propios hoy — mismo patrón que el resto de funciones de ese fichero); la cobertura llega vía los tests de `server/app.ts` (contrato) y la verificación en vivo de Task 12.

- [ ] **Step 1: Añadir `ResumenInforme` y `CategoriaCaptura` al import de tipos**

En la cabecera de `src/api.ts`, añadir `CategoriaCaptura` y `ResumenInforme` a la lista de `import type { ... } from "../shared/tipos"`.

- [ ] **Step 2: Ampliar `ejecutarTests`**

Reemplazar:

```ts
export function ejecutarTests(ruta?: string): Promise<ResultadoEjecucionPlaywright> {
  return pedirJsonEstricto<ResultadoEjecucionPlaywright>("/api/tests/ejecutar", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(ruta ? { ruta } : {}),
  });
}
```

Por:

```ts
/** `capturas`, si se pasa, vale solo para ESTA ejecución (Ejecutar la envía siempre una vez cargada
 *  la config; sin ella, el servidor usa el capturas guardado en Configuración). */
export function ejecutarTests(ruta?: string, capturas?: CategoriaCaptura[]): Promise<ResultadoEjecucionPlaywright> {
  const body: { ruta?: string; capturas?: CategoriaCaptura[] } = {};
  if (ruta) body.ruta = ruta;
  if (capturas) body.capturas = capturas;
  return pedirJsonEstricto<ResultadoEjecucionPlaywright>("/api/tests/ejecutar", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
```

- [ ] **Step 3: Añadir `obtenerInformes`**

Al final del fichero:

```ts
export function obtenerInformes(): Promise<ResumenInforme[]> {
  return pedirJson<ResumenInforme[]>("/api/informes");
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: sin errores (ningún llamador existente de `ejecutarTests` rompe: sigue aceptando 0 o 1 argumento).

- [ ] **Step 5: Commit**

```bash
git add src/api.ts
git commit -m "feat: cliente de /api/informes y capturas por ejecución"
```

---

## Task 9: `src/Configuracion.tsx` — casillas de capturas e interruptor de historial

**Files:**
- Modify: `src/Configuracion.tsx`

**Interfaces:**
- Consumes: `obtenerConfig`, `guardarConfig` (ya existentes en `src/api.ts`); `CategoriaCaptura` (Task 1).
- Produces: panel `PanelCapturas`, visible en Configuración.

No hay tests de componentes React en este repo (confirmado: no existe ningún `*.test.tsx`); la verificación de esta tarea es visual, en Task 12.

- [ ] **Step 1: `CONFIG_VACIA` y el import de tipos**

Añadir `CategoriaCaptura` al import de `../shared/tipos`. En `CONFIG_VACIA`, tras `presupuestoUsd: 2,`:

```ts
  capturas: ["validaciones"],
  historial: null,
```

- [ ] **Step 2: Recalcular la rejilla a tres filas**

Reemplazar:

```ts
const GAP = 1.5;
const COL_W = (100 - 2 * GAP) / 3;
const FILA_H = (100 - GAP) / 2;
const FILA_2_Y = FILA_H + GAP;
```

Por:

```ts
const GAP = 1.5;
const COL_W = (100 - 2 * GAP) / 3;
// Tres filas iguales (antes dos): la nueva fila 3 aloja "Capturas e informes" a todo el ancho, spec
// 2026-09-26. `3 * FILA_H + 2 * GAP = 100`.
const FILA_H = (100 - 2 * GAP) / 3;
const FILA_2_Y = FILA_H + GAP;
const FILA_3_Y = FILA_H * 2 + GAP * 2;
```

- [ ] **Step 3: Añadir `PanelCapturas`**

Justo antes de `export function Configuracion() {`:

```tsx
const CATEGORIAS_CAPTURA: { valor: CategoriaCaptura; etiqueta: string }[] = [
  { valor: "validaciones", etiqueta: "En cada validación" },
  { valor: "fallos", etiqueta: "Cuando falla un test" },
  { valor: "pasos", etiqueta: "En todos los pasos" },
];

/** Pieza 1 de la spec de capturas (2026-09-26): qué categorías adjunta `tests/soporte/agente-qa.ts`
 *  por defecto, y cuántas ejecuciones archivadas en `agente-qa-informes/` se conservan. Guardado
 *  inmediato al cambiar, mismo patrón que `PanelPuertas`/`PanelModelo` — sin botón "Guardar" propio. */
function PanelCapturas() {
  const [capturas, setCapturas] = useState<CategoriaCaptura[]>(["validaciones"]);
  const [historialIlimitado, setHistorialIlimitado] = useState(true);
  const [historialTexto, setHistorialTexto] = useState("10");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    obtenerConfig()
      .then((recibida) => {
        setCapturas(recibida.capturas ?? ["validaciones"]);
        setHistorialIlimitado(recibida.historial === null || recibida.historial === undefined);
        if (typeof recibida.historial === "number") setHistorialTexto(String(recibida.historial));
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setCargando(false));
  }, []);

  const guardar = (parcial: Partial<ConfigRaiz>) => {
    setError(null);
    setGuardando(true);
    guardarConfig(parcial)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setGuardando(false));
  };

  const alternar = (valor: CategoriaCaptura) => {
    const siguiente = capturas.includes(valor) ? capturas.filter((c) => c !== valor) : [...capturas, valor];
    setCapturas(siguiente);
    guardar({ capturas: siguiente });
  };

  const cambiarIlimitado = (ilimitado: boolean) => {
    setHistorialIlimitado(ilimitado);
    guardar({ historial: ilimitado ? null : Number(historialTexto) || 10 });
  };

  const guardarLimite = () => {
    const numero = Number(historialTexto);
    guardar({ historial: Number.isFinite(numero) && numero >= 1 ? Math.floor(numero) : 10 });
  };

  if (cargando) return <p className="text-xs text-text-dim">Cargando…</p>;

  return (
    <div className="flex flex-col gap-3 text-xs">
      <div className="flex flex-col gap-1.5">
        <span className="text-text-faint">Capturas de pantalla</span>
        {CATEGORIAS_CAPTURA.map((c) => (
          <label key={c.valor} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={capturas.includes(c.valor)}
              disabled={guardando}
              onChange={() => {
                alternar(c.valor);
              }}
            />
            <span className="text-text-bright">{c.etiqueta}</span>
          </label>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={historialIlimitado}
            disabled={guardando}
            onChange={(e) => {
              cambiarIlimitado(e.target.checked);
            }}
          />
          <span className="text-text-bright">Guardar todas las ejecuciones</span>
        </label>
        {!historialIlimitado && (
          <label className="flex items-center gap-2 pl-5">
            <span className="text-text-faint">Conservar las últimas</span>
            <input
              type="number"
              min={1}
              value={historialTexto}
              disabled={guardando}
              onChange={(e) => {
                setHistorialTexto(e.target.value);
              }}
              onBlur={guardarLimite}
              className="w-16 rounded-7 border border-border-soft bg-bg-sunken px-2 py-1 text-text-bright"
            />
            <span className="text-text-faint">ejecuciones</span>
          </label>
        )}
      </div>
      {error && <p className="text-danger">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Registrar el panel en la rejilla**

Dentro de `Configuracion()`, después del `</Panel>` que cierra `panelId="apariencia"` y antes del `</div>` que cierra `data-canvas`:

```tsx
        <Panel
          tabId="configuracion"
          panelId="capturas"
          titulo="📸 Capturas e informes"
          disposicionPorDefecto={{ x: 0, y: FILA_3_Y, w: 100, h: FILA_H, z: 1 }}
        >
          <PanelCapturas />
        </Panel>
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/Configuracion.tsx
git commit -m "feat: Configuración -> capturas de pantalla e historial de informes"
```

---

## Task 10: `src/Ejecutar.tsx` — casillas por ejecución, aviso "sin capturas" y enlace al informe

**Files:**
- Modify: `src/Ejecutar.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `obtenerConfig`, `ejecutarTests(ruta, capturas)`, `obtenerInformes` (Task 8); `pedirAlAgente` (ya existe en `src/ConsolaGlobal.tsx`).
- Produces: `Ejecutar` recibe una nueva prop `onVerInforme?: (id: string) => void`, provista por `App.tsx`.

- [ ] **Step 1: `src/App.tsx` — estado y wiring de "qué informe abrir en Reports"**

Añadir junto a `borradorConsola`:

```tsx
  // Qué ejecución archivada abrir en Reports al pulsar "Ver informe" desde Ejecutar — mismo patrón
  // que `borradorConsola`: viven aquí porque `<Ejecutar>` y `<Reports>` no se conocen entre sí.
  const [informeAAbrir, setInformeAAbrir] = useState<string | null>(null);
```

Añadir, junto a `interface WiringEmpezar`:

```tsx
interface WiringInformes {
  onVerInforme: (id: string) => void;
  informeAAbrir: string | null;
  onInformeAbierto: () => void;
}
```

Cambiar la firma de `contenidoPestana`:

```tsx
function contenidoPestana(pestana: Pestana, corrida: EstadoCorridaGlobal, wiringEmpezar: WiringEmpezar, wiringInformes: WiringInformes) {
```

Y dentro de su `switch`:

```tsx
    case "Ejecutar":
      return <Ejecutar {...corrida} onVerInforme={wiringInformes.onVerInforme} />;
    ...
    case "Reports":
      return <Reports informeAAbrir={wiringInformes.informeAAbrir} onInformeAbierto={wiringInformes.onInformeAbierto} />;
```

En el punto donde se llama `contenidoPestana(pestana, corridaGlobal, { escribirEnConsola: setBorradorConsola, descartarGuia })`, añadir el 4º argumento:

```tsx
              {contenidoPestana(
                pestana,
                corridaGlobal,
                { escribirEnConsola: setBorradorConsola, descartarGuia },
                {
                  onVerInforme: (id) => {
                    setInformeAAbrir(id);
                    ir("Reports");
                  },
                  informeAAbrir,
                  onInformeAbierto: () => {
                    setInformeAAbrir(null);
                  },
                },
              )}
```

- [ ] **Step 2: `src/Ejecutar.tsx` — imports y props**

Añadir a los imports:

```tsx
import { ejecutarTests, obtenerConfig, obtenerContenidoGenerado, obtenerInformes, obtenerTests, suscribirseEventosTests } from "./api";
import { pedirAlAgente } from "./ConsolaGlobal";
import type { CategoriaCaptura, FilaTest } from "../shared/tipos";
```

Cambiar la firma del componente:

```tsx
export function Ejecutar({ onVerInforme }: { onVerInforme?: (id: string) => void }) {
```

- [ ] **Step 3: Estado nuevo y carga de config**

Añadir junto a los `useState` existentes:

```tsx
  const [capturas, setCapturas] = useState<CategoriaCaptura[]>(["validaciones"]);
  const [ultimoInformeId, setUltimoInformeId] = useState<string | null>(null);
```

Añadir un `useEffect` (junto al de `cargarTests`):

```tsx
  useEffect(() => {
    obtenerConfig()
      .then((config) => {
        setCapturas(config.capturas ?? ["validaciones"]);
      })
      .catch(() => {
        // Sin config todavía: se queda en el defecto ["validaciones"] ya inicializado arriba.
      });
  }, []);
```

- [ ] **Step 4: Pasar `capturas` a `ejecutarTests` y refrescar el informe al terminar**

Reemplazar el cuerpo de `ejecutar`:

```tsx
  const ejecutar = (ruta?: string) => {
    setEjecutando(ruta ?? "");
    setError(null);
    setSalidaEjecucion(null);
    setLineasEnVivo([]);
    desuscribirseRef.current = suscribirseEventosTests((evento) => {
      if (evento.tipo === "linea") setLineasEnVivo((actual) => [...actual, evento.texto]);
    });
    ejecutarTests(ruta, capturas)
      .then((resultado) => {
        if (!resultado.ok) setSalidaEjecucion(resultado.salida);
        cargarTests();
        obtenerInformes()
          .then((informes) => {
            setUltimoInformeId(informes[0]?.id ?? null);
          })
          .catch(() => {
            // Sin informe archivado (p.ej. archivarUltimaEjecucion falló en el servidor, ya
            // registrado ahí): no hay enlace "Ver informe" para esta corrida, no es un error visible.
          });
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        desuscribirseRef.current?.();
        desuscribirseRef.current = null;
        setEjecutando(null);
      });
  };
```

- [ ] **Step 5: Casillas de capturas y enlace "Ver informe" en el panel de la lista**

En el panel `panelId="lista"`, justo después del botón "▶ Ejecutar todos" y antes del bloque `{(ejecutando !== null || lineasEnVivo.length > 0) && ...}`:

```tsx
            <div className="flex flex-wrap gap-2 text-2xs text-text-faint">
              {(["validaciones", "fallos", "pasos"] as const).map((valor) => (
                <label key={valor} className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={capturas.includes(valor)}
                    onChange={() => {
                      setCapturas((actual) => (actual.includes(valor) ? actual.filter((c) => c !== valor) : [...actual, valor]));
                    }}
                  />
                  {valor}
                </label>
              ))}
            </div>
            {ultimoInformeId && onVerInforme && (
              <button
                type="button"
                onClick={() => {
                  onVerInforme(ultimoInformeId);
                }}
                className="self-start rounded-7 border border-border-soft bg-bg-sunken px-2.5 py-1 text-2xs text-text-bright"
              >
                📊 Ver informe
              </button>
            )}
```

- [ ] **Step 6: Aviso "sin capturas" y botón "Añadir capturas" en el panel de detalle**

Dentro del panel `panelId="detalle"`, justo antes de `<p className="text-2xs uppercase tracking-[.05em] text-text-faint">{testSeleccionado.ficheroSpec}</p>`:

```tsx
              {codigoSpec !== null && !codigoSpec.includes("validar(") && (
                <div className="flex items-center justify-between gap-2 rounded-7 border border-border-soft bg-bg-sunken px-2.5 py-1.5 text-2xs text-text-faint">
                  <span>Este test no saca capturas.</span>
                  <button
                    type="button"
                    onClick={() => {
                      pedirAlAgente(
                        `Adapta ${rutaSpecDesdeFichero(testSeleccionado.ficheroSpec)} para que use \`paso\`/\`validar\` de \`tests/soporte/agente-qa.ts\` en vez de \`test.step\`/\`expect\` sueltos: cada \`Entonces\` debe terminar con \`validar(locator, esperado)\` sobre el elemento que comprueba, después de su \`expect\`. Sigue la puerta de confirmación habitual antes de guardar.`,
                      );
                    }}
                    className="shrink-0 rounded-7 border border-accent bg-accent px-2 py-1 font-bold text-on-accent"
                  >
                    + Añadir capturas
                  </button>
                </div>
              )}
```

- [ ] **Step 7: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: sin errores.

- [ ] **Step 8: Commit**

```bash
git add src/Ejecutar.tsx src/App.tsx
git commit -m "feat: Ejecutar -> casillas de capturas, aviso sin capturas, ver informe"
```

---

## Task 11: `src/Reports.tsx` — sección "Ejecuciones" con el informe embebido

**Files:**
- Modify: `src/Reports.tsx`

**Interfaces:**
- Consumes: `obtenerInformes` (Task 8); props `informeAAbrir`/`onInformeAbierto` provistas por `App.tsx` (Task 10).

- [ ] **Step 1: Imports y props**

Añadir a los imports:

```tsx
import { obtenerHistorial, obtenerInformes, obtenerTests, obtenerTestsRojos } from "./api";
import type { FilaTest, RegistroEjecucion, ResultadoTest, ResultadoTestRojo, ResumenInforme } from "../shared/tipos";
```

Cambiar la firma:

```tsx
export function Reports({ informeAAbrir, onInformeAbierto }: { informeAAbrir: string | null; onInformeAbierto: () => void }) {
```

- [ ] **Step 2: Recalcular la rejilla a tres filas**

Reemplazar:

```ts
const FILA_STATS_H = 36.5;
const FILA_INF_Y = FILA_STATS_H + GAP;
const FILA_INF_H = 100 - FILA_INF_Y;
```

Por:

```ts
// Tres filas (antes dos): la nueva fila "Ejecuciones" (informes visuales, spec 2026-09-26) necesita
// su propio espacio a todo el ancho, debajo de "Fallos agrupados"/"Historial".
const FILA_STATS_H = 27;
const FILA_INF_Y = FILA_STATS_H + GAP;
const FILA_INF_H = 45;
const FILA_EJEC_Y = FILA_INF_Y + FILA_INF_H + GAP;
const FILA_EJEC_H = 100 - FILA_EJEC_Y;
```

- [ ] **Step 3: `PanelEjecuciones`**

Añadir, antes de `export function Reports(...)`:

```tsx
/** Pieza 5 de la spec de capturas (2026-09-26): lista de ejecuciones archivadas
 *  (`agente-qa-informes/`, distinto del "Historial de ejecuciones" de arriba, que es
 *  `agente-qa.historial.json` con coste/turnos del agente) con su informe embebido en un iframe. */
function PanelEjecuciones({ informeAAbrir, onInformeAbierto }: { informeAAbrir: string | null; onInformeAbierto: () => void }) {
  const [informes, setInformes] = useState<ResumenInforme[] | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);

  useEffect(() => {
    obtenerInformes()
      .then(setInformes)
      .catch(() => {
        setInformes([]);
      });
  }, []);

  useEffect(() => {
    if (!informeAAbrir) return;
    setAbierto(informeAAbrir);
    onInformeAbierto();
  }, [informeAAbrir, onInformeAbierto]);

  return (
    <div className="flex h-full gap-2">
      <div className="flex w-64 shrink-0 flex-col gap-1 overflow-auto">
        {!informes ? (
          <p className="p-2 text-xs text-text-dim">Cargando…</p>
        ) : informes.length === 0 ? (
          <p className="p-2 text-xs text-text-dim">Sin ejecuciones archivadas todavía.</p>
        ) : (
          informes.map((informe) => (
            <button
              key={informe.id}
              type="button"
              onClick={() => {
                setAbierto(informe.id);
              }}
              className={`flex flex-col gap-0.5 rounded-7 border px-2.5 py-1.5 text-left text-2xs ${
                abierto === informe.id ? "border-accent bg-accent-bg" : "border-border-soft bg-bg-sunken"
              }`}
            >
              <span className="text-text-bright">{new Date(informe.fecha).toLocaleString()}</span>
              <span className="text-text-faint">
                <span className="text-ok">{informe.verdes} verdes</span> · <span className="text-danger">{informe.rojos} rojos</span> ·{" "}
                {(informe.duracionMs / 1000).toFixed(1)}s
              </span>
            </button>
          ))
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        {!abierto ? (
          <p className="p-2 text-xs text-text-dim">Selecciona una ejecución.</p>
        ) : (
          <>
            <div className="flex gap-2">
              <a
                href={`/informes/${abierto}/playwright/index.html`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-6 border border-border-soft bg-bg-sunken px-2 py-1 text-2xs text-text-bright"
              >
                Abrir informe de Playwright
              </a>
              <a
                href={`/informes/${abierto}/informe.html`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-6 border border-border-soft bg-bg-sunken px-2 py-1 text-2xs text-text-bright"
              >
                Abrir HTML suelto
              </a>
            </div>
            <iframe title="Informe de la ejecución" src={`/informes/${abierto}/informe.html`} className="flex-1 rounded-7 border border-border-soft bg-white" />
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Registrar el panel**

Después del `</Panel>` que cierra `panelId="hist"`:

```tsx
        <Panel
          tabId="reports"
          panelId="ejecuciones"
          titulo="Ejecuciones"
          disposicionPorDefecto={{ x: 0, y: FILA_EJEC_Y, w: 100, h: FILA_EJEC_H, z: 1 }}
        >
          <PanelEjecuciones informeAAbrir={informeAAbrir} onInformeAbierto={onInformeAbierto} />
        </Panel>
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/Reports.tsx
git commit -m "feat: Reports -> sección Ejecuciones con el informe visual embebido"
```

---

## Task 12: Verificación agrupada y prueba en vivo contra `pruebas/sauce`

**Files:** ninguno nuevo — solo comandos y uso manual.

- [ ] **Step 1: Suite completa**

Run: `npm run typecheck && npm run lint && npx vitest run`
Expected: todo en verde — incluye los tests de las Tasks 1, 2, 4, 5, 6, 7.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: sin errores (incluye `scripts/comprobar-estilos.mjs`, que falla si el CSS nuevo de `Ejecutar.tsx`/`Configuracion.tsx`/`Reports.tsx` usa alguna clase de Tailwind no definida en `tailwind.config.ts` — si falla por eso, añadir el token que falte en vez de cambiar la clase).

- [ ] **Step 3: `agente-qa instalar` sobre `pruebas/sauce`**

Run: `node bin/agente-qa.mjs instalar --project pruebas/sauce` (o el subcomando equivalente que ya use ese flujo — revisar `PROXIMOS-PASOS.md`/`ESTADO.md` del "Hallazgo operacional" de skills desincronizadas: hay que reinstalar tras tocar `SKILL.md`, ver Task 3).
Expected: `pruebas/sauce/.claude/skills/qa/` queda actualizada con la §3/§4/§5 nuevas.

- [ ] **Step 4: Arrancar la web sobre `pruebas/sauce`**

Run: `npm run dev` (desde la raíz del repo, apuntando a `pruebas/sauce` según el mecanismo de proyecto activo ya usado en el resto de `ESTADO.md`).

- [ ] **Step 5: Adaptar un spec existente con "Añadir capturas"**

En la pestaña Ejecutar, seleccionar un `.spec.ts` de `pruebas/sauce` (p.ej. `anadir-al-carrito.spec.ts`), confirmar que aparece el aviso "Este test no saca capturas", pulsar "+ Añadir capturas", confirmar en la consola global cuando el agente pida la puerta de confirmación del spec, y comprobar que el fichero resultante importa `paso`/`validar` de `../soporte/agente-qa` y que `tests/soporte/agente-qa.ts` se creó copiado de la plantilla.

- [ ] **Step 6: Ejecutarlo desde Ejecutar**

Pulsar ▶ sobre ese spec con las tres casillas de capturas marcadas por defecto (`validaciones`). Comprobar: el test sigue en verde, aparece el enlace "📊 Ver informe" al terminar.

- [ ] **Step 7: Ver el informe en Reports**

Pulsar "Ver informe": la pestaña cambia a Reports con esa ejecución ya abierta en el iframe. Comprobar que las capturas recuadradas de cada `Entonces` se ven con su pie, y que expandir el test muestra sus pasos.

- [ ] **Step 8: Abrir el HTML suelto y el informe de Playwright**

Pulsar "Abrir HTML suelto" (nueva pestaña con `informe.html` fuera del iframe) y "Abrir informe de Playwright" (el `playwright-report/index.html` original). Los dos deben abrir y mostrar contenido real, no un 404.

- [ ] **Step 9: Repetir con `fallos` + `validaciones` y un test roto a propósito**

Marcar también la casilla "Cuando falla un test", romper a propósito una aserción de un spec (p.ej. cambiar el texto esperado), ejecutarlo, y comprobar en el informe que el test rojo muestra su mensaje de error y la captura `agente-qa:fallo`.

- [ ] **Step 10: Actualizar `ESTADO.md`/`PROXIMOS-PASOS.md`/`README.md`**

Según la regla del `CLAUDE.md` del repo: `ESTADO.md` gana la fila de "Qué funciona hoy" para esta pieza (con la tabla fichero→qué hace, siguiendo el estilo ya usado); `PROXIMOS-PASOS.md` tacha el ítem "Por hablar... reportes visibles y capturas configurables" y lo mueve a "Cerradas 2026-09-26"; `README.md` documenta las tres casillas de capturas y cómo abrir un informe, si cambia algún paso que el usuario siga para probar la app.
