#!/usr/bin/env node
// Punto de entrada de `npx agente-qa` (Bloque 3). Arranca sobre `process.cwd()`, sin argumentos
// ni selector de proyecto (alcance cerrado: una instancia por repo). Importa el server ya
// compilado (`npm run build` primero): mismo criterio que `"start": "node dist-server/server/index.js"`.
import { createInterface } from "node:readline/promises";
import { buildApp } from "../dist-server/server/app.js";
import { ejecutarDoctor } from "../dist-server/server/doctor.js";
import { instalar } from "../dist-server/server/instalar.js";
import { configRaizPath, escribirConfigRaiz, leerConfigRaiz } from "../dist-server/server/proyecto.js";

const DESTINOS_INSTALAR = ["claude", "codex", "copilot"];

/** @param {string} cwd */
async function correrDoctor(cwd) {
  const resultado = await ejecutarDoctor(cwd);
  for (const comprobacion of resultado.comprobaciones) {
    console.log(`${comprobacion.ok ? "✅" : "❌"} ${comprobacion.nombre}: ${comprobacion.mensaje}`);
  }
  process.exit(resultado.ok ? 0 : 1);
}

/** @param {string} mensaje @returns {Promise<boolean>} */
async function confirmarPorTerminal(mensaje) {
  if (!process.stdin.isTTY) return false;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const respuesta = await rl.question(`${mensaje} (s/N) `);
    return respuesta.trim().toLowerCase().startsWith("s");
  } finally {
    rl.close();
  }
}

/** @param {string} cwd */
async function correrInstalar(cwd) {
  const indiceSolo = process.argv.indexOf("--solo");
  const solo = indiceSolo !== -1 ? process.argv[indiceSolo + 1] : undefined;
  if (solo !== undefined && !DESTINOS_INSTALAR.includes(solo)) {
    console.error(`--solo debe ser uno de: ${DESTINOS_INSTALAR.join(", ")}`);
    process.exit(1);
  }

  const resultado = await instalar(cwd, { solo, confirmar: confirmarPorTerminal });
  for (const ruta of resultado.escritos) {
    console.log(`✅ ${ruta}`);
  }
  for (const ruta of resultado.omitidos) {
    console.log(`⏭️  ${ruta} (omitido, sin confirmación)`);
  }
  process.exit(resultado.escritos.length > 0 || resultado.omitidos.length === 0 ? 0 : 1);
}

async function preguntarUrlBase() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const respuesta = await rl.question("URL base de la aplicación a probar: ");
    return respuesta.trim();
  } finally {
    rl.close();
  }
}

/** @param {string} cwd */
async function asegurarConfigRaiz(cwd) {
  const existente = await leerConfigRaiz(cwd);
  if (existente) return existente;

  const appUrl = await preguntarUrlBase();
  const config = { schemaVersion: 1, appUrl };
  await escribirConfigRaiz(cwd, config);
  console.log(`Creado ${configRaizPath(cwd)}`);
  return config;
}

async function main() {
  const cwd = process.cwd();
  const comando = process.argv[2];

  if (comando === "doctor") {
    await correrDoctor(cwd);
    return;
  }

  if (comando === "instalar") {
    await correrInstalar(cwd);
    return;
  }

  await asegurarConfigRaiz(cwd);

  const app = buildApp({ proyectoInicial: cwd });
  const puerto = Number(process.env.PORT) || 3939;
  try {
    await app.listen({ port: puerto, host: "127.0.0.1" });
    console.log(`agente-qa escuchando en http://127.0.0.1:${String(puerto)} — proyecto: ${cwd}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void main();
