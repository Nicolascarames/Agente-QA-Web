# Puertas de confirmación con botones — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> Nota de este repo (`CLAUDE.md`): los agentes atados del proyecto son `brain-implementer` (sonnet,
> brief cerrado), `brain-reviewer` (sonnet, review por tarea) y `brain-final-reviewer` (opus, review
> final de rama) — úsalos como el subagente por tarea de `subagent-driven-development` en vez de un
> agente genérico, y aplica el resto de reglas de `CLAUDE.md` (verificación agrupada, máximo 2
> despachos a opus, una re-review como máximo).

**Goal:** Cuando el agente genera un fichero que necesita tu aprobación, la pestaña correspondiente
se abre sola con el fichero delante y la pregunta llega con botones — nunca como texto suelto que
hay que responder a ciegas. Cuántas veces se para lo eliges en Configuración.

**Architecture:** Cuatro piezas independientes que se enganchan en la misma cadena existente
(system prompt → `canUseTool`/`AskUserQuestion` → evento SSE → consola). La skill deja de aceptar
prosa como confirmación; `ConfigRaiz` gana un campo `puertas` que se traduce a texto y se inyecta en
el `system prompt`; la consola recuerda el último fichero escrito y salta de pestaña cuando llega la
pregunta; y el evento de sistema del SDK dice si la sesión es nueva o reanudada.

**Tech Stack:** TypeScript, Fastify, React 19 + Vite, `@anthropic-ai/claude-agent-sdk`, Vitest.

**Spec:** [`docs/superpowers/specs/2026-09-14-puertas-de-confirmacion-con-botones.md`](../specs/2026-09-14-puertas-de-confirmacion-con-botones.md)

## Global Constraints

- Todo identificador de código en inglés está prohibido salvo lo que ya usa el repo (nombres de
  librerías); el resto del código e identificadores van en castellano, como el resto del proyecto.
- El campo `puertas` de `ConfigRaiz` es **obligatorio, no opcional** — mismo patrón que
  `entorno`/`barrera`/`listaBlanca`: el default se aplica al leer (`leerConfigRaiz`), no con `?`.
- Ningún evento nuevo en el protocolo SSE: todo lo que necesita el frontend ya viaja en el `input`
  de los `tool_use` o se añade como campo dentro de un tipo de evento que ya existe (`agente.system`).
- `Write`/`Edit` **no** salen de `allowedTools` y `canUseTool` no bloquea ninguna escritura — la
  puerta la impone la skill, nunca el código (decisión cerrada en la spec).
- Cada tarea que toca un fichero con tests existentes debe dejar `npx vitest run <fichero>` en verde
  antes de pasar a la siguiente.

---

### Task 1: `PoliticaPuertas` — el tipo y su default en todos los sitios que construyen `ConfigRaiz`

**Files:**
- Modify: `shared/tipos.ts`
- Modify: `server/proyecto.ts`
- Test: `server/proyecto.test.ts`
- Modify: `server/app.ts` (solo la constante `CONFIG_RAIZ_POR_DEFECTO`)
- Modify: `server/asistente.ts` (solo el literal de `ejecutarRamaA`)
- Modify: `server/asistente.test.ts` (solo el mock de `leerConfigRaiz`)
- Modify: `src/Configuracion.tsx` (solo la constante `CONFIG_VACIA`)

**Interfaces:**
- Produces: `export type PoliticaPuertas = "escenario" | "escenario-y-codigo" | "por-artefacto" | "por-fichero";` en `shared/tipos.ts` — la usan las Tasks 2, 3 y 4.
- Produces: `ConfigRaiz.puertas: PoliticaPuertas` (campo obligatorio) — lo lee la Task 3, lo edita la Task 4.

`ConfigRaiz` es hoy (no tocar nada más de este bloque):

```ts
export interface ConfigRaiz {
  schemaVersion: 1;
  appUrl: string;
  entorno: string;
  barrera: boolean;
  listaBlanca: string[];
}
```

- [ ] **Step 1: Añadir el tipo y el campo en `shared/tipos.ts`**

Justo antes de `export interface ConfigRaiz {`:

```ts
/** Cuántas veces para el agente a pedir confirmación con `AskUserQuestion` en un ciclo completo
 *  (Pieza 2 de docs/superpowers/specs/2026-09-14-puertas-de-confirmacion-con-botones.md). El
 *  default es "escenario": la mínima interrupción — una sola parada tras el `.feature`, y el resto
 *  del ciclo sigue solo hasta el test en verde. */
export type PoliticaPuertas = "escenario" | "escenario-y-codigo" | "por-artefacto" | "por-fichero";

```

Y en la interfaz misma, añadir el campo al final:

```ts
export interface ConfigRaiz {
  schemaVersion: 1;
  appUrl: string;
  entorno: string;
  barrera: boolean;
  listaBlanca: string[];
  puertas: PoliticaPuertas;
}
```

- [ ] **Step 2: Escribir el test de validación en `server/proyecto.test.ts` (falla primero)**

El fichero ya tiene un `describe("leerConfigRaiz / escribirConfigRaiz", ...)` con, en este orden,
los tests `"devuelve null si..."` (x3), `"escribe y relee la config raíz"` (líneas 57-72 hoy) y
`"rellena entorno/barrera/listaBlanca con sus defaults si faltan en el JSON leído"` (líneas 74-83
hoy, el último del bloque). Sustituir ESOS DOS ÚLTIMOS tests (los tres `"devuelve null..."` de
arriba no cambian) por estos tres — los dos primeros son versiones con `puertas` de los que había,
el tercero es nuevo:

```ts
  it("escribe y relee la config raíz", async () => {
    await escribirConfigRaiz(proyecto, {
      schemaVersion: 1,
      appUrl: "http://localhost:3000",
      entorno: "produccion",
      barrera: true,
      listaBlanca: ["http://localhost:3000"],
      puertas: "por-artefacto",
    });
    expect(await leerConfigRaiz(proyecto)).toEqual({
      schemaVersion: 1,
      appUrl: "http://localhost:3000",
      entorno: "produccion",
      barrera: true,
      listaBlanca: ["http://localhost:3000"],
      puertas: "por-artefacto",
    });
  });

  it("rellena entorno/barrera/listaBlanca/puertas con sus defaults si faltan en el JSON leído", async () => {
    await writeFile(configRaizPath(proyecto), JSON.stringify({ schemaVersion: 1, appUrl: "http://localhost:3000" }), "utf8");
    expect(await leerConfigRaiz(proyecto)).toEqual({
      schemaVersion: 1,
      appUrl: "http://localhost:3000",
      entorno: "pruebas",
      barrera: false,
      listaBlanca: [],
      puertas: "escenario",
    });
  });

  it("descarta un valor de puertas que no es ninguna política válida y usa el default", async () => {
    await writeFile(
      configRaizPath(proyecto),
      JSON.stringify({ schemaVersion: 1, appUrl: "http://localhost:3000", puertas: "cada-hora" }),
      "utf8"
    );
    const config = await leerConfigRaiz(proyecto);
    expect(config?.puertas).toBe("escenario");
  });
```

