// Bloque 4: envuelve `query()` del SDK. `queryFn` es inyectable (mismo patrón que `doctor.ts`)
// para poder testear la traducción de eventos sin lanzar un CLI de verdad.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { query as queryReal } from "@anthropic-ai/claude-agent-sdk";
import type { CanUseTool, PermissionResult, Query, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { redactarSecretosProfundo, verificarLlamada } from "./barrera.js";
import { textoPoliticaPuertas } from "./puertas.js";
import { leerReporte } from "./reporter.js";
import { registrarEjecucion } from "./costes.js";
import { crearCola, crearDifusor } from "./difusor.js";
import type { PoliticaPuertas } from "../shared/tipos.js";

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
  /** Bloque 5: barrera de escrituras. Sin `barreraActiva`, se comporta como si estuviera apagada. */
  entorno?: string;
  barreraActiva?: boolean;
  listaBlanca?: string[];
  /** Pieza 2 de la spec de puertas de confirmación: cuántas veces para el agente a pedir
   *  confirmación con AskUserQuestion antes de seguir. Sin indicar, se comporta como "escenario"
   *  (una sola parada, tras el escenario). */
  puertas?: PoliticaPuertas;
  /** Reanuda el hilo de conversación anterior (SDK `resume`), en memoria únicamente — si no se
   *  pasa, se lanza una conversación nueva. */
  resume?: string;
  /** Credenciales de prueba de Configuración (`agente-qa.credenciales.json`, nunca versionado): el
   *  agente necesita ver el VALOR para poder escribirlo en un formulario, así que van también al
   *  `system prompt`, no solo al entorno — lo que sí protege `emitirSeguro` es que nunca salgan en
   *  claro por el canal de eventos hacia el navegador (misma redacción de `barrera.ts` que ya
   *  protegía secretos de `process.env`). */
  credenciales?: { nombre: string; valor: string }[];
}

