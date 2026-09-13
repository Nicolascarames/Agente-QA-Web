#!/usr/bin/env node
// Cartel de bienvenida de la Pieza 1 (postinstall/postprepare): nunca pregunta nada, porque un
// prompt en un hook de npm cuelga los procesos desatendidos (CI, npm ci). Solo imprime, y solo en
// los dos casos que le interesan a una persona real: acaba de compilar este mismo repo, o acaba de
// instalar el paquete global. Cualquier otro caso (dependencia de otro proyecto, caché de npx) es
// silencio absoluto.
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * Compara dos rutas por valor, resueltas e insensibles a mayúsculas (Windows no distingue).
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function mismaRuta(a, b) {
  return path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
}

/**
 * Función pura: decide qué cartel imprimir, sin tocar console.log, para poder testear los tres
 * casos sin instalar nada de verdad.
 *
 * @param {NodeJS.ProcessEnv} env
 * @param {string[]} argv
 * @param {string} raizPaquete
 * @returns {string | null}
 */
export function elegirCartel(env, argv, raizPaquete) {
  const esDev = argv.includes("--dev");

  if (esDev) {
    if (env.INIT_CWD && mismaRuta(env.INIT_CWD, raizPaquete)) {
      return "✅ Compilado. Ahora: npm run empezar";
    }
    return null;
  }

  if (env.npm_config_global === "true") {
    return "✅ Instalado. Ve al repo de tu web y ejecuta: qa-web-agent";
  }

  return null;
}

try {
  const raizPaquete = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const cartel = elegirCartel(process.env, process.argv.slice(2), raizPaquete);
  if (cartel) console.log(cartel);
} catch {
  // Un cartel roto no puede tumbar un npm install.
}
