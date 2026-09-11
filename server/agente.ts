// Bloque 4: envuelve `query()` del SDK. `queryFn` es inyectable (mismo patrón que `doctor.ts`)
// para poder testear la traducción de eventos sin lanzar un CLI de verdad.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { query as queryReal } from "@anthropic-ai/claude-agent-sdk";
import type { CanUseTool, PermissionResult, Query, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";

const dirActual = path.dirname(fileURLToPath(import.meta.url));
// tsconfig.server.json no fija rootDir: este fichero compila a dist-server/server/agente.js (conserva
// la estructura de carpetas), dos niveles por debajo de la raíz de ESTE paquete — no uno. skill/ es
// hermana de dist-server/ en esa raíz, nunca relativa al cwd del repo destino.
const rutaSkill = path.resolve(dirActual, "..", "..", "skill");

const ROL_QA =
  "Eres un ingeniero de QA senior. Escribes Playwright en TypeScript. No adivinas cómo es una\npágina: la miras. No declaras terminado lo que no has ejecutado.";

export interface EventoAgente {
  type: string;
  data: unknown;
}

export interface RespuestaPregunta {
  textoLibre?: string;
  opcionesElegidas?: string[];
}

export interface SesionAgente {
  /**
   * Cada llamada crea un suscriptor nuevo e independiente: todos los suscriptores activos reciben
   * el mismo stream completo de eventos (difusión, no reparto). Necesario porque más de una
   * conexión SSE (`GET /api/eventos`) puede leer la misma sesión a la vez, p.ej. tras una
   * reconexión del `EventSource` del cliente que deja viva la conexión huérfana un instante.
   */
  suscribirse(): AsyncIterable<EventoAgente>;
  /** Encola un mensaje nuevo en la sesión activa: el CLI lo atiende en cuanto libera el turno en curso. */
  enviarMensaje(texto: string): void;
  interrumpir(): Promise<void>;
  parar(): void;
  /** Desbloquea el `canUseTool` que quedó pendiente de `AskUserQuestion`. Sin pregunta pendiente, no hace nada. */
  responderPregunta(respuesta: RespuestaPregunta): void;
}

export interface OpcionesLanzar {
  cwd: string;
  queryFn?: typeof queryReal;
}

function mensajeUsuario(texto: string): SDKUserMessage {
  return {
    type: "user",
    message: { role: "user", content: texto },
    parent_tool_use_id: null,
  };
}

/**
 * Cola push genérica respaldada por un array + resolvers pendientes: sirve tanto para el prompt en
 * modo streaming (`enviarMensaje` empuja sin crear una `query()` nueva) como para cada suscriptor
 * individual del canal de eventos (difusión: una cola por suscriptor, ver `crearDifusor`).
 *
 * El iterador expone `return()` (parte del protocolo `AsyncIterator`, invocado por `for await`
 * cuando el consumidor rompe el bucle antes de agotarlo, o al llamarlo explícitamente) para poder
 * cancelar un suscriptor concreto desde fuera — p.ej. cuando la conexión SSE que lo consume se cierra.
 * `alCerrar` es el hook para darlo de baja del `Set` de suscriptores activos del difusor.
 */
function crearCola<T>(alCerrar?: () => void): { iterable: AsyncIterable<T>; push: (valor: T) => void; cerrar: () => void } {
  const pendientes: T[] = [];
  const resolvers: ((resultado: IteratorResult<T>) => void)[] = [];
  let cerrada = false;

  function cerrar() {
    if (cerrada) return;
    cerrada = true;
    for (const resolver of resolvers.splice(0)) {
      resolver({ value: undefined, done: true });
    }
    alCerrar?.();
  }

  return {
    push(valor: T) {
      if (cerrada) return;
      const resolver = resolvers.shift();
      if (resolver) {
        resolver({ value: valor, done: false });
      } else {
        pendientes.push(valor);
      }
    },
    cerrar,
    iterable: {
      [Symbol.asyncIterator]() {
        return {
          next(): Promise<IteratorResult<T>> {
            const siguiente = pendientes.shift();
            if (siguiente !== undefined) return Promise.resolve({ value: siguiente, done: false });
            if (cerrada) return Promise.resolve({ value: undefined, done: true });
            return new Promise((resolve) => resolvers.push(resolve));
          },
          return(): Promise<IteratorResult<T>> {
            cerrar();
            return Promise.resolve({ value: undefined, done: true });
          },
        };
      },
    },
  };
}

/**
 * Difusor de eventos: cada `suscribirse()` crea una cola nueva e independiente; `emitir()` empuja a
 * todas las colas activas en ese momento (fan-out, no reparto); `cerrar()` cierra a todas las
 * suscritas y a cualquiera que llegue después. Reemplaza la cola única compartida que hacía que dos
 * `GET /api/eventos` sobre la misma sesión se repartieran los eventos en vez de ver el stream entero.
 */
function crearDifusor<T>(): { suscribirse: () => AsyncIterable<T>; emitir: (valor: T) => void; cerrar: () => void } {
  const suscriptores = new Set<ReturnType<typeof crearCola<T>>>();
  let cerrado = false;

  return {
    suscribirse() {
      const cola = crearCola<T>(() => suscriptores.delete(cola));
      if (cerrado) {
        cola.cerrar();
      } else {
        suscriptores.add(cola);
      }
      return cola.iterable;
    },
    emitir(valor: T) {
      for (const cola of suscriptores) cola.push(valor);
    },
    cerrar() {
      cerrado = true;
      for (const cola of [...suscriptores]) cola.cerrar();
    },
  };
}

/** Forma de `AskUserQuestion.input`, tal y como la define esa herramienta. */
interface EntradaPreguntaUsuario {
  questions: { question: string; header: string; options: { label: string; description: string }[]; multiSelect?: boolean }[];
}

/** Texto que el modelo recibe como contenido del tool_result denegado (ver comentario en `canUseTool`). */
function formatearRespuestaPregunta(respuesta: RespuestaPregunta): string {
  if (respuesta.opcionesElegidas && respuesta.opcionesElegidas.length > 0) {
    return `El usuario ha respondido: "${respuesta.opcionesElegidas.join('", "')}". Continúa con esa elección.`;
  }
  if (respuesta.textoLibre) {
    return `El usuario ha respondido por texto libre: "${respuesta.textoLibre}". Continúa con esa respuesta.`;
  }
  return "El usuario no ha elegido ninguna opción ni ha escrito texto libre.";
}

export function lanzar(peticionInicial: string, opciones: OpcionesLanzar): SesionAgente {
  const queryFn = opciones.queryFn ?? queryReal;
  const abortController = new AbortController();
  const colaMensajes = crearCola<SDKUserMessage>();
  const difusorEventos = crearDifusor<EventoAgente>();
  colaMensajes.push(mensajeUsuario(peticionInicial));

  // Una única pregunta pendiente a la vez: `responderPregunta` no recibe `requestId` (viene tal
  // cual del body de `POST /api/pregunta/responder`), así que solo puede haber una en vuelo.
  let preguntaPendiente: ((respuesta: RespuestaPregunta) => void) | null = null;

  const canUseTool: CanUseTool = (toolName, input, opcionesTool) => {
    if (toolName !== "AskUserQuestion") {
      return Promise.resolve({ behavior: "allow" });
    }
    const entrada = input as unknown as EntradaPreguntaUsuario;
    difusorEventos.emitir({ type: "agente.pregunta", data: { requestId: opcionesTool.requestId, questions: entrada.questions } });
    return new Promise<PermissionResult>((resolve) => {
      preguntaPendiente = (respuesta) => {
        // `{ behavior: "allow", updatedInput: { questions, answers } }` (lo que pedía el brief) se
        // probó en manual contra pruebas/sauce: el tool_use se resuelve pero el modelo nunca ve la
        // respuesta — termina el turno repitiendo la pregunta como texto plano. AskUserQuestion es
        // un tool de cliente sin tipo publicado (no aparece en sdk.d.ts); nada garantiza que
        // `updatedInput` llegue a su manejador. `behavior: "deny"` con `message` sí es un canal
        // documentado que el modelo lee siempre como contenido del tool_result, así que se usa ese
        // en su lugar — comprobado en manual que el modelo sí recoge y usa la respuesta.
        resolve({ behavior: "deny", message: formatearRespuestaPregunta(respuesta) });
      };
    });
  };

  const q: Query = queryFn({
    prompt: colaMensajes.iterable,
    options: {
      cwd: opciones.cwd,
      abortController,
      mcpServers: { playwright: { command: "npx", args: ["@playwright/mcp@latest"] } },
      plugins: [{ type: "local", path: rutaSkill }],
      skills: ["qa"],
      systemPrompt: { type: "preset", preset: "claude_code", append: ROL_QA },
      // AskUserQuestion NO va aquí: comprobado en manual contra pruebas/sauce, el SDK emite el aviso
      // CLAUDE_SDK_CAN_USE_TOOL_SHADOWED — una entrada "pelada" en allowedTools se auto-aprueba antes
      // de consultar canUseTool, así que nunca llegaría a bloquearse para esperar la respuesta del
      // usuario. Queda fuera de la lista para que "caiga" en canUseTool (sigue disponible: no está en
      // disallowedTools); el resto de tools sí puede quedarse aquí, no necesitan intercepción.
      allowedTools: ["mcp__playwright__*", "Read", "Write", "Edit", "Glob", "Grep", "Bash"],
      canUseTool,
    },
  });

  void (async () => {
    let terminada = false;
    try {
      for await (const mensaje of q) {
        if (mensaje.type === "result") {
          const turnosEncolados = mensaje.queued_turn_count ?? 0;
          if (turnosEncolados > 0) {
            // El CLI ya sabe encadenar el siguiente turno encolado solo: se informa, pero no se cierra.
            difusorEventos.emitir({ type: "agente.turno", data: mensaje });
            continue;
          }
          difusorEventos.emitir({ type: mensaje.is_error ? "operation.error" : "operation.completed", data: mensaje });
          terminada = true;
          break;
        }
        difusorEventos.emitir({ type: `agente.${mensaje.type}`, data: mensaje });
      }
    } catch (error) {
      // `abortController.abort()` (parar()) hace que `q` rechace con un error de "Operation
      // aborted" en vez de terminar limpio: comprobado en manual contra pruebas/sauce — sin este
      // catch, el rechazo queda sin manejar (la promesa de este IIFE es `void`) y tumba el proceso.
      if (!abortController.signal.aborted) {
        difusorEventos.emitir({ type: "operation.error", data: { message: error instanceof Error ? error.message : String(error) } });
        terminada = true;
      }
    } finally {
      if (!terminada) {
        // Solo llega aquí por `parar()` (abort): un fallo real ya ha marcado `terminada` arriba.
        difusorEventos.emitir({ type: "operation.stopped", data: null });
      }
      difusorEventos.cerrar();
      colaMensajes.cerrar();
    }
  })();

  return {
    suscribirse: () => difusorEventos.suscribirse(),
    enviarMensaje(texto: string) {
      colaMensajes.push(mensajeUsuario(texto));
    },
    async interrumpir() {
      await q.interrupt();
    },
    parar() {
      abortController.abort();
    },
    responderPregunta(respuesta: RespuestaPregunta) {
      const resolver = preguntaPendiente;
      if (!resolver) return;
      preguntaPendiente = null;
      resolver(respuesta);
    },
  };
}
