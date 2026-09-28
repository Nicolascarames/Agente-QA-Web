import { useEffect, useRef, useState } from "react";
import { Panel } from "./Panel";
import { enviarComando, interrumpirCorrida, nuevaConversacion, pararCorrida, responderPregunta } from "./api";
import { esEventoTerminal } from "../shared/eventos";
import { pestanaParaRuta, type PestanaDestino } from "./pestanaParaRuta";
import type { EventoNdjson } from "../shared/tipos";

interface OpcionPregunta {
  label: string;
  description: string;
}

interface PreguntaAgente {
  requestId?: unknown;
  questions: { question: string; header: string; options: OpcionPregunta[]; multiSelect?: boolean }[];
}

function serializarDatos(data: unknown): string {
  return typeof data === "string" ? data : JSON.stringify(data);
}

/** Nombre del `CustomEvent` con el que otra pestaña (p.ej. Redactar) le pide a esta consola que
 *  envíe un texto, sin tener referencia a ella — está montada aparte, siempre visible. */
export const EVENTO_COMANDO_EXTERNO = "agente-qa:comando";

/** Dispara `EVENTO_COMANDO_EXTERNO`: lo escucha `ConsolaGlobal` y lo envía como si lo hubiera
 *  escrito el usuario, con eco en el chat incluido. */
export function pedirAlAgente(texto: string): void {
  window.dispatchEvent(new CustomEvent(EVENTO_COMANDO_EXTERNO, { detail: { texto } }));
}

interface BloqueContenidoAsistente {
  type: string;
  text?: string;
  name?: string;
  input?: unknown;
  id?: string;
}

/** Forma real de un bloque `tool_result` dentro de `message.content` de un `agente.user`
 *  (`ToolResultBlockParam` del SDK): `content` es el texto que ve el modelo, no el `tool_use_result`
 *  estructurado — ese si es JSON crudo por tool y por eso no se usa aquí. */
interface BloqueResultadoHerramienta {
  type: string;
  tool_use_id?: string;
  content?: unknown;
  is_error?: boolean;
}

function textoDeContenidoToolResult(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((b): b is { type?: string; text?: string } => typeof b === "object" && b !== null)
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text as string)
      .join("\n");
  }
  return "";
}

/** Resumen de una línea de un `tool_result`, en vez de la línea muda "agente.user" (ruido puro en
 *  ejecuciones largas: una por cada llamada a herramienta) o el objeto entero. Antepone el nombre de
 *  la herramienta cuando se conoce (correlado por `tool_use_id` con el `tool_use` que lo pidió). */
export function resumenResultadoHerramienta(bloque: BloqueResultadoHerramienta, nombreHerramienta?: string): string {
  const prefijo = nombreHerramienta ? `${nombreHerramienta}: ` : "";
  const contenidoTexto = textoDeContenidoToolResult(bloque.content).trim();
  const lineas = contenidoTexto.split("\n").filter((linea) => linea.length > 0);
  if (bloque.is_error) return `← ${prefijo}error: ${lineas[0] || "sin detalle"}`;
  if (lineas.length === 0) return `← ${prefijo}ok`;
  // Una sola línea se enseña tal cual (el caso común: un Read, un Bash con una línea de salida).
  // Con varias, mostrar solo la primera se lee como si hubiera devuelto un único resultado — un
  // Glob de tres ficheros se pintaba igual que uno de uno solo. Contar es más honesto que elegir.
  if (lineas.length === 1) return `← ${prefijo}${lineas[0]}`;
  return `← ${prefijo}${String(lineas.length)} resultados`;
}

/** `{ id, nombre }` de cada `tool_use` de un `agente.assistant`, para poder nombrar su `tool_result`
 *  (que llega después, como `agente.user`, correlado solo por `tool_use_id`) — sin esto el resumen
 *  de resultado no sabría si fue un `Glob` o un `Bash`. */