- [ ] **Step 3: Ejecutar los tests y comprobar que fallan por el campo que falta**

Run: `npx vitest run server/proyecto.test.ts`
Expected: FAIL — `puertas` no existe en el objeto que devuelve `leerConfigRaiz` todavía, o TypeScript
se queja de que falta en el literal.

- [ ] **Step 4: Validar y aplicar el default en `server/proyecto.ts`**

Cambiar el import de tipos, de:

```ts
import type { ConfigCredenciales, ConfigRaiz } from "../shared/tipos.js";
```

a:

```ts
import type { ConfigCredenciales, ConfigRaiz, PoliticaPuertas } from "../shared/tipos.js";
```

Añadir, antes de `export async function leerConfigRaiz`:

```ts
const POLITICAS_PUERTAS_VALIDAS: readonly PoliticaPuertas[] = ["escenario", "escenario-y-codigo", "por-artefacto", "por-fichero"];

function politicaPuertasValida(valor: unknown): PoliticaPuertas {
  return (POLITICAS_PUERTAS_VALIDAS as readonly unknown[]).includes(valor) ? (valor as PoliticaPuertas) : "escenario";
}
```

Y en el `return` de `leerConfigRaiz` (hoy termina en `listaBlanca: ...`), añadir una línea:

```ts
  return {
    schemaVersion: 1,
    appUrl: candidato.appUrl,
    entorno: typeof candidato.entorno === "string" ? candidato.entorno : "pruebas",
    barrera: typeof candidato.barrera === "boolean" ? candidato.barrera : false,
    listaBlanca: Array.isArray(candidato.listaBlanca) ? (candidato.listaBlanca as string[]) : [],
    puertas: politicaPuertasValida(candidato.puertas),
  };
```

- [ ] **Step 5: Ejecutar los tests otra vez**

Run: `npx vitest run server/proyecto.test.ts`
Expected: PASS

- [ ] **Step 6: Arreglar los otros cuatro sitios que construyen un `ConfigRaiz` literal, para que el repo vuelva a compilar**

En `server/app.ts`, la constante:

```ts
const CONFIG_RAIZ_POR_DEFECTO: ConfigRaiz = { schemaVersion: 1, appUrl: "", entorno: "pruebas", barrera: false, listaBlanca: [] };
```

pasa a:

```ts
const CONFIG_RAIZ_POR_DEFECTO: ConfigRaiz = { schemaVersion: 1, appUrl: "", entorno: "pruebas", barrera: false, listaBlanca: [], puertas: "escenario" };
```

En `server/asistente.ts`, dentro de `ejecutarRamaA`, la línea:

```ts
    config = { schemaVersion: 1, appUrl, entorno: esReal ? "real" : "pruebas", barrera: esReal, listaBlanca };
```

pasa a:

```ts
    config = { schemaVersion: 1, appUrl, entorno: esReal ? "real" : "pruebas", barrera: esReal, listaBlanca, puertas: "escenario" };
```

En `server/asistente.test.ts`, el mock:

```ts
      leerConfigRaiz: () => Promise.resolve({ schemaVersion: 1, appUrl: "https://ejemplo.test", entorno: "pruebas", barrera: false, listaBlanca: [] }),
```

pasa a:

```ts
      leerConfigRaiz: () => Promise.resolve({ schemaVersion: 1, appUrl: "https://ejemplo.test", entorno: "pruebas", barrera: false, listaBlanca: [], puertas: "escenario" }),
```

En `src/Configuracion.tsx`, la constante:

```ts
const CONFIG_VACIA: ConfigRaiz = { schemaVersion: 1, appUrl: "", entorno: "pruebas", barrera: false, listaBlanca: [] };
```

pasa a:

```ts
const CONFIG_VACIA: ConfigRaiz = { schemaVersion: 1, appUrl: "", entorno: "pruebas", barrera: false, listaBlanca: [], puertas: "escenario" };
```

- [ ] **Step 7: Verificación completa de la tarea**

Run: `npm run typecheck && npx vitest run server/proyecto.test.ts server/asistente.test.ts`
Expected: los dos comandos en verde.

- [ ] **Step 8: Commit**

```bash
git add shared/tipos.ts server/proyecto.ts server/proyecto.test.ts server/app.ts server/asistente.ts server/asistente.test.ts src/Configuracion.tsx
git commit -m "feat: añade PoliticaPuertas y el campo puertas a ConfigRaiz, con default 'escenario'"
```

---

### Task 2: `server/puertas.ts` — el texto de cada política, puro y testeado

**Files:**
- Create: `server/puertas.ts`
- Test: `server/puertas.test.ts`

**Interfaces:**
- Consumes: `PoliticaPuertas` de `shared/tipos.ts` (Task 1).
- Produces: `export function textoPoliticaPuertas(puertas: PoliticaPuertas): string` — lo usa la Task 3 (`server/agente.ts`).

- [ ] **Step 1: Escribir el test (falla porque el módulo no existe)**

Crear `server/puertas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { textoPoliticaPuertas } from "./puertas.js";

describe("textoPoliticaPuertas", () => {
  it("la política por defecto (escenario) dice que para una sola vez y que el resto sigue solo", () => {
    const texto = textoPoliticaPuertas("escenario");
    expect(texto).toContain("PARA UNA SOLA VEZ");
    expect(texto).toContain("AskUserQuestion");
    expect(texto).toContain("sigue solo");
  });

  it("escenario-y-codigo dice que para dos veces: feature y código", () => {
    const texto = textoPoliticaPuertas("escenario-y-codigo");
    expect(texto).toContain("DOS VECES");
    expect(texto).toContain(".feature");
    expect(texto).toContain(".spec.ts");
  });

  it("por-artefacto dice que para tres veces", () => {
    expect(textoPoliticaPuertas("por-artefacto")).toContain("TRES VECES");
  });

  it("por-fichero dice que para en cada fichero, incluidas las correcciones", () => {
    const texto = textoPoliticaPuertas("por-fichero");
    expect(texto).toContain("CADA fichero");
    expect(texto).toContain("correcciones");
  });

  it("las cuatro políticas producen un texto distinto entre sí", () => {
    const politicas = ["escenario", "escenario-y-codigo", "por-artefacto", "por-fichero"] as const;
    const textos = politicas.map((p) => textoPoliticaPuertas(p));
    expect(new Set(textos).size).toBe(politicas.length);
  });
});
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx vitest run server/puertas.test.ts`
Expected: FAIL — `Cannot find module './puertas.js'`

- [ ] **Step 3: Crear `server/puertas.ts`**

