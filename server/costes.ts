import { promises as fs } from "node:fs";
import path from "node:path";
import type { RegistroEjecucion } from "../shared/tipos.js";

// Igual que `agente-qa.config.json` en server/proyecto.ts: en la raíz del repo destino, no bajo
// `.agente-qa/` (eso es solo para lo derivado en disco). "Sin base de datos" según la spec.
const LIMITE_HISTORIAL = 200;

function rutaHistorial(rootDir: string): string {
  return path.join(rootDir, "agente-qa.historial.json");
}

/** `[]` si el fichero no existe todavía o el JSON es inválido — nunca lanza, igual que `leerReporte`. */
export async function leerHistorial(rootDir: string): Promise<RegistroEjecucion[]> {
  let bruto: string;
  try {
    bruto = await fs.readFile(rutaHistorial(rootDir), "utf8");
  } catch {
    return [];
  }
  try {
    const registros: unknown = JSON.parse(bruto);
    return Array.isArray(registros) ? (registros as RegistroEjecucion[]) : [];
  } catch {
    return [];
  }
}

/** Añade un registro con el timestamp de ahora y reescribe el fichero. Recorta a las 200 entradas
 *  más recientes: sin base de datos, el límite evita que el JSON crezca sin fin. */
export async function registrarEjecucion(rootDir: string, registro: Omit<RegistroEjecucion, "timestamp">): Promise<void> {
  const historial = await leerHistorial(rootDir);
  historial.push({ ...registro, timestamp: new Date().toISOString() });
  const recortado = historial.slice(-LIMITE_HISTORIAL);
  await fs.writeFile(rutaHistorial(rootDir), JSON.stringify(recortado, null, 2) + "\n", "utf8");
}