export function extraerToolUseIds(evento: EventoNdjson): { id: string; nombre: string }[] {
  if (evento.type !== "agente.assistant") return [];
  const contenido = (evento.data as { message?: { content?: unknown } } | undefined)?.message?.content;
  if (!Array.isArray(contenido)) return [];
  return (contenido as BloqueContenidoAsistente[])
    .filter((b): b is BloqueContenidoAsistente & { id: string } => b.type === "tool_use" && typeof b.id === "string")
    .map((b) => ({ id: b.id, nombre: b.name ?? "?" }));
}

const NOMBRES_HERRAMIENTA_ESCRITURA = new Set(["Write", "Edit"]);

/** Ruta del último fichero que el agente escribió o modificó (`Write`/`Edit`) EN ESTE TURNO que
 *  mapea a alguna pestaña, buscando hacia atrás en `eventos` — para saber a qué pestaña saltar
 *  cuando llega la pregunta de confirmación (Pieza 3). `eventos` acumula toda la conversación
 *  (`useCorridaGlobal.ts`), así que el escaneo se corta en el `usuario.mensaje` más reciente (el
 *  límite de turno: lo pone tanto un mensaje nuevo como la respuesta a una pregunta anterior, ver
 *  `responder()` más abajo) para no saltar a un fichero de un turno viejo. Ignora también
 *  escrituras que no mapean a ninguna pestaña (p.ej. `tests/setup/*.setup.ts`) y sigue buscando
 *  más atrás dentro del mismo turno, en vez de rendirse en la primera que no encaja. `null` si no
 *  hay ninguna escritura relevante en el turno actual. */
export function rutaUltimoFicheroEscrito(eventos: EventoNdjson[]): string | null {
  for (let i = eventos.length - 1; i >= 0; i -= 1) {
    const evento = eventos[i];
    if (evento.type === "usuario.mensaje") break;
    if (evento.type !== "agente.assistant") continue;
    const contenido = (evento.data as { message?: { content?: unknown } } | undefined)?.message?.content;
    if (!Array.isArray(contenido)) continue;
    const bloques = contenido as BloqueContenidoAsistente[];
    for (let j = bloques.length - 1; j >= 0; j -= 1) {
      const bloque = bloques[j];
      if (bloque.type === "tool_use" && bloque.name && NOMBRES_HERRAMIENTA_ESCRITURA.has(bloque.name)) {
        const rutaFichero = (bloque.input as { file_path?: unknown } | undefined)?.file_path;
        if (typeof rutaFichero === "string" && pestanaParaRuta(rutaFichero)) return rutaFichero;
      }
    }
  }
  return null;
}

/** La última `agente.pregunta` aún sin responder, buscando hacia atrás: no exige que sea el último
 *  evento, porque detrás de ella pueden llegar eventos que la consola no pinta (`rate_limit_event`,
 *  hooks) y con ellos los botones no salían nunca — el texto libre se enviaba como comando nuevo y
 *  `canUseTool` se quedaba bloqueado. La cortan un `usuario.mensaje` (la respuesta) o un evento
 *  terminal. */
export function preguntaSinResponder(eventos: EventoNdjson[]): PreguntaAgente | null {
  for (let i = eventos.length - 1; i >= 0; i -= 1) {
    const evento = eventos[i];
    if (evento.type === "usuario.mensaje" || esEventoTerminal(evento.type)) return null;
    if (evento.type === "agente.pregunta") return evento.data as PreguntaAgente;
  }
  return null;
}

/** Un `tool_use` legible: nombre + sus parámetros — sin esto no se puede saber desde la consola,
 *  p.ej., si `browser_snapshot` se llamó con `target` o sin él (deuda técnica abierta del proyecto). */
export function formatearParametrosHerramienta(input: unknown): string {
  if (!input || typeof input !== "object" || Array.isArray(input)) return "";
  const entradas = Object.entries(input as Record<string, unknown>);
  if (entradas.length === 0) return "";
  return entradas.map(([clave, valor]) => `${clave}: ${typeof valor === "string" ? valor : JSON.stringify(valor)}`).join(", ");
}

/** Texto (concatenado) de los bloques `text` de un mensaje `agente.assistant`, o `null` si el
 *  evento no es de ese tipo o no trae texto — sirve para detectar cuándo `result` del bloque de fin
 *  de turno repite palabra por palabra lo que ya se pintó como burbuja del asistente. */