```ts
// Pieza 2 de docs/superpowers/specs/2026-09-14-puertas-de-confirmacion-con-botones.md: el bloque
// que se añade al system prompt del agente (server/agente.ts) para que sepa cuántas veces debe
// parar a pedir confirmación con AskUserQuestion antes de seguir. Puro y testeable, mismo patrón
// que server/barrera.ts.
import type { PoliticaPuertas } from "../shared/tipos.js";

const TEXTOS: Record<PoliticaPuertas, string> = {
  escenario:
    "Política de confirmación: PARA UNA SOLA VEZ en todo el ciclo, tras escribir el `.feature` en " +
    "tests/features/, preguntando con AskUserQuestion. En cuanto confirmen, sigue solo — page " +
    "objects, spec y ejecución hasta el test en verde — sin volver a preguntar.",
  "escenario-y-codigo":
    "Política de confirmación: PARA DOS VECES, las dos con AskUserQuestion — (1) tras el `.feature`; " +
    "(2) tras escribir los `.page.ts` y el `.spec.ts` juntos, antes de ejecutar Playwright. Entre una " +
    "parada y la siguiente no preguntes nada más.",
  "por-artefacto":
    "Política de confirmación: PARA TRES VECES, las tres con AskUserQuestion — (1) tras el `.feature`; " +
    "(2) tras los `.page.ts`; (3) tras el `.spec.ts`, antes de ejecutarlo.",
  "por-fichero":
    "Política de confirmación: PARA en CADA fichero que escribas o modifiques bajo tests/ — incluidas " +
    "las correcciones de un test en rojo —, con AskUserQuestion, antes de seguir con el siguiente.",
};

/** Bloque que `server/agente.ts` concatena al `system prompt`, junto a `ROL_QA` y las credenciales,
 *  para que el agente sepa cuántas paradas exige la sesión activa. */
export function textoPoliticaPuertas(puertas: PoliticaPuertas): string {
  return `\n\n${TEXTOS[puertas]}`;
}
```

- [ ] **Step 4: Ejecutar y comprobar que pasa**

Run: `npx vitest run server/puertas.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/puertas.ts server/puertas.test.ts
git commit -m "feat: textoPoliticaPuertas — el texto de cada política de confirmación para el system prompt"
```

---

### Task 3: Conectar la política de puertas al agente (`server/agente.ts`) y a la ruta que lo lanza (`server/app.ts`)

**Files:**
- Modify: `server/agente.ts`
- Test: `server/agente.test.ts`
- Modify: `server/app.ts`
- Test: `server/app.test.ts`

**Interfaces:**
- Consumes: `textoPoliticaPuertas` de `server/puertas.ts` (Task 2); `PoliticaPuertas` de `shared/tipos.ts` (Task 1).
- Produces: `OpcionesLanzar.puertas?: PoliticaPuertas` — nadie más lo consume todavía (Task 9 lo deja intacto).

- [ ] **Step 1: Escribir los dos tests en `server/agente.test.ts` (fallan primero)**

Añadir dentro del `describe("lanzar", ...)` existente, dos tests nuevos (usan `query` y `generadorDe`
ya importados en el fichero):

```ts
  it("añade el texto de la política de puertas al system prompt, por defecto 'escenario'", async () => {
    let systemPromptCapturado: string | undefined;
    const queryFn: typeof query = (params) => {
      systemPromptCapturado = (params.options?.systemPrompt as { append?: string } | undefined)?.append;
      const mensajeResultado = { type: "result", subtype: "success", is_error: false, queued_turn_count: 0 } as unknown as SDKMessage;
      return Object.assign(generadorDe([mensajeResultado]), { interrupt: () => Promise.resolve(undefined) }) as unknown as Query;
    };
    const sesion = lanzar("algo", { cwd: "/tmp", queryFn });
    for await (const _evento of sesion.suscribirse()) {
      // drenar hasta el cierre
    }
    expect(systemPromptCapturado).toContain("PARA UNA SOLA VEZ");
  });

  it("usa el texto de la política indicada en opciones.puertas", async () => {
    let systemPromptCapturado: string | undefined;
    const queryFn: typeof query = (params) => {
      systemPromptCapturado = (params.options?.systemPrompt as { append?: string } | undefined)?.append;
      const mensajeResultado = { type: "result", subtype: "success", is_error: false, queued_turn_count: 0 } as unknown as SDKMessage;
      return Object.assign(generadorDe([mensajeResultado]), { interrupt: () => Promise.resolve(undefined) }) as unknown as Query;
    };
    const sesion = lanzar("algo", { cwd: "/tmp", queryFn, puertas: "por-fichero" });
    for await (const _evento of sesion.suscribirse()) {
      // drenar hasta el cierre
    }
    expect(systemPromptCapturado).toContain("CADA fichero");
  });
```

- [ ] **Step 2: Ejecutar y comprobar que fallan**

Run: `npx vitest run server/agente.test.ts`
Expected: FAIL — TypeScript se queja de que `puertas` no existe en `OpcionesLanzar`, o el texto
esperado no aparece en el system prompt.

- [ ] **Step 3: Modificar `server/agente.ts`**

Añadir el import, junto a los que ya hay:

```ts
import { redactarSecretosProfundo, verificarLlamada } from "./barrera.js";
import { textoPoliticaPuertas } from "./puertas.js";
import { leerReporte } from "./reporter.js";
import { registrarEjecucion } from "./costes.js";
import { crearCola, crearDifusor } from "./difusor.js";
import type { PoliticaPuertas } from "../shared/tipos.js";
```

En `OpcionesLanzar`, añadir el campo después de `listaBlanca?: string[];`:

```ts
  listaBlanca?: string[];
  /** Pieza 2 de la spec de puertas de confirmación: cuántas veces para el agente a pedir
   *  confirmación con AskUserQuestion antes de seguir. Sin indicar, se comporta como "escenario"
   *  (una sola parada, tras el escenario). */
  puertas?: PoliticaPuertas;
```

Dentro de `lanzar()`, justo antes de `const appendCredenciales = ...`, añadir:

```ts
  const appendPuertas = textoPoliticaPuertas(opciones.puertas ?? "escenario");
```

Y cambiar la línea del `systemPrompt`, de:

```ts
      systemPrompt: { type: "preset", preset: "claude_code", append: ROL_QA + appendCredenciales },
```

a:

```ts
      systemPrompt: { type: "preset", preset: "claude_code", append: ROL_QA + appendPuertas + appendCredenciales },
```

- [ ] **Step 4: Ejecutar y comprobar que pasan**

Run: `npx vitest run server/agente.test.ts`
Expected: PASS

- [ ] **Step 5: Escribir/actualizar los tests de `server/app.test.ts` (fallan primero)**

El test existente `"POST /api/comando sin sesión activa lanza una nueva y devuelve su runId"`
(líneas 82-98 hoy) hace un `toHaveBeenCalledWith` con el objeto EXACTO de opciones — al añadir
`puertas` a lo que pasa la ruta, ese test empieza a fallar si no se actualiza. Sustituirlo por:

