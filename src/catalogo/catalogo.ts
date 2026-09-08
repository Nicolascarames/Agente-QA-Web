// Cruza `cli.generado.json` (la forma real del CLI, generada por `npm run catalogo:sync`) con
// `comandos.ts` (la prosa editorial) y devuelve, por comando, la estructura real más la ficha.
// Única puerta que deben usar los bloques siguientes: nunca leer `cli.generado.json` ni
// `comandos.ts` directamente fuera de aquí.
import cliGeneradoJson from "./cli.generado.json";
import { COMANDOS } from "./comandos";
import type { FichaComando } from "./tipos";

export interface ArgumentoCli {
  nombre: string;
  obligatorio: boolean;
  variadico: boolean;
  descripcion: string;
}

export interface OpcionCli {
  flags: string;
  corta: string | null;
  larga: string;
  valor: string | null;
  valorObligatorio: boolean;
  negable: boolean;
  porDefecto: string | null;
  descripcion: string;
}

export interface ComandoCli {
  ruta: string[];
  nombre: string;
  descripcion: string;
  argumentos: ArgumentoCli[];
  opciones: OpcionCli[];
  subcomandos: ComandoCli[];
}

export interface CatalogoCli {
  version: string;
  opcionesGlobales: OpcionCli[];
  comandos: ComandoCli[];
}

export const cliGenerado = cliGeneradoJson as CatalogoCli;

function claveRuta(ruta: string[]): string {
  return ruta.join(" ");
}

/** Aplana el árbol a solo las hojas invocables: `llm`/`mcp` son namespaces sin acción propia, no comandos con ficha. */
export function comandosHoja(nodos: ComandoCli[] = cliGenerado.comandos): ComandoCli[] {
  return nodos.flatMap((nodo) => (nodo.subcomandos.length > 0 ? comandosHoja(nodo.subcomandos) : [nodo]));
}

export function buscarFicha(ruta: string[]): FichaComando | undefined {
  return COMANDOS.find((ficha) => claveRuta(ficha.ruta) === claveRuta(ruta));
}

export type FichaResuelta =
  | { tipo: "comando"; ficha: FichaComando; cli: ComandoCli }
  | { tipo: "pendiente"; ficha: FichaComando };

/**
 * Las 18 fichas ya cruzadas: las 14 con comando real llevan su nodo de `cli.generado.json`
 * (`tipo: "comando"`), las 4 operaciones sin comando todavía van sueltas (`tipo: "pendiente"`).
 */
export function catalogoResuelto(): FichaResuelta[] {
  const hojas = comandosHoja();
  return COMANDOS.map((ficha) => {
    if (ficha.ejes.estado === "pendiente") {
      return { tipo: "pendiente", ficha };
    }
    const cli = hojas.find((nodo) => claveRuta(nodo.ruta) === claveRuta(ficha.ruta));
    if (!cli) {
      throw new Error(`Ficha "${claveRuta(ficha.ruta)}" no tiene comando real en cli.generado.json — revisa su ruta o su eje "estado".`);
    }
    return { tipo: "comando", ficha, cli };
  });
}

/** Flags citadas en `ficha.incompatibles` que no existen en `ficha.opciones`. Vacío hoy a propósito (Bloque 8 rellena `incompatibles`). */
export function incompatiblesInvalidos(ficha: FichaComando): string[] {
  const flagsConocidas = new Set(Object.keys(ficha.opciones));
  const invalidas: string[] = [];
  for (const par of ficha.incompatibles) {
    for (const flag of par) {
      if (!flagsConocidas.has(flag)) invalidas.push(flag);
    }
  }
  return invalidas;
}
