import type {
  CambiosConfigGlobal,
  CambiosConfigProyecto,
  ClaveInfo,
  ConfigGlobal,
  ConfigProyectoRespuesta,
  CuerpoCorreccionLocalizador,
  CuerpoExplorar,
  EstadoCorridaActiva,
  EstadoProyecto,
  EstadoProyectoActivo,
  MapaCompleto,
  Proveedor,
  ResultadoCli,
  ResultadoSubproceso,
  RespuestaComando,
  RespuestaCorreccionLocalizador,
  RespuestaExplorar,
  RespuestaMensaje,
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

/** Igual que `pedirJson`, pero usa el `error` del cuerpo (400/404) como mensaje si la petición falla. */
async function pedirJsonEstricto<T>(url: string, init?: RequestInit): Promise<T> {
  const respuesta = await fetch(url, init);
  const cuerpo = (await respuesta.json()) as T & { error?: string };
  if (!respuesta.ok) {
    throw new Error(cuerpo.error ?? `${url} respondió ${String(respuesta.status)}`);
  }
  return cuerpo;
}

/** Para `/api/doctor` y `/api/llm-ping`: el código de salida es parte del resultado a mostrar, no un fallo HTTP a ocultar. */
async function pedirResultado<T>(url: string, init?: RequestInit): Promise<T> {
  const respuesta = await fetch(url, init);
  return (await respuesta.json()) as T;
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

export function obtenerConfigGlobal(): Promise<ConfigGlobal> {
  return pedirJson<ConfigGlobal>("/api/config/global");
}

export function guardarConfigGlobal(cambios: CambiosConfigGlobal): Promise<ConfigGlobal> {
  return pedirJsonEstricto<ConfigGlobal>("/api/config/global", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(cambios),
  });
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

export function obtenerCli(): Promise<ResultadoCli> {
  return pedirJson<ResultadoCli>("/api/cli");
}

export function ejecutarDoctor(): Promise<ResultadoSubproceso> {
  return pedirResultado<ResultadoSubproceso>("/api/doctor", { method: "POST" });
}

export function probarProveedor(body: { provider?: string; model?: string; profile?: string }): Promise<ResultadoSubproceso> {
  return pedirResultado<ResultadoSubproceso>("/api/llm-ping", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

// --- Explorar (Bloque 5): las cuatro puertas al mapeador-mcp, en vivo -----------------

export function obtenerMapa(): Promise<MapaCompleto> {
  return pedirJson<MapaCompleto>("/api/mapa");
}

export function obtenerCorridaActiva(): Promise<EstadoCorridaActiva> {
  return pedirJson<EstadoCorridaActiva>("/api/corridas/activa");
}

// Bloque 7: la única edición inline de toda la web, sobre datos estructurados de map.json.
export function corregirLocalizador(cuerpo: CuerpoCorreccionLocalizador): Promise<RespuestaCorreccionLocalizador> {
  return pedirJsonEstricto<RespuestaCorreccionLocalizador>("/api/mapa/localizador", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
}

export function lanzarExploracion(cuerpo: CuerpoExplorar): Promise<RespuestaExplorar> {
  return pedirJsonEstricto<RespuestaExplorar>("/api/explorar", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
}

export function detenerExploracion(): Promise<{ ok: true }> {
  return pedirJsonEstricto<{ ok: true }>("/api/detener", { method: "POST" });
}

// --- Chat (Bloque 6): hablarle al agente mientras trabaja, o lanzar en lenguaje libre ---------

export function enviarMensaje(texto: string): Promise<RespuestaMensaje> {
  return pedirJsonEstricto<RespuestaMensaje>("/api/mensaje", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ texto }),
  });
}

export function enviarComando(texto: string): Promise<RespuestaComando> {
  return pedirJsonEstricto<RespuestaComando>("/api/comando", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ texto }),
  });
}