```ts
  it("POST /api/comando sin sesión activa lanza una nueva y devuelve su runId", async () => {
    const { sesion } = crearSesionFalsa();
    const lanzarFn = vi.fn(() => sesion);
    const app = buildApp({ proyectoInicial: proyecto, lanzarFn });
    const respuesta = await app.inject({ method: "POST", url: "/api/comando", payload: { texto: "hazme el page object del login" } });
    expect(respuesta.statusCode).toBe(200);
    expect(lanzarFn).toHaveBeenCalledWith("hazme el page object del login", {
      cwd: proyecto,
      entorno: undefined,
      barreraActiva: undefined,
      listaBlanca: undefined,
      resume: undefined,
      credenciales: [],
      puertas: undefined,
    });
    expect(respuesta.json<RespuestaComando>().runId).toBeTruthy();
    await app.close();
  });
```

Y añadir, en el mismo `describe`, un test nuevo que sí tiene config guardada. Añadir `escribirConfigRaiz`
al import de `./proyecto.js` al principio del fichero (import nuevo, el fichero no lo tenía):

```ts
import { escribirConfigRaiz } from "./proyecto.js";
```

```ts
  it("pasa la política de puertas guardada en la config raíz a lanzarFn", async () => {
    await escribirConfigRaiz(proyecto, {
      schemaVersion: 1,
      appUrl: "https://ejemplo.test",
      entorno: "pruebas",
      barrera: false,
      listaBlanca: [],
      puertas: "por-fichero",
    });
    const { sesion } = crearSesionFalsa();
    const lanzarFn = vi.fn(() => sesion);
    const app = buildApp({ proyectoInicial: proyecto, lanzarFn });
    await app.inject({ method: "POST", url: "/api/comando", payload: { texto: "hazlo" } });
    expect(lanzarFn).toHaveBeenCalledWith("hazlo", expect.objectContaining({ puertas: "por-fichero" }));
    await app.close();
  });
```

- [ ] **Step 6: Ejecutar y comprobar que fallan**

Run: `npx vitest run server/app.test.ts`
Expected: FAIL — la ruta todavía no pasa `puertas` a `lanzarFn`.

- [ ] **Step 7: Modificar `server/app.ts`**

En el handler de `POST /api/comando`, donde se construye `corridaActiva`:

```ts
    corridaActiva = {
      sesion: lanzarFn(texto, {
        cwd: proyectoActivo,
        entorno: config?.entorno,
        barreraActiva: config?.barrera,
        listaBlanca: config?.listaBlanca,
        resume: ultimaSesionId ?? undefined,
        credenciales: credenciales.variables,
      }),
      runId,
    };
```

pasa a:

```ts
    corridaActiva = {
      sesion: lanzarFn(texto, {
        cwd: proyectoActivo,
        entorno: config?.entorno,
        barreraActiva: config?.barrera,
        listaBlanca: config?.listaBlanca,
        resume: ultimaSesionId ?? undefined,
        credenciales: credenciales.variables,
        puertas: config?.puertas,
      }),
      runId,
    };
```

- [ ] **Step 8: Ejecutar y comprobar que pasan**

Run: `npx vitest run server/app.test.ts`
Expected: PASS

- [ ] **Step 9: Verificación completa de la tarea**

Run: `npm run typecheck && npx vitest run server/agente.test.ts server/app.test.ts`
Expected: los dos en verde.

- [ ] **Step 10: Commit**

```bash
git add server/agente.ts server/agente.test.ts server/app.ts server/app.test.ts
git commit -m "feat: la política de puertas viaja de Configuración al system prompt del agente"
```

---

### Task 4: Selector de política de puertas en Configuración

**Files:**
- Modify: `src/Configuracion.tsx`

**Interfaces:**
- Consumes: `PoliticaPuertas` de `shared/tipos.ts` (Task 1); `obtenerConfig`/`guardarConfig` de `src/api.ts` (ya existen, sin cambios — `guardarConfig` acepta `Partial<ConfigRaiz>`).

No hay test unitario para este fichero (no existe `Configuracion.test.tsx`, y el repo no monta
componentes React en test — solo funciones puras; confirmado por el propio `ConsolaGlobal.test.ts`).
La verificación es `typecheck`/`lint`/`build` más el ciclo real de la Task 10.

- [ ] **Step 1: Ampliar el import de tipos**

En `src/Configuracion.tsx`, cambiar:

```ts
import type { ConfigRaiz, CredencialVariable, ResultadoComprobacion } from "../shared/tipos";
```

a:

```ts
import type { ConfigRaiz, CredencialVariable, PoliticaPuertas, ResultadoComprobacion } from "../shared/tipos";
```

- [ ] **Step 2: Añadir el componente `PanelPuertas`**

Justo antes de `/** Las cuatro comprobaciones de \`npx agente-qa doctor\` ... */` (el comentario que
precede a `function PanelDiagnostico()`), insertar:

```tsx
const POLITICAS_PUERTAS: { valor: PoliticaPuertas; etiqueta: string; ayuda: string }[] = [
  {
    valor: "escenario",
    etiqueta: "Una vez, tras el escenario (recomendado)",
    ayuda: "Confirmas el Gherkin y el resto del ciclo — page objects, spec y ejecución — sigue solo hasta el test en verde.",
  },
  {
    valor: "escenario-y-codigo",
    etiqueta: "Dos veces: escenario y código",
    ayuda: "Además del Gherkin, confirmas tras los page objects y el spec juntos, antes de ejecutar.",
  },
  {
    valor: "por-artefacto",
    etiqueta: "Tres veces: cada artefacto por separado",
    ayuda: "Escenario, page objects y spec, cada uno con su propia parada.",
  },
  {
    valor: "por-fichero",
    etiqueta: "En cada fichero",
    ayuda: "Cualquier fichero que el agente escriba o modifique bajo tests/, incluidas las correcciones de un test en rojo.",
  },
];

/** Pieza 2 de la spec de puertas de confirmación: cuántas veces para el agente a pedir tu OK antes
 *  de seguir. Cada parada reanuda la sesión y el agente relee el contexto — eso se paga en tokens,
 *  por eso el párrafo de coste está siempre visible, no solo al pasar el ratón. */
function PanelPuertas() {
  const [puertas, setPuertas] = useState<PoliticaPuertas>("escenario");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    obtenerConfig()
      .then((recibida) => {
        setPuertas(recibida.puertas);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setCargando(false));
  }, []);

  const elegir = (valor: PoliticaPuertas) => {
    setError(null);
    setGuardando(true);
    guardarConfig({ puertas: valor })
      .then((guardada) => {
        setPuertas(guardada.puertas);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setGuardando(false));
  };

  if (cargando) return <p className="text-xs text-text-dim">Cargando…</p>;

  return (
    <div className="flex flex-col gap-3 text-xs">
      <p className="text-text-faint">
        Cada parada reanuda la sesión: el agente relee el contexto, y eso se paga en tokens. La opción marcada por
        defecto es la que menos interrumpe.
      </p>
      <div className="flex flex-col gap-1.5">
        {POLITICAS_PUERTAS.map((p) => (
          <label
            key={p.valor}
            className={`flex flex-col gap-0.5 rounded-7 border px-2.5 py-1.5 ${
              puertas === p.valor ? "border-accent bg-accent-bg" : "border-border-soft bg-bg-sunken"
            }`}
          >
            <span className="flex items-center gap-2 text-text-bright">
              <input
                type="radio"
                name="puertas"
                checked={puertas === p.valor}
                disabled={guardando}
                onChange={() => {
                  elegir(p.valor);
                }}
              />
              {p.etiqueta}
            </span>
            <span className="pl-5 text-2xs text-text-faint">{p.ayuda}</span>
          </label>
        ))}
      </div>
      {error && <p className="text-danger">{error}</p>}
    </div>
  );
}

```

