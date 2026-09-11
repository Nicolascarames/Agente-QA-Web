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
