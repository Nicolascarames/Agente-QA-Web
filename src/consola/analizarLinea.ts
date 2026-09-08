// Autocompletado de la consola asistida (Bloque 7). Función pura, sin DOM ni React: recibe el
// texto y la posición del cursor tal cual salen de `selectionStart` del `<input>`, y el catálogo
// ya resuelto (`catalogoResuelto()`), y devuelve qué se está escribiendo y qué ofrecer. La usa
// `Autocompletado.tsx` para pintar; se prueba sola con vitest.
import { tokenizarConPosiciones } from "../../shared/tokenizarComando";
import type { FichaResuelta, OpcionCli } from "../catalogo/catalogo";
import { ejesConOpcion } from "../catalogo/ejesConOpcion";
import { idFicha } from "../catalogo/porPestana";
import type { EjesFicha, FichaComando } from "../catalogo/tipos";
import { buscarFichaPorRuta, todasLasOpciones } from "./resolverComando";

export type TipoToken = "comando" | "subcomando" | "argumento" | "flag" | "valor-de-flag";

export interface Sugerencia {
  /** Texto que sustituye a `tokenActual` si se acepta esta sugerencia. */
  inserta: string;
  titulo: string;
  descripcion: string;
  ejes: EjesFicha;
  /** Id de la ficha que abre el cajón de detalle (Bloque 4) al pulsar `?` sobre esta sugerencia. */
  rutaFicha: string;
}

export interface AnalisisLinea {
  tokenActual: string;
  inicioToken: number;
  tipo: TipoToken;
  /** Ruta ya resuelta del comando (o del namespace) hasta el token actual; `null` mientras se
   *  escribe la primera palabra o si el comando no se reconoce. */
  comando: string[] | null;
  sugerencias: Sugerencia[];
}

// Valores cerrados de los flags que no aceptan texto libre, verificados a mano contra
// `src/cli/commands/*.ts` de agente-qa-mcp (no derivados del texto de ninguna `descripcion`, que
// puede quedarse corta: p.ej. varias dicen "anthropic, openai o google" pero el código de
// `resolve.ts` también acepta "groq"):
// - `--env`: `ENVIRONMENTS` en `init.ts`.
// - `--modalidad`: `MODALIDADES` en `config.ts` (Spec B, Bloque 1 — ya no hay perfiles).
// - `--proveedor` (`config`) y `--provider` (`llm ping`): `PROVIDERS` en `config/resolve.ts`.
export const VALORES_CERRADOS: Record<string, readonly string[]> = {
  "--env": ["dev", "test", "staging", "production"],
  "--modalidad": ["api", "suscripcion"],
  "--proveedor": ["anthropic", "openai", "google", "groq"],
  "--provider": ["anthropic", "openai", "google", "groq"],
};

function coincidePrefijo(valor: string, prefijo: string): boolean {
  return valor.toLowerCase().startsWith(prefijo.toLowerCase());
}

/** Sugerencia de un nombre de comando/subcomando: `inserta` es el segmento que rellena el token
 *  (p.ej. `"record"`, o `"ping"` cuando el contexto ya es `["llm"]`). Para los dos namespaces sin
 *  comando propio (`llm`, `mcp`) se reutiliza la ficha de su único hijo real: hoy no hay otra
 *  fuente de resumen/insignias para el nombre suelto del namespace. */
function sugerenciaDeNombre(ficha: FichaComando, inserta: string): Sugerencia {
  return { inserta, titulo: inserta, descripcion: ficha.unaLinea, ejes: ficha.ejes, rutaFicha: idFicha(ficha) };
}

function sugerenciaDeOpcion(ficha: FichaComando, opcion: OpcionCli): Sugerencia {
  const editorial = ficha.opciones[opcion.larga];
  return {
    inserta: opcion.larga,
    titulo: opcion.flags,
    descripcion: editorial?.matiz ? `${opcion.descripcion} — ${editorial.matiz}` : opcion.descripcion,
    ejes: ejesConOpcion(ficha, editorial ?? null),
    rutaFicha: idFicha(ficha),
  };
}

function sugerenciaDeValor(ficha: FichaComando, valor: string): Sugerencia {
  return { inserta: valor, titulo: valor, descripcion: "", ejes: ficha.ejes, rutaFicha: idFicha(ficha) };
}

