#!/usr/bin/env node
// Guard de la build: repite el fallo real que dejó la interfaz sin estilos
// (2026-09-05) — un `@import` mal colocado hacía que PostCSS descartara
// `tokens.css` en silencio, así que el CSS compilado usaba `var(--algo)` por
// todas partes sin definir ni una sola variable, y el navegador caía a sus
// valores por defecto. `npm run build` corre esto justo después de
// `vite build`: si vuelve a pasar, la build falla aquí y no en producción.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const DIST_ASSETS = join("dist-client", "assets");
const TAMANO_MINIMO_BYTES = 5 * 1024;

function cssCompilado() {
  let ficheros;
  try {
    ficheros = readdirSync(DIST_ASSETS).filter((f) => f.endsWith(".css"));
  } catch {
    console.error(`[comprobar-estilos] No existe ${DIST_ASSETS} — ¿corrió "vite build" antes?`);
    process.exit(1);
  }
  if (ficheros.length === 0) {
    console.error(`[comprobar-estilos] ${DIST_ASSETS} no tiene ningún .css`);
    process.exit(1);
  }
  return ficheros.map((f) => join(DIST_ASSETS, f));
}

function main() {
  const rutas = cssCompilado();
  const usadas = new Set();
  const definidas = new Set();
  let tamanoTotal = 0;

  for (const ruta of rutas) {
    const css = readFileSync(ruta, "utf8");
    tamanoTotal += statSync(ruta).size;

    for (const m of css.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)/g)) {
      usadas.add(m[1]);
    }
    for (const m of css.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) {
      definidas.add(m[1]);
    }
  }

  const huerfanas = [...usadas].filter((v) => !definidas.has(v)).sort();
  const errores = [];

  if (huerfanas.length > 0) {
    errores.push(
      `usa ${huerfanas.length} variable(s) CSS sin definir: ${huerfanas.join(", ")}. ` +
        `Esto es exactamente el bug de tokens.css sin llegar al bundle — revisa que ` +
        `"@import './tokens.css';" sea la primera línea de src/index.css.`,
    );
  }
  if (tamanoTotal < TAMANO_MINIMO_BYTES) {
    errores.push(
      `el CSS compilado pesa ${tamanoTotal} bytes (< ${TAMANO_MINIMO_BYTES}) — demasiado poco para ` +
        `incluir la tabla de tokens, el reset y las utilidades de Tailwind: parece que tokens.css no se coló en el bundle.`,
    );
  }

  if (errores.length > 0) {
    console.error("[comprobar-estilos] La build no pasa el guard de estilos:");
    for (const e of errores) console.error(`  - ${e}`);
    process.exit(1);
  }

  console.log(
    `[comprobar-estilos] OK — ${definidas.size} variables definidas, ${usadas.size} usadas, ${tamanoTotal} bytes de CSS.`,
  );
}

main();