- [ ] **Step 3: Cambiar el layout de tres a cuatro paneles**

En `Configuracion()`, cambiar el cálculo de ancho, de:

```ts
const GAP = 1.5;
const ANCHO_PANEL = (100 - GAP * 2) / 3;
```

a:

```ts
const GAP = 1.5;
const ANCHO_PANEL = (100 - GAP * 3) / 4;
```

(Esta constante está definida a nivel de módulo, antes de `PanelProyecto`, no dentro de
`Configuracion()` — no moverla de sitio, solo cambiar la fórmula.)

- [ ] **Step 4: Añadir el cuarto `<Panel>`**

En `export function Configuracion()`, después del `<Panel titulo="🩺 Diagnóstico (doctor)">` y antes
del `</div>` de cierre, añadir:

```tsx
        <Panel
          tabId="configuracion"
          panelId="puertas"
          titulo="🚪 Puertas de confirmación"
          disposicionPorDefecto={{ x: (ANCHO_PANEL + GAP) * 3, y: 0, w: ANCHO_PANEL, h: 100, z: 1 }}
        >
          <PanelPuertas />
        </Panel>
```

- [ ] **Step 5: Verificar que compila**

Run: `npm run typecheck && npm run lint`
Expected: los dos en verde.

- [ ] **Step 6: Commit**

```bash
git add src/Configuracion.tsx
git commit -m "feat: selector de política de puertas en Configuración, con el coste explicado"
```

---

### Task 5: La skill exige `AskUserQuestion` en cada puerta, nunca prosa

**Files:**
- Modify: `skill/skills/qa/SKILL.md`

Sin test (fichero de instrucciones en prosa, no código). Verificado por la Task 10 (ciclo real).

- [ ] **Step 1: Sustituir la sección "## 3. Las tres puertas"**

El texto de hoy (líneas 31-45 de `skill/skills/qa/SKILL.md`) es exactamente:

```markdown
## 3. Las tres puertas

El trabajo avanza en tres pasos, y **se puede parar en cualquiera** si el usuario lo pide:

1. **Gherkin** — el escenario en `.feature`.
2. **Page Objects** — los métodos con los que el test va a actuar sobre la página.
3. **Test** — el `.spec.ts` que ejecuta el escenario y lo pone en verde.

**Tras la primera puerta se espera confirmación antes de escribir código.** Escribe el `.feature`
en `tests/features/` en cuanto lo tengas listo — así aparece editable en la pestaña Redactar, que
es donde se revisa y corrige, no en el chat. En la consola no repitas el Gherkin completo: un aviso
corto que apunte al fichero basta (p. ej. «He dejado el escenario en Redactar →
`<nombre>.feature`, revísalo y dime si confirmas o lo edito yo»). No toques `tests/pages/` ni
`tests/specs/` hasta que el usuario confirme ahí mismo, en la consola (o lo edite él en Redactar y
avise). Si pide cambios, reescribe el `.feature` y repite el aviso corto.
```

Sustituirlo entero por:

```markdown
## 3. Las tres puertas y cómo se confirman

El trabajo avanza en tres pasos:

1. **Gherkin** — el escenario en `.feature`.
2. **Page Objects** — los métodos con los que el test va a actuar sobre la página.
3. **Test** — el `.spec.ts` que ejecuta el escenario y lo pone en verde.

**Cuántas de estas puertas paran de verdad a esperar tu confirmación lo decide el bloque "Política
de confirmación" que recibes al principio de tus instrucciones** (lo añade la app según lo que el
usuario eligió en Configuración). Puede ser solo la primera, dos, las tres, o cada fichero que
toques. Sigue esa política literalmente: ni preguntes más veces de las que pide, ni menos.

**Cada vez que toque parar, la confirmación se pide SIEMPRE con la herramienta `AskUserQuestion`,
nunca escribiendo la pregunta como texto suelto en la respuesta.** Antes de preguntar, escribe el
fichero correspondiente en disco — así aparece editable en su pestaña (Redactar para el `.feature`,
Generar para `.page.ts`/`.spec.ts`), que es donde se revisa, no en el chat. No repitas el contenido
completo del fichero dentro de la pregunta: un `header` corto («Escenario», «Código») y una
`question` que lo nombre bastan. Da dos opciones — «Confirmo, sigue» y «Lo edito yo en la
pestaña» —; si el usuario quiere pedir cambios en vez de elegir una, ya puede escribirlos por texto
libre, no hace falta una tercera opción para eso. Si pide cambios, reescribe el fichero y vuelve a
preguntar del mismo modo.

No toques el fichero del siguiente paso hasta que la puerta actual esté confirmada.
```

- [ ] **Step 2: Comprobar que el resto del fichero sigue intacto**

Run: `git diff skill/skills/qa/SKILL.md`
Expected: solo cambian las líneas de la sección "## 3"; el resto del fichero (frontmatter, "## 1",
"## 2", "## 4" en adelante) no tiene diferencias.

- [ ] **Step 3: Commit**

```bash
git add skill/skills/qa/SKILL.md
git commit -m "docs(skill): las puertas se confirman con AskUserQuestion, nunca en prosa"
```

---

### Task 6: `pestanaParaRuta` — a qué pestaña salta cada tipo de fichero

**Files:**
- Create: `src/pestanaParaRuta.ts`
- Test: `src/pestanaParaRuta.test.ts`

**Interfaces:**
- Produces: `export type PestanaDestino = "Redactar" | "Generar";` y
  `export function pestanaParaRuta(rutaFichero: string): PestanaDestino | null;` — los consume la
  Task 7 (`src/ConsolaGlobal.tsx`).

- [ ] **Step 1: Escribir el test (falla porque el módulo no existe)**