export function analizarLinea(texto: string, cursor: number, catalogo: FichaResuelta[]): AnalisisLinea {
  const tokens = tokenizarConPosiciones(texto);

  // Token que el cursor está editando. Si cae en un hueco (tras un espacio, o en línea vacía), se
  // inserta un token vacío en el hueco que le toca en la secuencia: así "escribir al final" y
  // "editar por el medio" pasan por el mismo camino.
  let indiceActivo = tokens.findIndex((token) => cursor >= token.inicio && cursor <= token.fin);
  if (indiceActivo === -1) {
    indiceActivo = tokens.filter((token) => token.fin < cursor).length;
    tokens.splice(indiceActivo, 0, { valor: "", inicio: cursor, fin: cursor });
  }

  const tokenActivo = tokens[indiceActivo];
  const tokenActual = tokenActivo.valor;
  const inicioToken = tokenActivo.inicio;
  const anteriores = tokens.slice(0, indiceActivo).map((token) => token.valor);

  // Primera palabra: se sugiere el nombre de comando mientras se escribe.
  if (indiceActivo === 0) {
    const vistos = new Set<string>();
    const sugerencias: Sugerencia[] = [];
    for (const resuelta of catalogo) {
      if (resuelta.tipo !== "comando") continue; // las 4 fichas "pendiente" no son invocables desde la consola
      const primerSegmento = resuelta.ficha.ruta[0];
      if (vistos.has(primerSegmento) || !coincidePrefijo(primerSegmento, tokenActual)) continue;
      vistos.add(primerSegmento);
      sugerencias.push(sugerenciaDeNombre(resuelta.ficha, primerSegmento));
    }
    return { tokenActual, inicioToken, tipo: "comando", comando: null, sugerencias };
  }

  const primerToken = anteriores[0];
  // ¿El primer segmento es un namespace con subcomando (`llm`, `mcp`)? Lo es si alguna ficha real
  // de dos segmentos empieza por él.
  const hijosNamespace = catalogo.filter(
    (resuelta) => resuelta.tipo === "comando" && resuelta.ficha.ruta.length === 2 && resuelta.ficha.ruta[0] === primerToken,
  );

  if (hijosNamespace.length > 0 && indiceActivo === 1) {
    const sugerencias = hijosNamespace
      .filter((resuelta) => coincidePrefijo(resuelta.ficha.ruta[1], tokenActual))
      .map((resuelta) => sugerenciaDeNombre(resuelta.ficha, resuelta.ficha.ruta[1]));
    return { tokenActual, inicioToken, tipo: "subcomando", comando: [primerToken], sugerencias };
  }

  const largoRuta = hijosNamespace.length > 0 ? 2 : 1;
  const rutaComando = anteriores.slice(0, largoRuta);
  const resuelta = buscarFichaPorRuta(catalogo, rutaComando);

  if (!resuelta || resuelta.tipo !== "comando") {
    // Comando no reconocido, o una de las 4 operaciones "pendiente" sin CLI real: texto libre.
    return { tokenActual, inicioToken, tipo: "argumento", comando: resuelta ? resuelta.ficha.ruta : null, sugerencias: [] };
  }

  // Opciones del comando más las globales (`--json`, `-V`/`--version`): mismo cálculo que usa
  // `validarLinea.ts` para aceptarlas, así que lo que aquí se sugiere es justo lo que allí no da
  // error (antes de este cambio, `analizarLinea.ts` no las conocía y nunca sugería `--json`).
  const opciones = todasLasOpciones(resuelta.cli);

  const restoArgs = anteriores.slice(largoRuta);
  const tokenAnterior = restoArgs.length > 0 ? restoArgs[restoArgs.length - 1] : null;
  const opcionAnterior = tokenAnterior ? opciones.find((opcion) => opcion.larga === tokenAnterior || opcion.corta === tokenAnterior) : undefined;

  // El token anterior es un flag que exige valor y todavía no lo tiene: este token es su valor.
  if (opcionAnterior?.valorObligatorio) {
    const valores = VALORES_CERRADOS[opcionAnterior.larga] ?? [];
    const sugerencias = valores.filter((valor) => coincidePrefijo(valor, tokenActual)).map((valor) => sugerenciaDeValor(resuelta.ficha, valor));
    return { tokenActual, inicioToken, tipo: "valor-de-flag", comando: resuelta.ficha.ruta, sugerencias };
  }

  if (tokenActual.startsWith("-")) {
    // Flags ya puestas antes del token que se está escribiendo ahora mismo, para no sugerir una
    // que `validarLinea.ts` (B8) rechazaría en el acto por `ficha.incompatibles` (p.ej. no ofrecer
    // `--goal` en `map --all --`, ya que `--all` y `--goal` son excluyentes).
    const flagsPuestas = new Set(
      restoArgs.map((token) => opciones.find((opcion) => opcion.larga === token || opcion.corta === token)?.larga).filter((larga) => larga !== undefined),
    );
    const prohibidasPorFlagsPuestas = new Set<string>();
    for (const [primero, segundo] of resuelta.ficha.incompatibles) {
      if (flagsPuestas.has(primero)) prohibidasPorFlagsPuestas.add(segundo);
      if (flagsPuestas.has(segundo)) prohibidasPorFlagsPuestas.add(primero);
    }

    const sugerencias = opciones
      .filter((opcion) => !prohibidasPorFlagsPuestas.has(opcion.larga))
      .filter((opcion) => coincidePrefijo(opcion.larga, tokenActual) || (opcion.corta !== null && coincidePrefijo(opcion.corta, tokenActual)))
      .map((opcion) => sugerenciaDeOpcion(resuelta.ficha, opcion));
    return { tokenActual, inicioToken, tipo: "flag", comando: resuelta.ficha.ruta, sugerencias };
  }

  // Argumento posicional (URL, texto libre...): sin sugerencias.
  return { tokenActual, inicioToken, tipo: "argumento", comando: resuelta.ficha.ruta, sugerencias: [] };
}
