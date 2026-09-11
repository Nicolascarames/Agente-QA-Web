#!/usr/bin/env node
// Punto de entrada de `npx agente-qa` (Bloque 3). Arranca sobre `process.cwd()`, sin argumentos
// ni selector de proyecto (alcance cerrado: una instancia por repo). Importa el server ya
// compilado (`npm run build` primero): mismo criterio que `"start": "node dist-server/server/index.js"`.
import { createInterface } from "node:readline/promises";
import { buildApp } from "../dist-server/server/app.js";
import { ejecutarDoctor } from "../dist-server/server/doctor.js";
import { configRaizPath, escribirConfigRaiz, leerConfigRaiz } from "../dist-server/server/proyecto.js";

/** @param {string} cwd */
async function correrDoctor(cwd) {
  const resultado = await ejecutarDoctor(cwd);
  for (const comprobacion of resultado.comprobaciones) {
    console.log(`${comprobacion.ok ? "✅" : "❌"} ${comprobacion.nombre}: ${comprobacion.mensaje}`);
  }
  process.exit(resultado.ok ? 0 : 1);
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
