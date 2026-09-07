// Convierte el texto libre escrito en la consola global en el argv real del CLI
// `agente-qa-mcp`. Nunca se construye un string de shell: el resultado va directo a
// `cross-spawn` como array (ver `lanzarCorrida` en `corridas.ts`), así el texto del
// usuario no abre ninguna vía de inyección de shell.

const COMANDOS_PERMITIDOS = new Set([
  "record",
  "map",
  "run",
  "snapshot",
  "browse",
  "validate",
  "config",
  "init",
  "doctor",
  "llm",
  "metrics",
  "mcp",
]);

/** Tokeniza respetando comillas simples/dobles, para flags como `--auto "<objetivo con espacios>"`. */
export function tokenizarComando(texto: string): string[] {
  const regex = /"([^"]*)"|'([^']*)'|(\S+)/g;
  const tokens: string[] = [];
  let coincidencia: RegExpExecArray | null;
  while ((coincidencia = regex.exec(texto)) !== null) {
    tokens.push(coincidencia[1] ?? coincidencia[2] ?? coincidencia[3] ?? "");
  }
  return tokens;
}

export function construirArgsComandoLibre(texto: string): { ok: true; args: string[] } | { ok: false; motivo: string } {
  const args = tokenizarComando(texto.trim());
  if (args.length === 0) {
    return { ok: false, motivo: "Escribe un comando." };
  }
  if (!COMANDOS_PERMITIDOS.has(args[0])) {
    return { ok: false, motivo: `"${args[0]}" no es un comando reconocido de agente-qa-mcp.` };
  }
  return { ok: true, args };
}
