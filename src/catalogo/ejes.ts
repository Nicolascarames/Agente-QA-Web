// Etiqueta en castellano, icono y color de cada valor posible de los cuatro ejes. Los colores son
// tokens ya existentes en `src/tokens.css` (nunca un valor literal ni un token nuevo) — se
// reutilizan entre ejes porque no se muestran mezclados en un mismo chip.
import type { Agente, Conductor, Coste, Estado } from "./tipos";

export interface DescripcionEje {
  etiqueta: string;
  icono: string;
  /** Nombre del token de `tokens.css`, p.ej. `"--ok"`. */
  color: string;
}

export const DESCRIPCION_CONDUCTOR: Record<Conductor, DescripcionEje> = {
  humano: { etiqueta: "Humano", icono: "🧑", color: "--ok" },
  determinista: { etiqueta: "Determinista", icono: "⚙️", color: "--info" },
  "llm-api": { etiqueta: "LLM por API", icono: "🤖", color: "--accent" },
  "claude-code": { etiqueta: "Claude Code", icono: "🧠", color: "--agent" },
};

export const DESCRIPCION_AGENTE: Record<Agente, DescripcionEje> = {
  "mapeador-mcp": { etiqueta: "Mapeador MCP", icono: "🗺️", color: "--agent" },
  crawler: { etiqueta: "Crawler", icono: "🕷️", color: "--info" },
  redactor: { etiqueta: "Redactor", icono: "✍️", color: "--text-dim" },
  "redactor-mcp": { etiqueta: "Redactor MCP", icono: "✍️", color: "--agent" },
  generador: { etiqueta: "Generador", icono: "🧪", color: "--text-dim" },
  "generador-mcp": { etiqueta: "Generador MCP", icono: "🧪", color: "--agent" },
  reparador: { etiqueta: "Reparador", icono: "🔧", color: "--text-dim" },
  ejecutor: { etiqueta: "Ejecutor", icono: "▶️", color: "--text-dim" },
  informador: { etiqueta: "Informador", icono: "📈", color: "--text-dim" },
  "agente-qa-web": { etiqueta: "Agente-QA-Web", icono: "🖥️", color: "--info" },
  ninguno: { etiqueta: "Ninguno", icono: "—", color: "--text-faint" },
};

export const DESCRIPCION_COSTE: Record<Coste, DescripcionEje> = {
  cero: { etiqueta: "Cero", icono: "🆓", color: "--ok" },
  facturado: { etiqueta: "Facturado", icono: "💳", color: "--accent" },
  suscripcion: { etiqueta: "Suscripción", icono: "🔁", color: "--agent" },
};

export const DESCRIPCION_ESTADO: Record<Estado, DescripcionEje> = {
  construido: { etiqueta: "Construido", icono: "✅", color: "--ok" },
  pendiente: { etiqueta: "Pendiente", icono: "🕓", color: "--text-dim" },
  "otro-repo": { etiqueta: "Otro repo", icono: "↗️", color: "--info" },
};
