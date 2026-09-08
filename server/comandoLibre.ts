// Convierte el texto libre escrito en la consola global en el argv real del CLI
// `agente-qa-mcp`. Nunca se construye un string de shell: el resultado va directo a
// `cross-spawn` como array (ver `lanzarCorrida` en `corridas.ts`), así el texto del
// usuario no abre ninguna vía de inyección de shell.
import { readFileSync } from "node:fs";
import path from "node:path";
import { tokenizarComando } from "../shared/tokenizarComando.js";

export { tokenizarComando };

// Los nombres de comando de primer nivel salen de `cli.generado.json` (mismo fichero que consume
// el catálogo editorial de `src/catalogo/`, generado por `npm run catalogo:sync`) en vez de una
// lista escrita a mano: era la tercera copia de la misma lista y se desincronizaba en cuanto el
// CLI ganaba un comando (p.ej. `catalog`, que faltaba aquí antes de este cambio).
//
// La ruta se resuelve contra `process.cwd()` en vez de `import.meta.url`: `tsc` compila
// `server/` preservando esa carpeta bajo `dist-server/` (queda en `dist-server/server/`), así
// que el número de `..` para llegar a `src/catalogo/` desde este fichero cambia entre dev (`tsx`
// corriendo `server/comandoLibre.ts`) y compilado (`dist-server/server/comandoLibre.js`) — pero
// `npm run dev`, `vitest` y `npm start` siempre arrancan con la raíz del repo como cwd, así que
// esa ruta sí es estable en los dos casos.
const cliGenerado = JSON.parse(
  readFileSync(path.resolve(process.cwd(), "src", "catalogo", "cli.generado.json"), "utf8")
) as { comandos: { nombre: string }[] };

const COMANDOS_PERMITIDOS = new Set(cliGenerado.comandos.map((comando) => comando.nombre));

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
