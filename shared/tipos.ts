// Tipos compartidos entre server/ y src/. Deliberadamente sin dependencias de
// Node ni del navegador: los importan los dos lados, cada uno con su propio
// tsconfig (tsconfig.server.json / tsconfig.app.json).
import type { ScenarioCandidate, Screen } from "agente-qa-contract";

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

export interface ConfigProyecto {
  appUrl: CampoConfig<string>;
  environment: CampoConfig<EnvironmentApp>;
  limits: {
    maxIterations: CampoConfig<number>;
    maxScreens: CampoConfig<number>;
    maxCostUsd: CampoConfig<number>;
  };
  credenciales: {
    usuario: CampoSecreto;
    password: CampoSecreto;
  };
  /** Contenido crudo de `.agente-qa/memory.json`: sin esquema todavía en agente-qa-mcp. */
  memoria: unknown;
}

export type ConfigProyectoRespuesta = { inicializado: false } | { inicializado: true; config: ConfigProyecto };

export type Proveedor = "anthropic" | "openai" | "google" | "groq";
export type Perfil = "rapido" | "experto";
export type ModoCoste = "ahorro" | "equilibrado" | "calidad";
export type Rol = "map-loop" | "run-translate" | "login-fallback" | "web-chat" | "diagnosis";

export interface PerfilConfig {
  provider: CampoConfigVacio<Proveedor>;
  model: CampoConfigVacio<string>;
}

export interface ConfigGlobal {
  perfiles: Record<Perfil, PerfilConfig>;
  modoCoste: CampoConfig<ModoCoste>;
  roles: Record<Rol, CampoConfig<Perfil>>;
}

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

/** Cuerpo de `PUT /api/config/proyecto`: solo los campos que cambian, el resto se conserva. */
export interface CambiosConfigProyecto {
  appUrl?: string;
  environment?: EnvironmentApp;
  limits?: Partial<{ maxIterations: number; maxScreens: number; maxCostUsd: number }>;
  credenciales?: Partial<{ usuario: string; password: string }>;
  memoria?: unknown;
}

/** Cuerpo de `PUT /api/config/global`: solo los campos que cambian, el resto se conserva. */
export interface CambiosConfigGlobal {
  perfiles?: Partial<Record<Perfil, Partial<{ provider: Proveedor; model: string }>>>;
  modoCoste?: ModoCoste;
  roles?: Partial<Record<Rol, Perfil>>;
}

// --- Explorar (Bloque 5): las cuatro puertas al mapeador-mcp, en vivo -----------------

/** Las cuatro puertas de la tabla de la spec, siempre visibles en `BarraLanzamiento`. */
export type Puerta = "instantanea" | "grabacion-humana" | "grabacion-conducida" | "bucle-agentico" | "run";

/** Ámbito de la exploración: solo lo llevan las puertas con objetivo (conducida y bucle agéntico). */
export type AmbitoExploracion = "todo" | "seleccion" | "objetivo";

/**
 * Cuerpo de `POST /api/explorar`. `unidades` son ids de pantallas ya conocidas (ámbito "seleccion").
 * `texto` es propio de la puerta "run" (Bloque 6): lenguaje libre, `POST /api/mensaje` la usa
 * cuando no hay corrida activa para redirigir a lanzar una nueva.
 */
export interface CuerpoExplorar {
  puerta: Puerta;
  ambito?: AmbitoExploracion;
  objetivo?: string;
  url?: string;
  unidades?: string[];
  texto?: string;
}

export interface RespuestaExplorar {
  runId: string;
}

/**
 * `POST /api/mensaje` (Bloque 6): si había corrida activa, confirma el envío por stdin (`enviado:
 * true`); si no la había, se comporta como `/api/explorar` con la puerta "run" y devuelve el
 * `runId` de la corrida nueva.
 */
export type RespuestaMensaje = { enviado: true } | { runId: string };

/** Para que el frontend sepa, al cargar la pestaña, si ya hay una corrida en marcha antes de que llegue el primer evento SSE. */
export interface EstadoCorridaActiva {
  activa: boolean;
  runId: string | null;
}

/**
 * Envoltorio NDJSON de `agente-qa-mcp <comando> --json` (Bloques 1/2 de Agente-QA-MCP), reenviado
 * tal cual por SSE en `GET /api/eventos`: esta web nunca reinterpreta `data`. `type` se guarda como
 * string (no como unión cerrada) para no tumbar el pipeline si el CLI añade un tipo nuevo antes de
 * que esta web lo conozca; el catálogo de hoy es `operation.started/paused/stopped/completed/error`,
 * `cost.update`, `chat.message`, `map.screen.discovered`, `map.locator.resolved`,
 * `map.locator.ambiguous`, `map.scenarioCandidate.proposed`.
 */
export interface EventoNdjson {
  runId: string;
  ts: string;
  agent: string;
  type: string;
  data: unknown;
}

/**
 * `GET /api/mapa`: pantallas y candidatos de escenario tal como los valida `parseAppMap` del
 * contrato — no lo que ya resume `EstadoMapa` (solo cuenta). Lo necesita el árbol/detalle de
 * Explorar: seleccionar una pantalla exige ver sus localizadores/transiciones de verdad.
 */
export type MapaCompleto = { existe: false } | { existe: true; screens: Screen[]; scenarios: ScenarioCandidate[] };
