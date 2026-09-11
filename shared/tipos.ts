// Tipos compartidos entre server/ y src/. Deliberadamente sin dependencias de
// Node ni del navegador: los importan los dos lados, cada uno con su propio
// tsconfig (tsconfig.server.json / tsconfig.app.json).

/** Cómo de avanzado está un bloque del proyecto QA, derivado del disco en cada petición. */
export type EstadoBloque = "no existe" | "borrador" | "listo";

export interface EstadoFicheros {
  estado: EstadoBloque;
  ficheros: number;
}

export interface EstadoProyecto {
  proyecto: string;
  /** false si no existe `.agente-qa/` en absoluto: el frontend ofrece ejecutar `init`. */
  agenteQaInicializado: boolean;
  features: EstadoFicheros;
  e2e: EstadoFicheros;
  reporte: { estado: EstadoBloque };
}

/** Respuesta de `GET /api/actividad` mientras depende del Bloque 1 de Agente-QA-MCP. */
export interface ActividadNoDisponible {
  error: string;
}

/** Alcance: una instancia por repo (decisión cerrada en ESTADO.md) — sin lista de recientes. */
export interface EstadoProyectoActivo {
  actual: string;
}

/** Config raíz del repo (`agente-qa.config.json`), Bloque 3. Bloque 5 añade `entorno`, `barrera`
 *  (interruptor de la barrera de escrituras) y `listaBlanca` (URLs permitidas con la barrera activa). */
export interface ConfigRaiz {
  schemaVersion: 1;
  appUrl: string;
  entorno: string;
  barrera: boolean;
  listaBlanca: string[];
}

// --- Consola global: el canal de eventos sobrevive al Bloque 2, vacío de contenido -----------

/** Respuesta de `POST /api/comando`: siempre lanza una ejecución nueva. */
export interface RespuestaComando {
  runId: string;
}

/** Para que el frontend sepa, al cargar la pestaña, si ya hay una ejecución en marcha antes de que llegue el primer evento SSE. */
export interface EstadoCorridaActiva {
  activa: boolean;
  runId: string | null;
}

/**
 * Envoltorio NDJSON reenviado tal cual por SSE en `GET /api/eventos`: esta web nunca reinterpreta
 * `data`. `type` se guarda como string (no como unión cerrada) para no tumbar el pipeline si quien
 * emite eventos añade un tipo nuevo antes de que esta web lo conozca — los tipos terminales que sí
 * importan para cerrar una ejecución viven en `shared/eventos.ts`.
 */
export interface EventoNdjson {
  runId: string;
  ts: string;
  agent: string;
  type: string;
  data: unknown;
}

// --- Ejecutar / Reparar (Bloque 7): resultados reales del último reporte de Playwright ---------
// Viven aquí, no en server/reporter.ts, porque src/api.ts (tsconfig.app.json) no puede importar de
// server/ (tsconfig.server.json) — server/reporter.ts los re-exporta para conservar su forma
// pública documentada en la spec.

/** Un test, leído fielmente del JSON de Playwright: `server/reporter.ts` nunca lo reinterpreta como
 *  juicio (regla 2 de la spec), solo lo aplana a esta forma. */
export interface ResultadoTest {
  nombre: string;
  ficheroSpec: string;
  estado: "passed" | "failed" | "skipped" | "timedOut";
  duracionMs: number;
  reintentos: number;
  mensajeError?: string;
  pasos: { titulo: string; estado: "passed" | "failed" | "skipped" }[];
}

/** Etiqueta SUGERIDA para el badge de Reparar — nunca definitiva. Quien clasifica de verdad "fallo
 *  del test" vs. "fallo de la aplicación" es el agente, visible en el chat. */
export type Sugerencia = "fallo-test" | "fallo-aplicacion" | "desconocido";

/** Respuesta de `GET /api/tests/rojos`: un `ResultadoTest` en rojo más la sugerencia de badge. */
export interface ResultadoTestRojo extends ResultadoTest {
  sugerencia: Sugerencia;
}
