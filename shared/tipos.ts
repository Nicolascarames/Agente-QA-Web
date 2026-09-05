// Tipos compartidos entre server/ y src/. Deliberadamente sin dependencias de
// Node ni del navegador: los importan los dos lados, cada uno con su propio
// tsconfig (tsconfig.server.json / tsconfig.app.json).

/** Cómo de avanzado está un bloque del proyecto QA, derivado del disco en cada petición. */
export type EstadoBloque = "no existe" | "borrador" | "listo";

export interface EstadoMapa {
  estado: EstadoBloque;
  pantallas: number;
  localizadores: number;
  candidatosEscenario: number;
}

export interface EstadoFicheros {
  estado: EstadoBloque;
  ficheros: number;
}

export interface EstadoProyecto {
  proyecto: string;
  /** false si no existe `.agente-qa/` en absoluto: el frontend ofrece ejecutar `init`. */
  agenteQaInicializado: boolean;
  mapa: EstadoMapa;
  features: EstadoFicheros;
  e2e: EstadoFicheros;
  reporte: { estado: EstadoBloque };
}

/** Respuesta de `GET /api/actividad` mientras depende del Bloque 1 de Agente-QA-MCP. */
export interface ActividadNoDisponible {
  error: string;
}

export interface EstadoProyectoActivo {
  actual: string;
  recientes: string[];
}