Crear `src/pestanaParaRuta.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { pestanaParaRuta } from "./pestanaParaRuta";

describe("pestanaParaRuta", () => {
  it("una ruta absoluta de Windows a un .feature va a Redactar", () => {
    expect(pestanaParaRuta("C:\\GitHub\\Agente-QA-Web\\pruebas\\babia\\tests\\features\\login.feature")).toBe("Redactar");
  });

  it("una ruta absoluta de Windows a un .page.ts va a Generar", () => {
    expect(pestanaParaRuta("C:\\GitHub\\Agente-QA-Web\\pruebas\\babia\\tests\\pages\\login.page.ts")).toBe("Generar");
  });

  it("una ruta absoluta de Windows a un .spec.ts va a Generar", () => {
    expect(pestanaParaRuta("C:\\GitHub\\Agente-QA-Web\\pruebas\\babia\\tests\\specs\\login.spec.ts")).toBe("Generar");
  });

  it("una ruta relativa (POSIX) también funciona", () => {
    expect(pestanaParaRuta("tests/features/login.feature")).toBe("Redactar");
  });

  it("un fichero fuera de tests/, o el setup de Playwright, no salta a ninguna pestaña", () => {
    expect(pestanaParaRuta("C:\\GitHub\\Agente-QA-Web\\pruebas\\babia\\playwright.config.ts")).toBeNull();
    expect(pestanaParaRuta("C:\\GitHub\\Agente-QA-Web\\pruebas\\babia\\tests\\setup\\auth.setup.ts")).toBeNull();
  });
});
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx vitest run src/pestanaParaRuta.test.ts`
Expected: FAIL — `Cannot find module './pestanaParaRuta'`

- [ ] **Step 3: Crear `src/pestanaParaRuta.ts`**

```ts
// Pieza 3 de docs/superpowers/specs/2026-09-14-puertas-de-confirmacion-con-botones.md: a qué
// pestaña saltar cuando llega una pregunta de confirmación sobre un fichero que el agente acaba de
// escribir. Pura y testeable: no sabe nada de React ni del estado de la app. `file_path` de
// Write/Edit del SDK es siempre una ruta ABSOLUTA (ver sdk-tools.d.ts), así que el match es por
// segmento de ruta, no por prefijo — funciona igual con una ruta relativa en los tests.
export type PestanaDestino = "Redactar" | "Generar";

export function pestanaParaRuta(rutaFichero: string): PestanaDestino | null {
  const normalizada = rutaFichero.replaceAll("\\", "/");
  if (/(^|\/)tests\/features\/[^/]+\.feature$/.test(normalizada)) return "Redactar";
  if (/(^|\/)tests\/(pages\/[^/]+\.page\.ts|specs\/[^/]+\.spec\.ts)$/.test(normalizada)) return "Generar";
  return null;
}
```

- [ ] **Step 4: Ejecutar y comprobar que pasa**

Run: `npx vitest run src/pestanaParaRuta.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pestanaParaRuta.ts src/pestanaParaRuta.test.ts
git commit -m "feat: pestanaParaRuta — a qué pestaña salta cada tipo de fichero generado"
```

---

### Task 7: La consola recuerda el último fichero escrito y salta de pestaña al preguntar

**Files:**
- Modify: `src/ConsolaGlobal.tsx`
- Test: `src/ConsolaGlobal.test.ts`

**Interfaces:**
- Consumes: `pestanaParaRuta`, `PestanaDestino` de `src/pestanaParaRuta.ts` (Task 6).
- Produces: `export function rutaUltimoFicheroEscrito(eventos: EventoNdjson[]): string | null;` (testeable suelta) y la prop nueva `onAbrirPestana?: (pestana: PestanaDestino) => void` en `ConsolaGlobalProps` — la consume la Task 8 (`src/App.tsx`).

- [ ] **Step 1: Escribir los tests de `rutaUltimoFicheroEscrito` (fallan primero)**

En `src/ConsolaGlobal.test.ts`, ampliar el import existente:

```ts
import {
  describirEvento,
  extraerTextoAsistente,
  extraerToolUseIds,
  formatearParametrosHerramienta,
  resumenEventoSistema,
  resumenResultadoHerramienta,
  rutaUltimoFicheroEscrito,
  textoBloqueFinal,
} from "./ConsolaGlobal";
```

Y añadir, al final del fichero, un `describe` nuevo:

```ts
describe("rutaUltimoFicheroEscrito — Pieza 3: a qué pestaña saltar", () => {
  it("encuentra la ruta del último Write, buscando hacia atrás en los eventos", () => {
    const eventos = [
      evento("agente.assistant", {
        message: { content: [{ type: "tool_use", name: "Write", input: { file_path: "C:\\repo\\tests\\features\\login.feature" } }] },
      }),
      evento("agente.user", { message: { content: [{ type: "tool_result", content: "ok" }] } }),
    ];
    expect(rutaUltimoFicheroEscrito(eventos)).toBe("C:\\repo\\tests\\features\\login.feature");
  });

  it("un Edit posterior gana al Write anterior (se queda con el más reciente)", () => {
    const eventos = [
      evento("agente.assistant", { message: { content: [{ type: "tool_use", name: "Write", input: { file_path: "a.feature" } }] } }),
      evento("agente.assistant", { message: { content: [{ type: "tool_use", name: "Edit", input: { file_path: "b.spec.ts" } }] } }),
    ];
    expect(rutaUltimoFicheroEscrito(eventos)).toBe("b.spec.ts");
  });

  it("ignora tool_use que no son Write ni Edit", () => {
    const eventos = [evento("agente.assistant", { message: { content: [{ type: "tool_use", name: "Read", input: { file_path: "x.ts" } }] } })];
    expect(rutaUltimoFicheroEscrito(eventos)).toBeNull();
  });

  it("sin ningún Write/Edit en la conversación, devuelve null", () => {
    expect(rutaUltimoFicheroEscrito([])).toBeNull();
  });
});
```

- [ ] **Step 2: Ejecutar y comprobar que fallan**

Run: `npx vitest run src/ConsolaGlobal.test.ts`
Expected: FAIL — `rutaUltimoFicheroEscrito` no está exportado todavía.

- [ ] **Step 3: Añadir `rutaUltimoFicheroEscrito` a `src/ConsolaGlobal.tsx`**

Justo después de la función `extraerToolUseIds` (antes del comentario de `formatearParametrosHerramienta`), insertar:

```ts
const NOMBRES_HERRAMIENTA_ESCRITURA = new Set(["Write", "Edit"]);

/** Ruta del último fichero que el agente escribió o modificó (`Write`/`Edit`), buscando hacia atrás
 *  en `eventos` — para saber a qué pestaña saltar cuando llega la pregunta de confirmación (Pieza
 *  3). `null` si no ha escrito nada todavía en esta conversación. */
export function rutaUltimoFicheroEscrito(eventos: EventoNdjson[]): string | null {
  for (let i = eventos.length - 1; i >= 0; i -= 1) {
    const evento = eventos[i];
    if (evento.type !== "agente.assistant") continue;
    const contenido = (evento.data as { message?: { content?: unknown } } | undefined)?.message?.content;
    if (!Array.isArray(contenido)) continue;
    const bloques = contenido as BloqueContenidoAsistente[];
    for (let j = bloques.length - 1; j >= 0; j -= 1) {
      const bloque = bloques[j];
      if (bloque.type === "tool_use" && bloque.name && NOMBRES_HERRAMIENTA_ESCRITURA.has(bloque.name)) {
        const rutaFichero = (bloque.input as { file_path?: unknown } | undefined)?.file_path;
        if (typeof rutaFichero === "string") return rutaFichero;
      }
    }
  }
  return null;
}
```

- [ ] **Step 4: Ejecutar y comprobar que pasan**

