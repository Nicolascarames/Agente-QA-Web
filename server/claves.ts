// Claves de API de los 4 proveedores (spec Bloque 4, decisión 8 de la entrevista: enmascaradas,
// la clave completa solo viaja cuando se pide explícitamente por `/ver`). Nunca se registra en
// ningún log del servidor: quien registre las rutas debe silenciar el access log de `/ver`.
import type { ClaveInfo, Proveedor } from "../shared/tipos.js";
import { PROVEEDORES, buscarVariable, escribirVariable, nombreVarClave, type EscribirVariableResultado } from "./entornoMcp.js";

export async function listarClaves(rootDir: string): Promise<ClaveInfo[]> {
  const claves: ClaveInfo[] = [];
  for (const proveedor of PROVEEDORES) {
    const resuelto = await buscarVariable(nombreVarClave(proveedor), rootDir);
    claves.push({
      proveedor,
      hayClave: resuelto !== undefined,
      ultimos4: resuelto ? resuelto.valor.slice(-4) : null,
      capa: resuelto?.capa ?? null,
    });
  }
  return claves;
}

export function escribirClave(
  rootDir: string,
  proveedor: Proveedor,
  valor: string,
  capaDestino: "proyecto" | "global"
): Promise<EscribirVariableResultado> {
  return escribirVariable(nombreVarClave(proveedor), valor, capaDestino, rootDir);
}

export type VerClaveResultado = { ok: true; valor: string } | { ok: false; motivo: string };

export async function verClave(rootDir: string, proveedor: Proveedor): Promise<VerClaveResultado> {
  const resuelto = await buscarVariable(nombreVarClave(proveedor), rootDir);
  if (!resuelto) {
    return { ok: false, motivo: `No hay ninguna clave configurada para ${proveedor}.` };
  }
  return { ok: true, valor: resuelto.valor };
}
