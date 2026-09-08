// Ejemplos como plantilla (Bloque 8): un `ejemplo.texto` de la ficha (`EjemploComando`, marcado
// `plantilla: true`) puede traer huecos `<...>` — `<url>`, `<objetivo>`... — para que la persona
// los vaya reescribiendo uno a uno en vez de borrar y reescribir la línea entera. Puras funciones
// de texto, sin DOM: `ConsolaGlobal.tsx` es quien las conecta con el `<input>` real (foco,
// `setSelectionRange`) al insertar el ejemplo y al saltar de hueco en hueco con Tab.
const REGEX_HUECO = /<[^<>]+>/;

export interface Hueco {
  /** Índice del `<` en el texto. */
  inicio: number;
  /** Índice justo después del `>` en el texto. */
  fin: number;
}

/**
 * Primer hueco `<...>` de `texto` a partir de `desde` (por defecto, desde el principio).
 * `desde` es cómo avanza `Tab`: se le pasa el final de la selección actual, así no vuelve a
 * encontrar el mismo hueco que se acaba de rellenar (que, al escribir encima de la selección,
 * ya ha desaparecido del texto de todas formas) ni uno que empiece antes de donde ya se escribió.
 * `null` si no queda ningún hueco a partir de ahí.
 */
export function siguienteHueco(texto: string, desde = 0): Hueco | null {
  const resto = texto.slice(desde);
  const coincidencia = REGEX_HUECO.exec(resto);
  if (!coincidencia) return null;
  return { inicio: desde + coincidencia.index, fin: desde + coincidencia.index + coincidencia[0].length };
}
