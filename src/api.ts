import type { ConfigRaiz, EstadoCorridaActiva, EstadoProyecto, EstadoProyectoActivo, RespuestaComando } from "../shared/tipos";

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

/** Alcance: una instancia por repo (decisión cerrada en ESTADO.md) — sin selector ni recientes. */
export function obtenerProyecto(): Promise<EstadoProyectoActivo> {
  return pedirJson<EstadoProyectoActivo>("/api/proyecto");
}

// --- Config raíz (Bloque 5: entorno, barrera, lista blanca) -----------------------------------

export function obtenerConfig(): Promise<ConfigRaiz> {
  return pedirJson<ConfigRaiz>("/api/config");
}

export function guardarConfig(parcial: Partial<ConfigRaiz>): Promise<ConfigRaiz> {
  return pedirJsonEstricto<ConfigRaiz>("/api/config", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(parcial),
  });
}

/** Igual que `pedirJson`, pero usa el `error` del cuerpo (400/404) como mensaje si la petición falla. */
async function pedirJsonEstricto<T>(url: string, init?: RequestInit): Promise<T> {
  const respuesta = await fetch(url, init);
  const cuerpo = (await respuesta.json()) as T & { error?: string };
  if (!respuesta.ok) {
    throw new Error(cuerpo.error ?? `${url} respondió ${String(respuesta.status)}`);
  }
  return cuerpo;
}

// --- Consola global (Bloque 2: vaciada) — la caja de texto sigue viva, el agente llega en el Bloque 4 --

export function obtenerCorridaActiva(): Promise<EstadoCorridaActiva> {
  return pedirJson<EstadoCorridaActiva>("/api/corridas/activa");
}

export function enviarComando(texto: string): Promise<RespuestaComando> {
  return pedirJsonEstricto<RespuestaComando>("/api/comando", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ texto }),
  });
}

export function pararCorrida(): Promise<void> {
  return pedirJsonEstricto<void>("/api/parar", { method: "POST" });
}

export function interrumpirCorrida(): Promise<void> {
  return pedirJsonEstricto<void>("/api/interrumpir", { method: "POST" });
}

export function responderPregunta(respuesta: { textoLibre?: string; opcionesElegidas?: string[] }): Promise<void> {
  return pedirJsonEstricto<void>("/api/pregunta/responder", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(respuesta),
  });
}