Run: `npx vitest run src/ConsolaGlobal.test.ts`
Expected: PASS

- [ ] **Step 5: Añadir el import y la prop `onAbrirPestana`**

Al principio del fichero, añadir el import:

```ts
import { pestanaParaRuta, type PestanaDestino } from "./pestanaParaRuta";
```

En `ConsolaGlobalProps`, después de `onBorradorAplicado: () => void;`, añadir:

```ts
  /** Pieza 3: a qué pestaña saltar cuando llega una pregunta de confirmación sobre un fichero que
   *  el agente acaba de escribir bajo tests/. Sin pasarla, la consola simplemente no salta de
   *  pestaña — no rompe nada. */
  onAbrirPestana?: (pestana: PestanaDestino) => void;
```

En la firma de `ConsolaGlobal(...)`, añadir `onAbrirPestana` a la desestructuración de props:

```ts
export function ConsolaGlobal({
  corridaActiva,
  eventos,
  marcarCorridaActiva,
  agregarMensajeUsuario,
  borradorConsola,
  onBorradorAplicado,
  onAbrirPestana,
}: ConsolaGlobalProps) {
```

- [ ] **Step 6: Cambiar el efecto que detecta la pregunta pendiente**

Añadir un `useRef` nuevo junto a `listaRef`/`inputRef`:

```ts
  // Solo saltar de pestaña la primera vez que se ve CADA pregunta (por requestId): si ya se saltó
  // y el usuario ha vuelto a otra pestaña a propósito, un re-render no debe arrastrarlo de vuelta.
  const requestIdAbierto = useRef<unknown>(undefined);
```

Sustituir el efecto:

```ts
  useEffect(() => {
    const ultimo = eventos[eventos.length - 1];
    if (ultimo?.type === "agente.pregunta") {
      setPreguntaPendiente(ultimo.data as PreguntaAgente);
      setOpcionEnfocada(0);
    }
  }, [eventos]);
```

por:

```ts
  useEffect(() => {
    const ultimo = eventos[eventos.length - 1];
    if (ultimo?.type !== "agente.pregunta") return;
    const pregunta = ultimo.data as PreguntaAgente;
    setPreguntaPendiente(pregunta);
    setOpcionEnfocada(0);
    if (pregunta.requestId === requestIdAbierto.current) return;
    requestIdAbierto.current = pregunta.requestId;
    const ruta = rutaUltimoFicheroEscrito(eventos);
    const pestana = ruta ? pestanaParaRuta(ruta) : null;
    if (pestana) onAbrirPestana?.(pestana);
  }, [eventos, onAbrirPestana]);
```

- [ ] **Step 7: Verificación completa de la tarea**

Run: `npm run typecheck && npx vitest run src/ConsolaGlobal.test.ts`
Expected: los dos en verde. (`src/App.tsx` no compila todavía sin pasar `onAbrirPestana` — es
opcional (`?:`), así que no rompe: la Task 8 lo conecta.)

- [ ] **Step 8: Commit**

```bash
git add src/ConsolaGlobal.tsx src/ConsolaGlobal.test.ts
git commit -m "feat: la consola salta a la pestaña del fichero cuando llega la pregunta de confirmación"
```

---

### Task 8: `src/App.tsx` conecta el salto de pestaña a `setPestana`

**Files:**
- Modify: `src/App.tsx`

Sin test nuevo (una línea de wiring en un componente sin tests, mismo patrón que
`escribirEnConsola: setBorradorConsola` ya existente en el mismo fichero).

- [ ] **Step 1: Pasar `onAbrirPestana` a `<ConsolaGlobal>`**

En el bloque:

```tsx
              <ConsolaGlobal
                corridaActiva={corridaActiva}
                eventos={eventos}
                marcarCorridaActiva={marcarCorridaActiva}
                agregarMensajeUsuario={agregarMensajeUsuario}
                borradorConsola={borradorConsola}
                onBorradorAplicado={() => {
                  setBorradorConsola(null);
                }}
              />
```

añadir la prop `onAbrirPestana={setPestana}` (pasa el setter directo: `PestanaDestino` es un
subconjunto literal de `Pestana`, así que es asignable sin cast):

```tsx
              <ConsolaGlobal
                corridaActiva={corridaActiva}
                eventos={eventos}
                marcarCorridaActiva={marcarCorridaActiva}
                agregarMensajeUsuario={agregarMensajeUsuario}
                borradorConsola={borradorConsola}
                onBorradorAplicado={() => {
                  setBorradorConsola(null);
                }}
                onAbrirPestana={setPestana}
              />
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run typecheck && npm run lint`
Expected: los dos en verde. Si TypeScript se queja de la asignación `Dispatch<SetStateAction<Pestana>>`
contra `((pestana: PestanaDestino) => void) | undefined`, envolver en una lambda en vez de pasar el
setter directo:

```tsx
                onAbrirPestana={(pestana) => {
                  setPestana(pestana);
                }}
```

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: App.tsx conecta el salto de pestaña de la consola a setPestana"
```

---

### Task 9: El evento de sistema dice si la sesión es nueva o reanudada

**Files:**
- Modify: `server/agente.ts`
- Test: `server/agente.test.ts`
- Modify: `src/ConsolaGlobal.tsx`
- Test: `src/ConsolaGlobal.test.ts`

**Interfaces:**
- Ningún tipo nuevo: añade el campo `reanudada: boolean` dentro del `data` del evento `agente.system`
  que ya existe (no es un evento nuevo en el protocolo).

- [ ] **Step 1: Escribir los tests en `server/agente.test.ts` (fallan primero)**

```ts
  it("marca reanudada:true en el evento agente.system cuando se lanza con `resume`", async () => {
    const mensajeSistema = { type: "system", subtype: "init", model: "claude-x", tools: [], session_id: "s1" } as unknown as SDKMessage;
    const mensajeResultado = { type: "result", subtype: "success", is_error: false, queued_turn_count: 0 } as unknown as SDKMessage;
    const sesion = lanzar("continuar", {
      cwd: "/tmp",
      queryFn: queryFnFalsa([mensajeSistema, mensajeResultado]),
      resume: "sesion-anterior",
    });
    const eventos: EventoAgente[] = [];
    for await (const evento of sesion.suscribirse()) eventos.push(evento);
    const eventoSistema = eventos.find((e) => e.type === "agente.system");
    expect((eventoSistema?.data as { reanudada?: boolean } | undefined)?.reanudada).toBe(true);
  });

  it("marca reanudada:false en el evento agente.system cuando es una sesión nueva (sin `resume`)", async () => {
    const mensajeSistema = { type: "system", subtype: "init", model: "claude-x", tools: [] } as unknown as SDKMessage;
    const mensajeResultado = { type: "result", subtype: "success", is_error: false, queued_turn_count: 0 } as unknown as SDKMessage;
    const sesion = lanzar("empezar", { cwd: "/tmp", queryFn: queryFnFalsa([mensajeSistema, mensajeResultado]) });
    const eventos: EventoAgente[] = [];
    for await (const evento of sesion.suscribirse()) eventos.push(evento);
    const eventoSistema = eventos.find((e) => e.type === "agente.system");
    expect((eventoSistema?.data as { reanudada?: boolean } | undefined)?.reanudada).toBe(false);
  });
