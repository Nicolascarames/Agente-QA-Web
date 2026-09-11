import type {
  CambiosConfigProyecto,
  ClaveInfo,
  ConfigProyectoRespuesta,
  EstadoCorridaActiva,
  EstadoProyecto,
  EstadoProyectoActivo,
  Proveedor,
  RespuestaComando,
} from "../shared/tipos";

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

export interface ResultadoInit {
  codigo: number | null;
  stdout: string;
  stderr: string;
}

export function ejecutarInit(): Promise<ResultadoInit> {
  return pedirJson<ResultadoInit>("/api/init", { method: "POST" });
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

export function obtenerConfigProyecto(): Promise<ConfigProyectoRespuesta> {
  return pedirJson<ConfigProyectoRespuesta>("/api/config/proyecto");
}

export function guardarConfigProyecto(cambios: CambiosConfigProyecto): Promise<ConfigProyectoRespuesta> {
  return pedirJsonEstricto<ConfigProyectoRespuesta>("/api/config/proyecto", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(cambios),
  });
}

export function verCredencialProyecto(campo: "usuario" | "password"): Promise<{ valor: string }> {
  return pedirJsonEstricto<{ valor: string }>(`/api/config/proyecto/credenciales/${campo}/ver`, { method: "POST" });
}

export function obtenerClaves(): Promise<ClaveInfo[]> {
  return pedirJson<ClaveInfo[]>("/api/claves");
}

export function guardarClave(proveedor: Proveedor, valor: string, capa: "proyecto" | "global"): Promise<ClaveInfo[]> {
  return pedirJsonEstricto<ClaveInfo[]>(`/api/claves/${proveedor}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ valor, capa }),
  });
}

export function verClaveCompleta(proveedor: Proveedor): Promise<{ valor: string }> {
  return pedirJsonEstricto<{ valor: string }>(`/api/claves/${proveedor}/ver`, { method: "POST" });
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
