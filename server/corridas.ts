// Bloque 5 de la spec: lanza `agente-qa-mcp <comando> --json` como subproceso de larga duración
// (nunca `execSync`), traduce cada línea NDJSON de su stdout a un evento y guarda el historial de
// la corrida activa para quien se conecte tarde por SSE (`GET /api/eventos`). Una corrida activa
// como máximo por proyecto: una segunda petición se rechaza, nunca mata ni encola la primera.
import path from "node:path";
import type { ChildProcess } from "node:child_process";
import spawnReal from "cross-spawn";
import { localizarCli as localizarCliReal, type ResultadoLocalizarCli } from "./cli.js";
import type { AmbitoExploracion, CuerpoExplorar, EventoNdjson, Puerta } from "../shared/tipos.js";

/**
 * Tiempo de gracia entre escribir `control.stop` en el stdin del subproceso (mismo canal del
 * Bloque 2 de Agente-QA-MCP) y matarlo si no ha terminado por sí solo. 5s: de sobra para que el
 * bucle agéntico cierre su turno actual y escriba `map.json`, corto para que "Detener" en la web
 * no se sienta colgado.
 */
export const TIMEOUT_GRACIA_STOP_MS = 5000;

/** Solo la forma en que `corridas.ts` llama a `spawn`: `cross-spawn` trae además `.sync`, que aquí no se usa. */
type SpawnFn = (comando: string, args: string[], opciones: { cwd: string }) => ChildProcess;

export interface OpcionesCorridas {
  /** Seam de test: evita lanzar el CLI real. */
  spawnFn?: SpawnFn;
  /** Seam de test: evita depender de si `agente-qa-mcp` está instalado de verdad. */
  localizarCli?: () => Promise<ResultadoLocalizarCli>;
}

interface CorridaActiva {
  /** Vacío hasta que llega el primer evento NDJSON: lo asigna el propio CLI, no esta web. */
  runId: string;
  proceso: ChildProcess | null;
  historial: EventoNdjson[];
  suscriptores: Set<(evento: EventoNdjson) => void>;
  /**
   * `true` desde que `detenerCorrida` manda `control.stop`: si el proceso cierra después sin haber
   * emitido su propio evento terminal, el cierre se sintetiza como `operation.stopped` en vez de
   * `operation.error` (revisión final de rama, hallazgo 1).
   */
  detencionSolicitada: boolean;
}

const corridasPorProyecto = new Map<string, CorridaActiva>();

function claveProyecto(proyecto: string): string {
  return path.resolve(proyecto);
}

export function hayCorridaActiva(proyecto: string): boolean {
  return corridasPorProyecto.has(claveProyecto(proyecto));
}

export function runIdActivo(proyecto: string): string | null {
  const corrida = corridasPorProyecto.get(claveProyecto(proyecto));
  return corrida && corrida.runId !== "" ? corrida.runId : null;
}

/** Historial acumulado de la corrida activa, para quien se conecte tarde al SSE. `[]` si no hay ninguna. */
export function historialActivo(proyecto: string): EventoNdjson[] {
  return corridasPorProyecto.get(claveProyecto(proyecto))?.historial ?? [];
}

/** Se suscribe a los eventos futuros de la corrida activa. `null` si no hay ninguna. Devuelve cómo desuscribirse. */
export function suscribirseAEventos(proyecto: string, cb: (evento: EventoNdjson) => void): (() => void) | null {
  const corrida = corridasPorProyecto.get(claveProyecto(proyecto));
  if (!corrida) return null;
  corrida.suscriptores.add(cb);
  return () => corrida.suscriptores.delete(cb);
}

/** Exportado: `app.ts` lo reutiliza en `GET /api/eventos` para cerrar las conexiones SSE de una
 * corrida ya terminada (revisión final de rama, hallazgo 3) en vez de duplicar el catálogo. */
export const TIPOS_FIN_CORRIDA = new Set(["operation.completed", "operation.stopped", "operation.error"]);

export type ResultadoLanzarCorrida = { ok: true; runId: string } | { ok: false; motivo: string };

/**
 * Lanza `<cli> ...args` en `cwd = proyecto`. Rechaza si ya hay una corrida activa para ese
 * proyecto — la comprobación y la reserva del hueco son síncronas (antes del primer `await`) para
 * que dos lanzamientos concurrentes no se cuelen los dos.
 */