```

- [ ] **Step 2: Ejecutar y comprobar que fallan**

Run: `npx vitest run server/agente.test.ts`
Expected: FAIL — `data.reanudada` es `undefined` en los dos casos.

- [ ] **Step 3: Modificar el bucle de traducción de eventos en `server/agente.ts`**

La línea de hoy, dentro del `for await (const mensaje of q) { ... }`, después del bloque `if
(mensaje.type === "result") { ... }`:

```ts
        emitirSeguro({ type: `agente.${mensaje.type}`, data: mensaje });
```

pasa a:

```ts
        // Pieza 4 de la spec de puertas: el banner de la consola ("Sesión iniciada" vs.
        // "Conversación reanudada") necesita saber si ESTA sesión se lanzó con `resume` — solo se
        // sabe aquí, no en el propio mensaje `system` del SDK, que es idéntico en los dos casos.
        const datosEvento =
          mensaje.type === "system" ? { ...(mensaje as unknown as Record<string, unknown>), reanudada: Boolean(opciones.resume) } : mensaje;
        emitirSeguro({ type: `agente.${mensaje.type}`, data: datosEvento });
```

- [ ] **Step 4: Ejecutar y comprobar que pasan**

Run: `npx vitest run server/agente.test.ts`
Expected: PASS

- [ ] **Step 5: Escribir el test en `src/ConsolaGlobal.test.ts` (falla primero)**

Junto al test existente `"un system/init se resume en una línea..."`, añadir:

```ts
  it("un system/init reanudado dice 'Conversación reanudada', no 'Sesión iniciada'", () => {
    const e = evento("agente.system", { type: "system", subtype: "init", model: "claude-x", tools: ["a", "b"], reanudada: true });
    const items = describirEvento(e, null);
    expect(items).toHaveLength(1);
    if (items[0].tipo === "corto") {
      expect(items[0].etiqueta).toBe("Conversación reanudada — modelo claude-x, 2 herramientas disponibles.");
    }
  });
```

- [ ] **Step 6: Ejecutar y comprobar que falla**

Run: `npx vitest run src/ConsolaGlobal.test.ts`
Expected: FAIL — hoy siempre dice "Sesión iniciada".

- [ ] **Step 7: Modificar `resumenEventoSistema` en `src/ConsolaGlobal.tsx`**

De:

```ts
export function resumenEventoSistema(data: unknown): string | null {
  const d = (data ?? {}) as { subtype?: string; model?: string; tools?: unknown[] };
  if (d.subtype === "init") {
    const numHerramientas = Array.isArray(d.tools) ? d.tools.length : 0;
    return `Sesión iniciada — modelo ${d.model ?? "desconocido"}, ${String(numHerramientas)} herramientas disponibles.`;
  }
  return null;
}
```

a:

```ts
export function resumenEventoSistema(data: unknown): string | null {
  const d = (data ?? {}) as { subtype?: string; model?: string; tools?: unknown[]; reanudada?: boolean };
  if (d.subtype === "init") {
    const numHerramientas = Array.isArray(d.tools) ? d.tools.length : 0;
    const encabezado = d.reanudada ? "Conversación reanudada" : "Sesión iniciada";
    return `${encabezado} — modelo ${d.model ?? "desconocido"}, ${String(numHerramientas)} herramientas disponibles.`;
  }
  return null;
}
```

- [ ] **Step 8: Ejecutar y comprobar que pasan (los nuevos y el existente)**

Run: `npx vitest run src/ConsolaGlobal.test.ts`
Expected: PASS — incluido el test viejo `"un system/init se resume en una línea..."`, que no pasa
`reanudada` y debe seguir diciendo "Sesión iniciada" (`d.reanudada` es `undefined`, que es falsy).

- [ ] **Step 9: Verificación completa de la tarea**

Run: `npm run typecheck && npx vitest run server/agente.test.ts src/ConsolaGlobal.test.ts`
Expected: los dos en verde.

- [ ] **Step 10: Commit**

```bash
git add server/agente.ts server/agente.test.ts src/ConsolaGlobal.tsx src/ConsolaGlobal.test.ts
git commit -m "fix: la consola distingue conversación reanudada de sesión nueva en el banner"
```

---

### Task 10: Verificación agrupada y ciclo real contra `pruebas/babia`

**Files:** ninguno (solo comandos y una sesión real en el navegador).

- [ ] **Step 1: Suite completa**

Run: `npm run lint && npm run typecheck && npm run test && npm run build`
Expected: los cuatro en verde. Si `npm run build` falla por `dist-server/` de un build anterior, ver
`scripts/limpiar-dist-server.mjs` (ya enganchado en el propio `build`, no debería hacer falta nada
manual).

- [ ] **Step 2: Ciclo real, política por defecto ("escenario")**

Confirmar en Configuración → Puertas de confirmación que está en "Una vez, tras el escenario", y
lanzar `npm run dev -- --project pruebas/babia` (o el proyecto de pruebas que se esté usando).
Pedir un escenario nuevo desde la consola. Verificar, viéndolo en el navegador (con las herramientas
de Playwright MCP de esta sesión si están disponibles, o a mano):

- La pestaña **Redactar** se abre sola en cuanto llega la pregunta, con el `.feature` recién escrito
  visible.
- La pregunta trae **botones** («Confirmo, sigue» / «Lo edito yo en la pestaña»), no aviso en prosa.
- El banner de la consola dice **"Sesión iniciada"** en el primer turno y **"Conversación
  reanudada"** en el segundo.
- Tras pulsar «Confirmo, sigue», el flujo continúa solo — page objects, spec y ejecución — hasta el
  test en verde, **sin volver a preguntar**.

- [ ] **Step 3: Segunda pasada con "por-artefacto"**

Cambiar la política en Configuración a "Tres veces: cada artefacto por separado", repetir un ciclo, y
confirmar que para exactamente tres veces (feature, page objects, spec) y que cada parada abre
Redactar o Generar según el fichero que tocaba.

- [ ] **Step 4: Actualizar `ESTADO.md` y `PROXIMOS-PASOS.md`**

Según `CLAUDE.md` de este repo: al cerrar la tarea, anotar en `ESTADO.md` qué funciona hoy (la
puerta con botones, la política configurable, el salto de pestaña, el banner corregido) y tachar en
`PROXIMOS-PASOS.md` la entrada abierta "El Gherkin propuesto no siempre pasa por Redactar antes de
confirmarse" (queda resuelta por este plan). No hace falta plantilla aquí: seguir el estilo ya usado
en las filas de la tabla de decisiones de `ESTADO.md`.

- [ ] **Step 5: Commit final**

```bash
git add ESTADO.md PROXIMOS-PASOS.md
git commit -m "docs: puertas de confirmación con botones — cerrado y verificado en pruebas/babia"
```