function mensajeUsuario(texto: string): SDKUserMessage {
  return {
    type: "user",
    message: { role: "user", content: texto },
    parent_tool_use_id: null,
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
  const mapaCredenciales = Object.fromEntries((opciones.credenciales ?? []).map((c) => [c.nombre, c.valor]));
  // Todo lo que sale por el difusor pasa antes por la redacción de secretos (Bloque 5, ampliada
  // después del plan con `mapaCredenciales`): ninguna credencial de `process.env` ni de
  // Configuración llega al navegador en claro vía SSE — sí al modelo, que las necesita para actuar.
  const emitirSeguro = (evento: EventoAgente) =>
    difusorEventos.emitir({ ...evento, data: redactarSecretosProfundo(evento.data, process.env, mapaCredenciales) });
  colaMensajes.push(mensajeUsuario(peticionInicial));

  // Una única pregunta pendiente a la vez: `responderPregunta` no recibe `requestId` (viene tal
  // cual del body de `POST /api/pregunta/responder`), así que solo puede haber una en vuelo.
  let preguntaPendiente: ((respuesta: RespuestaPregunta) => void) | null = null;
  // Última URL conocida por navegación (Bloque 5): la barrera la usa para juzgar acciones que no
  // traen la URL en su propio input (click, type...), solo `browser_navigate` la trae.
  let urlActual: string | null = null;

  const canUseTool: CanUseTool = (toolName, input, opcionesTool) => {
    if (toolName.startsWith("mcp__playwright__")) {
      const resultado = verificarLlamada({
        toolName,
        toolInput: input,
        urlActual,
        barreraActiva: opciones.barreraActiva ?? false,
        listaBlanca: opciones.listaBlanca ?? [],
        entorno: opciones.entorno ?? "pruebas",
      });
      if (!resultado.permitir) {
        emitirSeguro({ type: "barrera.bloqueo", data: { toolName, motivo: resultado.motivo } });
        return Promise.resolve({ behavior: "deny", message: resultado.motivo });
      }
      if (toolName === "mcp__playwright__browser_navigate") {
        urlActual = (input as { url?: string }).url ?? urlActual;
      }
    }
    if (toolName !== "AskUserQuestion") {
      return Promise.resolve({ behavior: "allow" });
    }
    const entrada = input as unknown as EntradaPreguntaUsuario;
    emitirSeguro({ type: "agente.pregunta", data: { requestId: opcionesTool.requestId, questions: entrada.questions } });
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

  const appendPuertas = textoPoliticaPuertas(opciones.puertas ?? "escenario");

  const appendCredenciales =
    opciones.credenciales && opciones.credenciales.length > 0
      ? `\n\nCredenciales de prueba disponibles para este proyecto (Configuración → Credenciales) — úsalas cuando la petición las necesite, no las pidas por chat si ya están aquí:\n${opciones.credenciales.map((c) => `- ${c.nombre}: ${c.valor}`).join("\n")}`
      : "";

  const q: Query = queryFn({
    prompt: colaMensajes.iterable,
    options: {
      cwd: opciones.cwd,
      abortController,
      resume: opciones.resume,
      mcpServers: { playwright: { command: "npx", args: ["@playwright/mcp@latest"], env: mapaCredenciales } },
      plugins: [{ type: "local", path: rutaSkill }],
      skills: ["qa"],
      systemPrompt: { type: "preset", preset: "claude_code", append: ROL_QA + appendPuertas + appendCredenciales },
      // Ni AskUserQuestion ni mcp__playwright__* van aquí: comprobado en manual contra pruebas/sauce,
      // el SDK emite el aviso CLAUDE_SDK_CAN_USE_TOOL_SHADOWED — una entrada "pelada" en allowedTools
      // se auto-aprueba antes de consultar canUseTool. Para AskUserQuestion eso impedía bloquearse a
      // esperar la respuesta del usuario; para mcp__playwright__* impedía DEL TODO que la barrera de
      // escrituras (líneas de canUseTool más arriba) se llegara a ejecutar — bug real encontrado
      // probando el paquete instalado desde npm: el propio log del servidor mostraba el aviso
      // nombrando mcp__playwright__*, y la comprobación de lista blanca nunca se invocaba. Los dos
      // quedan fuera de la lista para que "caigan" en canUseTool (siguen disponibles: no están en
      // disallowedTools); el resto de tools sí puede quedarse aquí, no necesitan intercepción.
      allowedTools: ["Read", "Write", "Edit", "Glob", "Grep", "Bash"],
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
            emitirSeguro({ type: "agente.turno", data: mensaje });
            continue;
          }
          emitirSeguro({ type: mensaje.is_error ? "operation.error" : "operation.completed", data: mensaje });
          // Bloque 8: acumula lo que el SDK reportó al cerrar, sin base de datos. Nunca debe tumbar
          // la ejecución: un historial no escrito es peor, pero no tan malo como perder el resultado.
          try {
            const resultados = await leerReporte(opciones.cwd);
            await registrarEjecucion(opciones.cwd, {
              costeUsd: mensaje.total_cost_usd ?? 0,
              duracionMs: mensaje.duration_ms ?? 0,
              numTurnos: mensaje.num_turns ?? 0,
              resultados: resultados.map((r) => ({ nombre: r.nombre, ficheroSpec: r.ficheroSpec, estado: r.estado })),
            });
          } catch (error) {
            console.error("no se pudo registrar el historial de la ejecución", error);
          }
          terminada = true;
          break;
        }
        // Pieza 4 de la spec de puertas: el banner de la consola ("Sesión iniciada" vs.
        // "Conversación reanudada") necesita saber si ESTA sesión se lanzó con `resume` — solo se
        // sabe aquí, no en el propio mensaje `system` del SDK, que es idéntico en los dos casos.
        const datosEvento =
          mensaje.type === "system" ? { ...(mensaje as unknown as Record<string, unknown>), reanudada: Boolean(opciones.resume) } : mensaje;
        emitirSeguro({ type: `agente.${mensaje.type}`, data: datosEvento });
      }
    } catch (error) {
      // `abortController.abort()` (parar()) hace que `q` rechace con un error de "Operation
      // aborted" en vez de terminar limpio: comprobado en manual contra pruebas/sauce — sin este
      // catch, el rechazo queda sin manejar (la promesa de este IIFE es `void`) y tumba el proceso.
      if (!abortController.signal.aborted) {
        emitirSeguro({ type: "operation.error", data: { message: error instanceof Error ? error.message : String(error) } });
        terminada = true;
      }
    } finally {
      if (!terminada) {
        // Solo llega aquí por `parar()` (abort): un fallo real ya ha marcado `terminada` arriba.
        emitirSeguro({ type: "operation.stopped", data: null });
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
