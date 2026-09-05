import type { EstadoProyecto, EstadoProyectoActivo } from "../shared/tipos";

/** true si la respuesta es el 501 documentado de /api/actividad; false si es cualquier otro fallo. */
export interface ActividadNoDisponible {
  disponible: false;
  motivo: string;
}

export interface ActividadDisponible {
  disponible: true;
  eventos: unknown[];
}

async function pedirJson<T>(url: string, init?: RequestInit): Promise<T> {
  const respuesta = await fetch(url, init);
  if (!respuesta.ok && respuesta.status !== 501) {
    throw new Error(`${url} respondió ${String(respuesta.status)}`);
  }
  return (await respuesta.json()) as T;
}

export function obtenerEstado(): Promise<EstadoProyecto> {
  return pedirJson<EstadoProyecto>("/api/estado");
}

export async function obtenerActividad(): Promise<ActividadDisponible | ActividadNoDisponible> {
  const respuesta = await fetch("/api/actividad");
  if (respuesta.status === 501) {
    const cuerpo = (await respuesta.json()) as { error: string };
    return { disponible: false, motivo: cuerpo.error };
  }
  if (!respuesta.ok) {
    return { disponible: false, motivo: `/api/actividad respondió ${String(respuesta.status)}` };
  }
  const eventos = (await respuesta.json()) as unknown[];
  return { disponible: true, eventos };
}

export function obtenerProyecto(): Promise<EstadoProyectoActivo> {
  return pedirJson<EstadoProyectoActivo>("/api/proyecto");
}

export function cambiarProyecto(ruta: string): Promise<EstadoProyectoActivo> {
  return pedirJson<EstadoProyectoActivo>("/api/proyecto", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ruta }),
  });
}

export interface ResultadoInit {
  codigo: number | null;
  stdout: string;
  stderr: string;
}

export function ejecutarInit(): Promise<ResultadoInit> {
  return pedirJson<ResultadoInit>("/api/init", { method: "POST" });
}