export function extraerTextoAsistente(evento: EventoNdjson): string | null {
  if (evento.type !== "agente.assistant") return null;
  const contenido = (evento.data as { message?: { content?: unknown } } | undefined)?.message?.content;
  if (!Array.isArray(contenido)) return null;
  const texto = (contenido as BloqueContenidoAsistente[])
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text)
    .join("\n");
  return texto || null;
}

/** Forma del `usage` de un mensaje `agente.assistant` (`BetaMessage.usage` del SDK): solo los tres
 *  campos que cuentan para "cuánto va a releer el próximo paso" — no output_tokens, que no vuelve
 *  a entrar en el prompt. */
interface UsoTokens {
  input_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

/** Tamaño del contexto en el ÚLTIMO `agente.assistant` con `usage` conocido, o `null` sin ninguno
 *  todavía. Cada paso del agente relee TODO el contexto acumulado — este número es justo lo que se
 *  vuelve a pagar en el siguiente turno, de ahí el aviso cuando crece demasiado (ver botón "Nueva
 *  conversación" más abajo). */
export function tokensContextoActual(eventos: EventoNdjson[]): number | null {
  for (let i = eventos.length - 1; i >= 0; i -= 1) {
    const evento = eventos[i];
    if (evento.type !== "agente.assistant") continue;
    const usage = (evento.data as { message?: { usage?: UsoTokens } } | undefined)?.message?.usage;
    if (!usage) continue;
    return (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
  }
  return null;
}

/** Resumen legible de un evento `agente.system` (mensaje `system` del SDK), o `null` si es puro
 *  andamiaje (hooks de arranque/fin de turno, progreso interno) que no aporta nada a una persona
 *  leyendo la consola y por tanto no se pinta. `init` sí se resume — sin enumerar el catálogo
 *  completo de herramientas MCP, solo cuántas hay. */
export function resumenEventoSistema(data: unknown): string | null {
  const d = (data ?? {}) as { subtype?: string; model?: string; tools?: unknown[]; reanudada?: boolean };
  if (d.subtype === "init") {
    const numHerramientas = Array.isArray(d.tools) ? d.tools.length : 0;
    const encabezado = d.reanudada ? "Conversación reanudada" : "Sesión iniciada";
    return `${encabezado} — modelo ${d.model ?? "desconocido"}, ${String(numHerramientas)} herramientas disponibles.`;
  }
  return null;
}

/** Texto del bloque resaltado de fin de turno. Bug real: `result` del mensaje `result` del SDK trae
 *  el mismo texto que ya emitió el último `agente.assistant` como burbuja — pintarlo tal cual lo
 *  duplica en pantalla. Si coincide con lo último dicho por el asistente se sustituye por un
 *  genérico; si no coincide (típicamente un error, que no viene de ningún bloque de texto previo) se
 *  conserva, porque ahí sí es información nueva. */
export function textoBloqueFinal(evento: EventoNdjson, ultimoTextoAsistente: string | null): string {
  const esError = evento.type === "operation.error";
  const { result, subtype, total_cost_usd } = (evento.data as { result?: string; subtype?: string; total_cost_usd?: number } | undefined) ?? {};
  // El SDK para en seco al superar `maxBudgetUsd` (server/agente.ts): sin esta rama, el mensaje
  // genérico de error no dice por qué se paró ni dónde se sube el tope.
  if (subtype === "error_max_budget_usd") {
    const presupuesto = typeof total_cost_usd === "number" ? total_cost_usd.toFixed(2) : "?";
    return `Parado: se alcanzó el tope de gasto de ${presupuesto} $ de esta petición (Configuración → Modelo y gasto).`;
  }
  if (esError) return result ?? "Ha ocurrido un error — mira el detalle.";
  if (result && result === ultimoTextoAsistente) return "Terminado.";
  return result ?? "Terminado.";
}

/** Cómo pintar un evento: una lista (un `agente.assistant` puede traer varios bloques) de
 *  instrucciones de render puras, sin JSX — así se pueden testear sin montar React. Ningún tipo de
 *  evento sin rama propia cae ya en un volcado JSON: el `default` es una línea corta con el tipo. */
export type ItemLinea =
  | { tipo: "usuario"; texto: string }
  | { tipo: "textoAsistente"; texto: string }
  | { tipo: "usoHerramienta"; nombre: string; parametros: string }
  | { tipo: "resultadoHerramienta"; texto: string }
  | { tipo: "finTurno"; error: boolean; texto: string }
  | { tipo: "rawStdout"; texto: string }
  | { tipo: "corto"; etiqueta: string; ts: string; agent: string };

export function describirEvento(
  evento: EventoNdjson,
  ultimoTextoAsistente: string | null,
  nombresPorToolUseId: Record<string, string> = {}
): ItemLinea[] {
  if (evento.type === "raw.stdout") {
    const datos = evento.data as { linea?: unknown };
    const linea = typeof datos?.linea === "string" ? datos.linea : serializarDatos(evento.data);
    return [{ tipo: "rawStdout", texto: linea }];
  }
  if (evento.type === "usuario.mensaje") {
    const { texto } = evento.data as { texto: string };
    return [{ tipo: "usuario", texto }];
  }
  if (evento.type === "agente.assistant") {
    const contenido = (evento.data as { message?: { content?: unknown } } | undefined)?.message?.content;
    if (!Array.isArray(contenido) || contenido.length === 0) {
      return [{ tipo: "corto", etiqueta: evento.type, ts: evento.ts, agent: evento.agent }];
    }
    const items: ItemLinea[] = [];
    for (const bloque of contenido as BloqueContenidoAsistente[]) {
      if (bloque.type === "text" && bloque.text) {
        items.push({ tipo: "textoAsistente", texto: bloque.text });
      } else if (bloque.type === "tool_use") {
        items.push({ tipo: "usoHerramienta", nombre: bloque.name ?? "?", parametros: formatearParametrosHerramienta(bloque.input) });
      }
    }
    return items;
  }
  if (evento.type === "operation.completed" || evento.type === "operation.error") {
    return [{ tipo: "finTurno", error: evento.type === "operation.error", texto: textoBloqueFinal(evento, ultimoTextoAsistente) }];
  }
  if (evento.type === "agente.system") {
    const resumen = resumenEventoSistema(evento.data);
    return resumen ? [{ tipo: "corto", etiqueta: resumen, ts: evento.ts, agent: evento.agent }] : [];
  }
  // Andamiaje del SDK, igual que los hooks de `agente.system`: informa a herramientas de
  // orquestación, no a la persona que lee la consola.
  if (evento.type === "agente.rate_limit_event") {
    return [];
  }
  if (evento.type === "agente.user") {
    const contenido = (evento.data as { message?: { content?: unknown } } | undefined)?.message?.content;
    const bloquesResultado = Array.isArray(contenido)
      ? (contenido as BloqueResultadoHerramienta[]).filter((b) => b.type === "tool_result")
      : [];
    // La mayoría de `agente.user` son tool_result — pero no todos por contrato del SDK ("chiefly"),
    // así que sin ninguno cae al mismo corto genérico que cualquier tipo sin rama propia.
    if (bloquesResultado.length === 0) {
      return [{ tipo: "corto", etiqueta: evento.type, ts: evento.ts, agent: evento.agent }];
    }
    return bloquesResultado.map((bloque) => ({
      tipo: "resultadoHerramienta",
      texto: resumenResultadoHerramienta(bloque, bloque.tool_use_id ? nombresPorToolUseId[bloque.tool_use_id] : undefined),
    }));
  }
  return [{ tipo: "corto", etiqueta: evento.type, ts: evento.ts, agent: evento.agent }];
}

function LineaItem({ item }: { item: ItemLinea }) {
  switch (item.tipo) {
    case "usuario":
      return (
        <li className="ml-auto max-w-[80%] rounded-7 border border-accent bg-accent-bg px-2.5 py-1.5 text-xs text-text-bright">
          {item.texto}
        </li>
      );
    case "textoAsistente":
      return (
        <li className="max-w-[80%] rounded-7 border border-ok bg-ok-bg px-2.5 py-1.5 text-xs text-text-bright">
          {item.texto}
        </li>
      );
    case "usoHerramienta":
      return (
        <li className="text-2xs text-text-dim">
          → usando {item.nombre}
          {item.parametros ? `(${item.parametros})` : ""}
        </li>
      );
    case "resultadoHerramienta":
      return <li className="text-2xs text-text-dim">{item.texto}</li>;
    case "finTurno":
      return (
        <li
          className={`rounded-7 border px-2.5 py-1.5 text-xs font-semibold ${
            item.error ? "border-danger bg-bg-sunken text-danger" : "border-accent bg-accent-bg text-text-bright"
          }`}
        >
          {item.texto}
        </li>
      );
    case "rawStdout":
      return <li className="text-xs text-text-dim">{item.texto}</li>;
    case "corto":
      return (
        <li className="text-2xs text-text-faint">
          <span className="text-text-ghost">{item.ts}</span> <span className="text-accent-soft">{item.etiqueta}</span>{" "}
          <span className="text-text-faint">[{item.agent}]</span>
        </li>
      );
  }
}

export interface ConsolaGlobalProps {
  corridaActiva: string | null;
  eventos: EventoNdjson[];
  marcarCorridaActiva: (etiqueta: string | null) => void;
  agregarMensajeUsuario: (texto: string) => void;
  /** Vacía el historial de eventos (vive en `useCorridaGlobal`). Sin pasarla, «Nueva conversación»
   *  solo corta el `resume` y deja el chat a la vista. */
  vaciarEventos?: () => void;
  /** Empezar (Bloque «primeros pasos»): texto que otra pestaña quiere dejar escrito aquí sin
   *  enviarlo. `null` cuando no hay nada pendiente — App.tsx es quien lo posee, esta consola no
   *  conoce a quien lo pide. */
  borradorConsola: string | null;
  onBorradorAplicado: () => void;
  /** Pieza 3: a qué pestaña saltar cuando llega una pregunta de confirmación sobre un fichero que
   *  el agente acaba de escribir bajo tests/. Sin pasarla, la consola simplemente no salta de
   *  pestaña — no rompe nada. */
  onAbrirPestana?: (pestana: PestanaDestino) => void;
}

/**
 * Bloque 4: la caja de texto lanza el agente de verdad vía el SDK. Enviar ya no bloquea si hay una
 * corrida activa — encola en la misma sesión (el CLI la atiende al terminar el turno en curso).
 */
export function ConsolaGlobal({
  corridaActiva,
  eventos,
  marcarCorridaActiva,
  agregarMensajeUsuario,
  vaciarEventos,
  borradorConsola,
  onBorradorAplicado,
  onAbrirPestana,
}: ConsolaGlobalProps) {
  const [comando, setComando] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [preguntaPendiente, setPreguntaPendiente] = useState<PreguntaAgente | null>(null);
  // Opción con el foco del teclado en la pregunta activa: arranca en la primera (la que el propio
  // modelo suele poner primero suele ser la recomendada, ver convención de AskUserQuestion).
  const [opcionEnfocada, setOpcionEnfocada] = useState(0);
  const listaRef = useRef<HTMLUListElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Solo saltar de pestaña la primera vez que se ve CADA pregunta (por requestId): si ya se saltó
  // y el usuario ha vuelto a otra pestaña a propósito, un re-render no debe arrastrarlo de vuelta.
  const requestIdAbierto = useRef<unknown>(undefined);

  // El botón "Escribir el ejemplo en la consola" de Empezar rellena esta caja sin enviarla: solo
  // escribe, enfoca y avisa a App.tsx para que limpie el borrador (si no, se reescribiría en cada
  // render).
  useEffect(() => {
    if (borradorConsola === null) return;
    setComando(borradorConsola);
    inputRef.current?.focus();
    onBorradorAplicado();
  }, [borradorConsola, onBorradorAplicado]);

  // La última pregunta sin responder, si la hay: el propio `canUseTool` del agente queda bloqueado
  // hasta que se llame a `responderPregunta`, así que basta con quedarse con la más reciente.
  useEffect(() => {
    const pregunta = preguntaSinResponder(eventos);
    if (!pregunta) return;
    setPreguntaPendiente(pregunta);
    if (pregunta.requestId === requestIdAbierto.current) return;
    requestIdAbierto.current = pregunta.requestId;
    setOpcionEnfocada(0);
    const ruta = rutaUltimoFicheroEscrito(eventos);
    const pestana = ruta ? pestanaParaRuta(ruta) : null;
    if (pestana) onAbrirPestana?.(pestana);
  }, [eventos, onAbrirPestana]);

  useEffect(() => {
    if (!corridaActiva) setPreguntaPendiente(null);
  }, [corridaActiva]);

  // El chat siempre debe enseñar lo último, sin que el usuario tenga que bajar a mano — se recoloca
  // al final en cada evento nuevo y también mientras "trabaja" (el indicador de pulso también empuja
  // el alto de la lista).
  useEffect(() => {
    const nodo = listaRef.current;
    if (nodo) nodo.scrollTop = nodo.scrollHeight;
  }, [eventos, corridaActiva, preguntaPendiente]);

  const opcionesAplanadas = preguntaPendiente ? preguntaPendiente.questions.flatMap((p) => p.options) : [];

  // Navegación por teclado al estilo Claude Code: flechas o dígitos mueven/eligen la opción, Enter
  // confirma la enfocada — todo desactivado mientras se escribe en la caja de texto libre, para no
  // robarle las flechas/números a quien está corrigiendo la respuesta a mano.
  useEffect(() => {
    if (!preguntaPendiente || opcionesAplanadas.length === 0) return;
    function manejarTeclado(e: KeyboardEvent) {
      const activo = document.activeElement;
      if (activo instanceof HTMLInputElement || activo instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        setOpcionEnfocada((i) => Math.min(i + 1, opcionesAplanadas.length - 1));
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        setOpcionEnfocada((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const opcion = opcionesAplanadas[opcionEnfocada];
        if (opcion) responder({ opcionesElegidas: [opcion.label] });
      } else {
        const digito = Number(e.key);
        if (digito >= 1 && digito <= 9 && opcionesAplanadas[digito - 1]) {
          e.preventDefault();
          responder({ opcionesElegidas: [opcionesAplanadas[digito - 1].label] });
        }
      }
    }
    window.addEventListener("keydown", manejarTeclado);
    return () => window.removeEventListener("keydown", manejarTeclado);
  }, [preguntaPendiente, opcionEnfocada, opcionesAplanadas.length]);

  const manejarError = (err: unknown) => {
    setError(err instanceof Error ? err.message : String(err));
  };

  // Lógica común a "enviar lo escrito en la caja" y "pedirAlAgente desde otra pestaña": ninguna de
  // las dos sabe si hay una corrida en marcha (enviarComando encola) ni le importa limpiar la caja
  // de texto — eso es cosa de quien la posee (ver `enviar`, único que la toca).
  // Resuelve a `true` solo si el comando llegó al servidor: `enviar` no borra la caja si falló.
  const enviarTexto = (texto: string): Promise<boolean> => {
    const limpio = texto.trim();
    if (!limpio) return Promise.resolve(false);
    agregarMensajeUsuario(limpio);
    setError(null);
    setEnviando(true);
    return enviarComando(limpio)
      .then((respuesta) => {
        marcarCorridaActiva(respuesta.runId);
        return true;
      })
      .catch((err: unknown) => {
        manejarError(err);
        return false;
      })
      .finally(() => setEnviando(false));
  };

  const enviar = (): Promise<void> => {
    const texto = comando.trim();
    if (!texto) return Promise.resolve();
    return enviarTexto(texto).then((ok) => {
      if (ok) setComando("");
    });
  };

  // Ref siempre al día: el listener de abajo se engancha una sola vez (deps vacías, para no
  // reenganchar el listener en cada tecla) y así no arrastra un `enviarTexto` de un render viejo.
  const enviarTextoRef = useRef(enviarTexto);
  enviarTextoRef.current = enviarTexto;

  // Puente con `pedirAlAgente` (Redactar y cualquier pestaña futura sin referencia a esta consola,
  // que está montada aparte, siempre visible): en vez de prop-drilling, escucha el CustomEvent.
  useEffect(() => {
    function manejarComandoExterno(e: Event) {
      const texto = (e as CustomEvent<{ texto: string }>).detail?.texto;
      if (texto) void enviarTextoRef.current(texto);
    }
    window.addEventListener(EVENTO_COMANDO_EXTERNO, manejarComandoExterno);
    return () => window.removeEventListener(EVENTO_COMANDO_EXTERNO, manejarComandoExterno);
  }, []);

  const responder = (respuesta: { textoLibre?: string; opcionesElegidas?: string[] }) => {
    agregarMensajeUsuario(respuesta.opcionesElegidas?.length ? respuesta.opcionesElegidas.join(", ") : (respuesta.textoLibre ?? ""));
    setError(null);
    setEnviando(true);
    responderPregunta(respuesta)
      .then(() => {
        setPreguntaPendiente(null);
        setComando("");
      })
      .catch(manejarError)
      .finally(() => setEnviando(false));
  };

  const enviarOResponder = () => {
    if (preguntaPendiente) {
      const texto = comando.trim();
      if (!texto) return;
      responder({ textoLibre: texto });
      return;
    }
    void enviar();
  };

  const parar = () => {
    pararCorrida().catch(manejarError);
  };

  // "Lo que hayas escrito" se entrega ya: se envía primero con el `enviar()` normal (que encola si
  // hace falta) y solo entonces se interrumpe el turno en curso.
  const interrumpir = () => {
    void enviar().then(() => interrumpirCorrida().catch(manejarError));
  };

  // Corta `resume` y vacía el chat (con él desaparece el aviso de tokens de contexto, que se calcula
  // de `eventos`): el próximo comando arranca de cero. Deshabilitado con una corrida en marcha —
  // pararla es una decisión aparte, no algo que este botón deba decidir.
  const iniciarConversacionNueva = () => {
    setError(null);
    nuevaConversacion()
      .then(() => {
        vaciarEventos?.();
        setPreguntaPendiente(null);
      })
      .catch(manejarError);
  };

  const tokensContexto = tokensContextoActual(eventos);

  return (
    <Panel tabId="global" panelId="consola" titulo="Consola" disposicionPorDefecto={{ x: 0, y: 0, w: 100, h: 100, z: 10 }}>
      <div className="flex h-full flex-col gap-2">
        <ul ref={listaRef} className="flex flex-1 flex-col gap-1.5 overflow-auto">
          {eventos.length === 0 ? (
            <p className="text-text-dim">Sin eventos todavía: escribe un comando.</p>
          ) : (
            (() => {
              // Acumuladores mutables a propósito, mismo patrón que `contadorGlobal` más abajo: hace
              // falta el texto del último `agente.assistant` visto para no repetirlo en el bloque de
              // fin de turno (ver `textoBloqueFinal`), y el nombre de cada `tool_use` por su id para
              // poder nombrar su `tool_result`, que llega después como `agente.user` sin más pista
              // que ese id (ver `extraerToolUseIds`).
              let ultimoTextoAsistente: string | null = null;
              const nombresPorToolUseId: Record<string, string> = {};
              return eventos.flatMap((evento, indiceEvento) => {
                const items = describirEvento(evento, ultimoTextoAsistente, nombresPorToolUseId);
                ultimoTextoAsistente = extraerTextoAsistente(evento) ?? ultimoTextoAsistente;
                for (const { id, nombre } of extraerToolUseIds(evento)) {
                  nombresPorToolUseId[id] = nombre;
                }
                return items.map((item, indiceItem) => (
                  <LineaItem key={`${evento.runId}-${String(indiceEvento)}-${String(indiceItem)}`} item={item} />
                ));
              });
            })()
          )}
        </ul>
        {corridaActiva &&
          (() => {
            const ultimo = eventos[eventos.length - 1];
            if (ultimo && (esEventoTerminal(ultimo.type) || preguntaSinResponder(eventos))) return null;
            return <p className="animate-pulse text-2xs text-text-dim">🤖 trabajando…</p>;
          })()}
        {preguntaPendiente &&
          (() => {
            let contadorGlobal = -1;
            return (
              <div className="flex flex-col gap-1.5 rounded-7 border border-accent bg-accent-bg p-2">
                {preguntaPendiente.questions.map((pregunta, indice) => (
                  <div key={`${pregunta.header}-${String(indice)}`} className="flex flex-col gap-1">
                    <p className="text-xs font-bold text-text-bright">
                      {pregunta.header}: {pregunta.question}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {pregunta.options.map((opcion) => {
                        contadorGlobal += 1;
                        const miIndice = contadorGlobal;
                        const enfocada = miIndice === opcionEnfocada;
                        return (
                          <button
                            key={opcion.label}
                            type="button"
                            title={opcion.description}
                            disabled={enviando}
                            onClick={() => {
                              responder({ opcionesElegidas: [opcion.label] });
                            }}
                            onMouseEnter={() => {
                              setOpcionEnfocada(miIndice);
                            }}
                            className={`rounded-7 border px-2 py-1 text-2xs text-text-bright disabled:opacity-50 ${
                              enfocada ? "border-accent bg-accent-bg ring-1 ring-accent" : "border-border-soft bg-bg-sunken"
                            }`}
                          >
                            <span className="text-text-faint">{miIndice + 1}.</span> {opcion.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <p className="text-2xs text-text-faint">↑↓ elegir · Enter confirmar · o escribe tu respuesta abajo</p>
              </div>
            );
          })()}
        {tokensContexto !== null && tokensContexto > 100_000 && (
          <p className="rounded-7 border border-info bg-info-bg px-2.5 py-1 text-2xs text-info">
            El contexto va por {String(Math.round(tokensContexto / 1000))}k tokens: cada paso relee todo. Si cambias de tarea, pulsa «Nueva
            conversación».
          </p>
        )}
        {error && <p className="text-xs text-danger">{error}</p>}
        {corridaActiva && <p className="text-2xs text-text-dim">se enviará al terminar el paso actual</p>}
        {/* Input en su propia fila, a todo el ancho: a 25% de la banda (o cualquier panel movible
            estrecho) no caben las cuatro acciones al lado sin comprimirlo hasta dejar el texto
            ilegible — mismo problema que las credenciales de Configuración. Las acciones van en la
            fila de debajo, con `flex-wrap` por si tampoco caben todas en una sola línea ahí. */}
        <div className="flex flex-col gap-1.5">
          <input
            ref={inputRef}
            value={comando}
            onChange={(e) => {
              setComando(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") enviarOResponder();
            }}
            disabled={enviando}
            placeholder={preguntaPendiente ? "Responde por texto libre…" : "Escribe un comando…"}
            className="w-full rounded-7 border border-border-soft bg-bg-sunken px-2.5 py-1.5 text-sm text-text-bright disabled:opacity-50"
          />
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={enviarOResponder}
              disabled={enviando}
              className="rounded-7 border border-accent bg-accent px-3 py-1 text-xs font-bold text-on-accent disabled:opacity-50"
            >
              ▶️
            </button>
            <button
              type="button"
              onClick={parar}
              disabled={!corridaActiva}
              className="rounded-7 border border-border-soft bg-bg-sunken px-3 py-1 text-xs font-bold text-text-bright disabled:opacity-50"
            >
              Parar
            </button>
            <button
              type="button"
              onClick={interrumpir}
              disabled={!corridaActiva}
              className="rounded-7 border border-border-soft bg-bg-sunken px-3 py-1 text-xs font-bold text-text-bright disabled:opacity-50"
            >
              Interrumpir
            </button>
            <button
              type="button"
              onClick={iniciarConversacionNueva}
              disabled={Boolean(corridaActiva) || enviando}
              className="rounded-7 border border-border-soft bg-bg-sunken px-3 py-1 text-xs font-bold text-text-bright disabled:opacity-50"
            >
              Nueva conversación
            </button>
          </div>
        </div>
      </div>
    </Panel>
  );
}
