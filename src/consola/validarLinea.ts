// Validación en vivo de la consola asistida (Bloque 8): antes de pulsar Enter, comprueba la línea
// ya escrita contra el catálogo real (opciones, argumentos e incompatibilidades) y devuelve los
// problemas encontrados, cada uno con su motivo en castellano. Función pura, sin DOM — la pinta
// `ConsolaGlobal.tsx`, en el mismo sitio donde ya mostraba el error del servidor.
import { tokenizarComando } from "../../shared/tokenizarComando";
import type { FichaResuelta } from "../catalogo/catalogo";
import { VALORES_CERRADOS } from "./analizarLinea";
import { buscarFichaPorRuta, todasLasOpciones } from "./resolverComando";

export interface ProblemaLinea {
  motivo: string;
}

/** Distancia de edición (inserciones/borrados/sustituciones de un carácter) entre dos cadenas —
 *  DP clásico, usado solo para "¿querías decir...?" sobre flags que no existen. */
function distanciaLevenshtein(a: string, b: string): number {
  const filas: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) filas[i][0] = i;
  for (let j = 0; j <= b.length; j++) filas[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const coste = a[i - 1] === b[j - 1] ? 0 : 1;
      filas[i][j] = Math.min(filas[i - 1][j] + 1, filas[i][j - 1] + 1, filas[i - 1][j - 1] + coste);
    }
  }
  return filas[a.length][b.length];
}

/**
 * Valida `texto` (tal cual está en la caja, todavía sin enviar) contra `catalogo`. No dice nada
 * mientras se escribe el nombre del comando/subcomando o si no se reconoce — eso ya lo guía el
 * autocompletado (Bloque 7); esta función solo entra en acción una vez hay un comando real.
 */
export function validarLinea(texto: string, catalogo: FichaResuelta[]): ProblemaLinea[] {
  const tokens = tokenizarComando(texto);
  if (tokens.length === 0) return [];

  const primerToken = tokens[0];
  const hijosNamespace = catalogo.filter(
    (resuelta) => resuelta.tipo === "comando" && resuelta.ficha.ruta.length === 2 && resuelta.ficha.ruta[0] === primerToken,
  );
  const largoRuta = hijosNamespace.length > 0 ? 2 : 1;
  if (tokens.length < largoRuta) return [];

  const resuelta = buscarFichaPorRuta(catalogo, tokens.slice(0, largoRuta));
  if (!resuelta || resuelta.tipo !== "comando") return [];

  const nombreComando = resuelta.ficha.ruta.join(" ");
  const opciones = todasLasOpciones(resuelta.cli);
  const problemas: ProblemaLinea[] = [];
  const flagsUsadas = new Set<string>();
  const posicionales: string[] = [];

  const resto = tokens.slice(largoRuta);
  for (let i = 0; i < resto.length; i++) {
    const token = resto[i];
    if (!token.startsWith("-")) {
      posicionales.push(token);
      continue;
    }

    const opcion = opciones.find((candidata) => candidata.larga === token || candidata.corta === token);
    if (!opcion) {
      let mejor: string | null = null;
      let mejorDistancia = Infinity;
      for (const candidata of opciones) {
        const distancia = distanciaLevenshtein(token.toLowerCase(), candidata.larga.toLowerCase());
        if (distancia < mejorDistancia) {
          mejorDistancia = distancia;
          mejor = candidata.larga;
        }
      }
      problemas.push({
        motivo: mejor && mejorDistancia <= 3 ? `${token} no existe en ${nombreComando}. ¿Querías decir ${mejor}?` : `${token} no existe en ${nombreComando}.`,
      });
      continue;
    }

    flagsUsadas.add(opcion.larga);
    if (!opcion.valorObligatorio) continue;

    const valor = resto[i + 1];
    if (valor === undefined || valor.startsWith("-")) {
      problemas.push({ motivo: `${opcion.larga} necesita un valor.` });
      continue;
    }
    const valoresValidos = VALORES_CERRADOS[opcion.larga];
    if (valoresValidos && !valoresValidos.includes(valor)) {
      problemas.push({ motivo: `${valor} no es un valor válido de ${opcion.larga}: usa ${valoresValidos.join(", ")}.` });
    }
    i++; // el siguiente token ya es el valor de este flag, no otro flag ni un argumento posicional
  }

  const requeridos = resuelta.cli.argumentos.filter((argumento) => argumento.obligatorio);
  if (posicionales.length < requeridos.length) {
    problemas.push({ motivo: `falta el argumento obligatorio <${requeridos[posicionales.length].nombre}>.` });
  }

  for (const [primero, segundo] of resuelta.ficha.incompatibles) {
    if (flagsUsadas.has(primero) && flagsUsadas.has(segundo)) {
      problemas.push({ motivo: `${primero} y ${segundo} son excluyentes: usa solo uno.` });
    }
  }

  return problemas;
}