export async function lanzarCorrida(proyecto: string, args: string[], opciones: OpcionesCorridas = {}): Promise<ResultadoLanzarCorrida> {
  const clave = claveProyecto(proyecto);
  if (corridasPorProyecto.has(clave)) {
    return { ok: false, motivo: "Ya hay una corrida activa para este proyecto. Detenla antes de lanzar otra." };
  }

  const corrida: CorridaActiva = { runId: "", proceso: null, historial: [], suscriptores: new Set(), detencionSolicitada: false };
  corridasPorProyecto.set(clave, corrida);

  const localizar = opciones.localizarCli ?? localizarCliReal;
  const localizado = await localizar();
  if (!localizado.encontrado) {
    corridasPorProyecto.delete(clave);
    return { ok: false, motivo: `No se encontró el binario "agente-qa-mcp":\n${localizado.diagnostico.join("\n")}` };
  }

  const spawnFn = opciones.spawnFn ?? spawnReal;
  const proceso = spawnFn(localizado.cli.comando, [...localizado.cli.argsPrevios, ...args], { cwd: proyecto });
  corrida.proceso = proceso;

  return new Promise((resolve) => {
    let resuelto = false;
    let bufer = "";
    // Hallazgo 1 de la revisión final de rama: si el proceso cierra sin haber emitido ya un
    // evento terminal real (p.ej. la puerta "instantanea", cuyo `snapshot.ts` no lee `control.stop`
    // del stdin), esta web sintetiza uno propio para que los suscriptores SSE (y por tanto
    // `Explorar.tsx`) se enteren de que la corrida acabó en vez de quedarse "corriendo" para siempre.
    let finReal = false;

    function limpiar(): void {
      if (corridasPorProyecto.get(clave) === corrida) {
        corridasPorProyecto.delete(clave);
      }
    }

    function difundir(evento: EventoNdjson): void {
      corrida.historial.push(evento);
      for (const cb of corrida.suscriptores) cb(evento);
    }

    function resolverError(motivo: string): void {
      if (resuelto) return;
      resuelto = true;
      limpiar();
      resolve({ ok: false, motivo });
    }

    proceso.stdout?.on("data", (chunk: Buffer) => {
      bufer += chunk.toString();
      const lineas = bufer.split("\n");
      bufer = lineas.pop() ?? "";
      for (const linea of lineas) {
        const recortada = linea.trim();
        if (!recortada) continue;
        let evento: EventoNdjson;
        try {
          evento = JSON.parse(recortada) as EventoNdjson;
        } catch {
          // Comandos sin --json (doctor, metrics, config...) imprimen texto humano: se reenvía
          // igual como línea de registro cruda en vez de descartarla en silencio.
          evento = { runId: corrida.runId, ts: new Date().toISOString(), agent: "web", type: "raw.stdout", data: { linea: recortada } };
        }

        if (corrida.runId === "" && evento.runId) {
          corrida.runId = evento.runId;
        }
        if (!resuelto) {
          resuelto = true;
          resolve({ ok: true, runId: corrida.runId });
        }

        difundir(evento);
        if (TIPOS_FIN_CORRIDA.has(evento.type)) {
          finReal = true;
          limpiar();
        }
      }
    });

    proceso.on("error", (err) => {
      resolverError(`No se pudo lanzar el CLI: ${err.message}`);
    });

    proceso.on("close", () => {
      if (!finReal) {
        // El proceso murió (crash o fin de la puerta) sin pasar por el evento terminal de arriba:
        // se sintetiza uno y se difunde a los suscriptores ANTES de limpiar el estado, para que
        // nadie se quede "corriendo" para siempre esperando un evento que nunca va a llegar.
        difundir({
          runId: corrida.runId,
          ts: new Date().toISOString(),
          agent: "web",
          type: corrida.detencionSolicitada ? "operation.stopped" : "operation.error",
          data: corrida.detencionSolicitada
            ? { motivo: "Se pidió detener la corrida y el proceso terminó, pero no confirmó su estado final." }
            : { motivo: "El proceso terminó sin reportar su estado final." },
        });
        finReal = true;
      }
      resolverError("El proceso terminó sin emitir ningún evento.");
      limpiar();
    });
  });
}

type ResultadoEscribirComando = { ok: true } | { ok: false; motivo: string };

/**
 * Escribe un comando NDJSON en el stdin del subproceso activo (canal del Bloque 2 de
 * Agente-QA-MCP): `detenerCorrida` lo usa para `control.stop`, `enviarMensaje` para
 * `user.message`. `ok: false` si no hay corrida activa para el proyecto — nunca lanza.
 */
