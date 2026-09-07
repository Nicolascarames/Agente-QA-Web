// Compartido entre `server/comandoLibre.ts` (construye el argv real del CLI) y
// `src/consola/analizarLinea.ts` (autocompletado, Bloque 7): un único regex de tokenización para
// que enviar un comando y sugerirlo mientras se escribe nunca discrepen en cómo se parten las
// comillas.
const REGEX_TOKEN = /"([^"]*)"|'([^']*)'|(\S+)/g;

export interface TokenConPosicion {
  valor: string;
  /** Índice del primer carácter del token en el texto original (incluidas las comillas, si las hay). */
  inicio: number;
  /** Índice justo después del último carácter del token (incluidas las comillas, si las hay). */
  fin: number;
}

/** Igual que `tokenizarComando`, pero conservando dónde empieza y acaba cada token en el texto
 *  original — lo que necesita el autocompletado para saber sobre qué token cae el cursor. */
export function tokenizarConPosiciones(texto: string): TokenConPosicion[] {
  const regex = new RegExp(REGEX_TOKEN);
  const tokens: TokenConPosicion[] = [];
  let coincidencia: RegExpExecArray | null;
  while ((coincidencia = regex.exec(texto)) !== null) {
    const valor = coincidencia[1] ?? coincidencia[2] ?? coincidencia[3] ?? "";
    tokens.push({ valor, inicio: coincidencia.index, fin: coincidencia.index + coincidencia[0].length });
  }
  return tokens;
}

/** Tokeniza respetando comillas simples/dobles, para flags como `--auto "<objetivo con espacios>"`. */
export function tokenizarComando(texto: string): string[] {
  return tokenizarConPosiciones(texto).map((token) => token.valor);
}
