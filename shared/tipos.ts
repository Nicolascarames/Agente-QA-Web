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

// --- Configuración (Bloque 4) --------------------------------------------------------
// Convención de capas replicada de `agente-qa-mcp/src/config/resolve.ts` (nunca importada):
// entorno (`process.env`) > proyecto (`.agente-qa/.env`) > global (`.env` de `agente-qa-mcp`).

export type CapaConfig = "entorno" | "proyecto" | "global";

/** Campo siempre resuelto (config.json de proyecto: no tiene capa "entorno"). */
export interface CampoConfig<T> {
  valor: T;
  capa: CapaConfig;
  /** false solo cuando `capa === "entorno"`: una variable de entorno del sistema no se edita desde la web. */
  editable: boolean;
}

/** Campo que puede no tener valor en ninguna capa (claves, provider/model de un perfil sin configurar). */
export interface CampoConfigVacio<T> {
  valor: T | null;
  capa: CapaConfig | null;
  editable: boolean;
}

export type EnvironmentApp = "dev" | "test" | "staging" | "production";

/** Como `ClaveInfo`: nunca viaja el valor completo salvo que se pida explícitamente por `/ver`. */
export interface CampoSecreto {
  hayValor: boolean;
  ultimos4: string | null;
  capa: CapaConfig | null;
  editable: boolean;
}

export type Proveedor = "anthropic" | "openai" | "google" | "groq";

/**
 * Modalidad de LLM del proyecto (Spec B, Bloque 1 de agente-qa-mcp: ya no hay perfiles `rapido`/
 * `experto`, tabla rol→perfil ni modos de coste — una sola modalidad activa). `proveedor`/`modelo`
 * solo tienen valor con `modalidad: "api"`; con `"suscripcion"` van a `null` porque no aplican
 * (usa el binario `claude`, sin proveedor ni modelo que configurar). Vive en `llm` de
 * `config.json` del proyecto, no en el `.env` global: por eso no lleva `CapaConfig` como el resto
 * de campos de esta interfaz, siempre es editable desde este mismo proyecto.
 */
export interface LlmProyecto {
  modalidad: Modalidad;
  proveedor: Proveedor | null;
  modelo: string | null;
}

export type Modalidad = "api" | "suscripcion";

export interface ConfigProyecto {
  appUrl: CampoConfig<string>;
  environment: CampoConfig<EnvironmentApp>;
  limits: {
    maxIterations: CampoConfig<number>;
    maxScreens: CampoConfig<number>;
    maxCostUsd: CampoConfig<number>;
  };
  /** Ausente si el proyecto no tiene `llm` en `config.json` todavía (p.ej. uno recién creado con
   *  `init`, que no lo escribe): "sin configurar" no es lo mismo que "api sin proveedor ni
   *  modelo", así que no se sintetiza ese valor por defecto. */
  llm?: LlmProyecto;
  credenciales: {
    usuario: CampoSecreto;
    password: CampoSecreto;
  };
  /** Contenido crudo de `.agente-qa/memory.json`: sin esquema todavía en agente-qa-mcp. */
  memoria: unknown;
}

export type ConfigProyectoRespuesta = { inicializado: false } | { inicializado: true; config: ConfigProyecto };

export interface ClaveInfo {
  proveedor: Proveedor;
  hayClave: boolean;
  ultimos4: string | null;
  capa: CapaConfig | null;
}

export interface ResultadoCli {
  encontrado: boolean;
  ruta?: string;
  origen?: "PATH" | "repo-hermano" | "guardado";
  diagnostico: string[];
}

export interface ResultadoSubproceso {
  codigo: number | null;
  stdout: string;
  stderr: string;
}

/** `llm` dentro de `CambiosConfigProyecto`: o se cambia a `suscripcion` (nada más que decir), o a
 *  `api` con proveedor y modelo completos — nunca a medias, para no dejar `config.json` con un
 *  proveedor sin modelo o viceversa. */
export type CambiosLlmProyecto = { modalidad: "suscripcion" } | { modalidad: "api"; proveedor: Proveedor; modelo: string };

/** Cuerpo de `PUT /api/config/proyecto`: solo los campos que cambian, el resto se conserva. */
export interface CambiosConfigProyecto {
  appUrl?: string;
  environment?: EnvironmentApp;
  limits?: Partial<{ maxIterations: number; maxScreens: number; maxCostUsd: number }>;
  llm?: CambiosLlmProyecto;
  credenciales?: Partial<{ usuario: string; password: string }>;
  memoria?: unknown;
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