function escribirComando(proyecto: string, comando: object): ResultadoEscribirComando {
  const corrida = corridasPorProyecto.get(claveProyecto(proyecto));
  if (!corrida?.proceso) {
    return { ok: false, motivo: "No hay ninguna corrida activa para este proyecto." };
  }
  corrida.proceso.stdin?.write(`${JSON.stringify(comando)}\n`);
  return { ok: true };
}

export type ResultadoDetenerCorrida = { ok: true } | { ok: false; motivo: string };

/**
 * Manda `control.stop` por el stdin del subproceso (canal del Bloque 2) y arma un temporizador de
 * gracia: si el proceso no ha terminado solo, se mata. Nunca mata de entrada.
 */
export function detenerCorrida(proyecto: string): ResultadoDetenerCorrida {
  const corrida = corridasPorProyecto.get(claveProyecto(proyecto));
  if (!corrida?.proceso) {
    return { ok: false, motivo: "No hay ninguna corrida activa para este proyecto." };
  }

  corrida.detencionSolicitada = true;
  escribirComando(proyecto, { type: "control.stop" });

  const proceso = corrida.proceso;
  const temporizador = setTimeout(() => {
    proceso.kill();
  }, TIMEOUT_GRACIA_STOP_MS);
  proceso.once("close", () => {
    clearTimeout(temporizador);
  });

  return { ok: true };
}

export type ResultadoEnviarMensaje = { ok: true } | { ok: false; motivo: string };

/**
 * Manda `user.message` por el stdin de la corrida activa (mismo canal que `control.stop`): el
 * bucle agéntico lo recoge en su siguiente turno. `ok: false` con motivo explícito si no hay
 * corrida activa — la ruta que llama a esto decide entonces si lanza una nueva (Bloque 6).
 */
export function enviarMensaje(proyecto: string, texto: string): ResultadoEnviarMensaje {
  return escribirComando(proyecto, { type: "user.message", text: texto });
}

/** Traduce puerta + ámbito + objetivo a los argumentos reales del CLI, según la tabla de la spec. */
export function construirArgsCorrida(cuerpo: CuerpoExplorar): { ok: true; args: string[] } | { ok: false; motivo: string } {
  const puerta: Puerta = cuerpo.puerta;

  switch (puerta) {
    case "instantanea": {
      if (!cuerpo.url) return { ok: false, motivo: 'La puerta "instantanea" necesita "url".' };
      return { ok: true, args: ["snapshot", cuerpo.url, "--json"] };
    }
    case "grabacion-humana": {
      if (!cuerpo.url) return { ok: false, motivo: 'La puerta "grabacion-humana" necesita "url".' };
      return { ok: true, args: ["record", cuerpo.url, "--json"] };
    }
    case "grabacion-conducida": {
      if (!cuerpo.url) return { ok: false, motivo: 'La puerta "grabacion-conducida" necesita "url".' };
      if (!cuerpo.objetivo) return { ok: false, motivo: 'La puerta "grabacion-conducida" necesita "objetivo".' };
      return { ok: true, args: ["record", cuerpo.url, "--auto", cuerpo.objetivo, "--json"] };
    }
    case "bucle-agentico": {
      const ambito: AmbitoExploracion | undefined = cuerpo.ambito;
      if (!ambito) return { ok: false, motivo: 'La puerta "bucle-agentico" necesita "ambito".' };
      if (ambito === "todo") return { ok: true, args: ["map", "--all", "--json"] };
      if (ambito === "seleccion") {
        if (!cuerpo.unidades || cuerpo.unidades.length === 0) {
          return { ok: false, motivo: 'El ámbito "seleccion" necesita al menos una pantalla en "unidades".' };
        }
        return { ok: true, args: ["map", "--units", cuerpo.unidades.join(","), "--json"] };
      }
      // ambito === "objetivo"
      if (!cuerpo.objetivo) return { ok: false, motivo: 'El ámbito "objetivo" necesita "objetivo".' };
      return { ok: true, args: ["map", "--goal", cuerpo.objetivo, "--json"] };
    }
    case "run": {
      // Puerta del Bloque 6: `run "<texto>" --json` (ver `agente-qa-mcp/src/cli/commands/run.ts`).
      // Sin `--url` ni el resto de flags opcionales: `run` cae a la URL de `config.json` si falta.
      if (!cuerpo.texto) return { ok: false, motivo: 'La puerta "run" necesita "texto".' };
      return { ok: true, args: ["run", cuerpo.texto, "--json"] };
    }
  }
}
