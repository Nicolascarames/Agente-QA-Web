// Catálogo único de los tipos de evento que marcan el fin de una ejecución. Antes escrito a mano
// y por triplicado (`server/corridas.ts`, `src/Explorar.tsx`, `src/useCorridaGlobal.ts`): los tres
// desaparecieron o se reescribieron en el Bloque 2 de la spec, así que a partir de ahora todo
// consumidor importa de aquí en vez de mantener su propia copia de la lista.
export const TIPOS_EVENTO_TERMINAL = ["operation.completed", "operation.stopped", "operation.error"] as const;

export type TipoEventoTerminal = (typeof TIPOS_EVENTO_TERMINAL)[number];

export function esEventoTerminal(type: string): type is TipoEventoTerminal {
  return (TIPOS_EVENTO_TERMINAL as readonly string[]).includes(type);
}
