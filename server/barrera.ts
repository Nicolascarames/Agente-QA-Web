// Bloque 5: dos protecciones independientes, ambas puras (sin SDK ni red) para poder testearlas
// sueltas. `verificarLlamada` es el hook que se cuelga de `canUseTool` en agente.ts, antes de que
// cualquier tool de Playwright toque la app bajo prueba. `redactarSecretos`/`redactarSecretosProfundo`
// se aplican a cada evento antes de que salga por el difusor, sin importar si la barrera está activa.

/** Escapa un literal para poder meterlo dentro de una `RegExp` sin que sus caracteres especiales
 *  (`?`, `.`, `+`...) se interpreten como sintaxis de regex. */
export function escaparParaRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Ancla el patrón (ya escapado) como prefijo: una URL de la lista blanca cubre esa ruta y todo lo
 *  que cuelgue de ella. */
export function compilarPatron(patron: string): RegExp {
  return new RegExp(`^${escaparParaRegExp(patron)}`);
}

export function coincideListaBlanca(url: string, listaBlanca: string[]): boolean {
  return listaBlanca.some((patron) => compilarPatron(patron).test(url));
}

/** Tools de Playwright de solo lectura: no tocan el estado de la página, así que la barrera las deja
 *  pasar siempre, con o sin URL conocida. */
export const HERRAMIENTAS_LECTURA_PLAYWRIGHT = [
  "mcp__playwright__browser_snapshot",
  "mcp__playwright__browser_take_screenshot",
  "mcp__playwright__browser_console_messages",
  "mcp__playwright__browser_network_requests",
  "mcp__playwright__browser_find",
  "mcp__playwright__browser_tabs",
] as const;

export interface VerificarLlamadaArgs {
  toolName: string;
  toolInput: unknown;
  /** Última URL conocida por navegación previa; `null` si todavía no ha navegado a ningún sitio. */
  urlActual: string | null;
  barreraActiva: boolean;
  listaBlanca: string[];
  entorno: string;
}

export type ResultadoVerificacion = { permitir: true } | { permitir: false; motivo: string };

export function verificarLlamada(args: VerificarLlamadaArgs): ResultadoVerificacion {
  const { toolName, toolInput, urlActual, barreraActiva, listaBlanca, entorno } = args;
  if (!barreraActiva) return { permitir: true };
  if (!toolName.startsWith("mcp__playwright__")) return { permitir: true };
  if ((HERRAMIENTAS_LECTURA_PLAYWRIGHT as readonly string[]).includes(toolName)) return { permitir: true };

  const url = toolName === "mcp__playwright__browser_navigate" ? (toolInput as { url?: string }).url ?? null : urlActual;
  if (!url) {
    return { permitir: false, motivo: `Barrera activa (entorno "${entorno}"): no se sabe a qué URL apunta esta acción todavía.` };
  }
  if (coincideListaBlanca(url, listaBlanca)) return { permitir: true };
  return { permitir: false, motivo: `Barrera activa: "${url}" no está en la lista blanca del entorno "${entorno}".` };
}

// --- Secretos ------------------------------------------------------------------------------

const PATRON_NOMBRE_SECRETO = /PASSWORD|SECRET|TOKEN|KEY|CREDENCIAL/i;

/** Sustituye, dentro de `texto`, cualquier valor de `env` que parezca un secreto (por el nombre de
 *  su variable) por `«NOMBRE_VAR»`. Los valores más largos se sustituyen antes que los más cortos
 *  para que un valor corto no rompa a mitad uno más largo que lo contiene. */
export function redactarSecretos(texto: string, env: NodeJS.ProcessEnv = process.env): string {
  const secretos = Object.entries(env)
    .filter((entrada): entrada is [string, string] => {
      const [nombre, valor] = entrada;
      return PATRON_NOMBRE_SECRETO.test(nombre) && typeof valor === "string" && valor.length >= 4;
    })
    .sort(([, a], [, b]) => b.length - a.length);

  let resultado = texto;
  for (const [nombre, valor] of secretos) {
    resultado = resultado.split(valor).join(`«${nombre}»`);
  }
  return resultado;
}

/** Igual que `redactarSecretos`, pero recorre objetos/arrays aplicándolo a cada string hoja, sin
 *  mutar el valor original — para poder pasarle el `data` entero de un evento antes de emitirlo. */
export function redactarSecretosProfundo(valor: unknown, env: NodeJS.ProcessEnv = process.env): unknown {
  if (typeof valor === "string") return redactarSecretos(valor, env);
  if (Array.isArray(valor)) return valor.map((elemento) => redactarSecretosProfundo(elemento, env));
  if (typeof valor === "object" && valor !== null) {
    return Object.fromEntries(Object.entries(valor).map(([clave, v]) => [clave, redactarSecretosProfundo(v, env)]));
  }
  return valor;
}
