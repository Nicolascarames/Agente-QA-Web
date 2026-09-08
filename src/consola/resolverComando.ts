// Resolución de "¿a qué ficha real corresponden estos tokens?" compartida entre el autocompletado
// (`analizarLinea.ts`, Bloque 7) y el validador en vivo (`validarLinea.ts`, Bloque 8) de la consola
// asistida. Vivía duplicada en los dos ficheros y ya había divergido: `validarLinea.ts` sumaba las
// opciones globales de Commander vía `todasLasOpciones` y `analizarLinea.ts` no, así que el
// autocompletado nunca sugería `--json` aunque el validador sí lo aceptaba como flag válida.
import { cliGenerado, type ComandoCli, type FichaResuelta, type OpcionCli } from "../catalogo/catalogo";

export function buscarFichaPorRuta(catalogo: FichaResuelta[], ruta: string[]): FichaResuelta | undefined {
  const clave = ruta.join(" ");
  return catalogo.find((resuelta) => resuelta.ficha.ruta.join(" ") === clave);
}

/** Opciones del comando más las globales (`--json`, `-V`/`--version`) que Commander acepta en
 *  cualquier subcomando aunque la ficha no las repita — si el propio comando ya declara una con
 *  el mismo nombre largo (p.ej. `metrics --json`, con otro significado), gana la local. */
export function todasLasOpciones(cli: ComandoCli): OpcionCli[] {
  const locales = new Set(cli.opciones.map((opcion) => opcion.larga));
  const globales = cliGenerado.opcionesGlobales.filter((opcion) => !locales.has(opcion.larga));
  return [...cli.opciones, ...globales];
}
