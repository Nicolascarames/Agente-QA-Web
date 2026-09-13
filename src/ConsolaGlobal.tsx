import { useEffect, useRef, useState } from "react";
import { Panel } from "./Panel";
import { enviarComando, interrumpirCorrida, pararCorrida, responderPregunta } from "./api";
import { esEventoTerminal } from "../shared/eventos";
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

interface BloqueContenidoAsistente {
  type: string;
  text?: string;
  name?: string;
}

function LineaVolcadoCrudo({ evento }: { evento: EventoNdjson }) {
  return (
    <li className="border-b border-border pb-1.5 text-xs text-text-faint">
      <span className="text-text-ghost">{evento.ts}</span> <span className="text-accent-soft">{evento.type}</span>{" "}
      <span className="text-text-faint">[{evento.agent}]</span>
      <pre className="whitespace-pre-wrap break-all text-2xs text-text-dim">{serializarDatos(evento.data)}</pre>
    </li>
  );
}

function LineaAgenteAssistant({ evento }: { evento: EventoNdjson }) {
  const contenido = (evento.data as { message?: { content?: unknown } } | undefined)?.message?.content;
  if (!Array.isArray(contenido) || contenido.length === 0) {
    return <LineaVolcadoCrudo evento={evento} />;
  }
  return (
    <>
      {(contenido as BloqueContenidoAsistente[]).map((bloque, indice) => {
        if (bloque.type === "text" && bloque.text) {
          return (
            <li key={indice} className="text-xs text-ok">
              {bloque.text}
            </li>
          );
        }
        if (bloque.type === "tool_use") {
          return (
            <li key={indice} className="text-2xs text-text-dim">
              → usando {bloque.name}
            </li>
          );
        }
        return null;
      })}
    </>
  );
}

function LineaEvento({ evento }: { evento: EventoNdjson }) {
  if (evento.type === "raw.stdout") {
    const datos = evento.data as { linea?: unknown };
    const linea = typeof datos?.linea === "string" ? datos.linea : serializarDatos(evento.data);
    return <li className="text-xs text-text-dim">{linea}</li>;
  }
  if (evento.type === "usuario.mensaje") {
    const { texto } = evento.data as { texto: string };
    return (
      <li className="ml-auto max-w-[80%] rounded-7 border border-accent bg-accent-bg px-2.5 py-1.5 text-xs text-text-bright">
        {texto}
      </li>
    );
  }
  if (evento.type === "agente.assistant") {
    return <LineaAgenteAssistant evento={evento} />;
  }
  if (evento.type === "operation.completed" || evento.type === "operation.error") {
    const esError = evento.type === "operation.error";
    const { result } = (evento.data as { result?: string } | undefined) ?? {};
    return (
      <li
        className={`rounded-7 border px-2.5 py-1.5 text-xs font-semibold ${
          esError ? "border-danger bg-bg-sunken text-danger" : "border-accent bg-accent-bg text-text-bright"
        }`}
      >
        {result ?? (esError ? "Ha ocurrido un error — mira el detalle." : "Terminado.")}
      </li>
    );
  }
  return <LineaVolcadoCrudo evento={evento} />;
}

export interface ConsolaGlobalProps {
  corridaActiva: string | null;
  eventos: EventoNdjson[];
  marcarCorridaActiva: (etiqueta: string | null) => void;
  agregarMensajeUsuario: (texto: string) => void;
  /** Empezar (Bloque «primeros pasos»): texto que otra pestaña quiere dejar escrito aquí sin
   *  enviarlo. `null` cuando no hay nada pendiente — App.tsx es quien lo posee, esta consola no
   *  conoce a quien lo pide. */
  borradorConsola: string | null;
  onBorradorAplicado: () => void;
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
  borradorConsola,
  onBorradorAplicado,
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
    const ultimo = eventos[eventos.length - 1];
    if (ultimo?.type === "agente.pregunta") {
      setPreguntaPendiente(ultimo.data as PreguntaAgente);
      setOpcionEnfocada(0);
    }
  }, [eventos]);

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

  const enviar = (): Promise<void> => {
    const texto = comando.trim();
    if (!texto) return Promise.resolve();
    agregarMensajeUsuario(texto);
    setError(null);
    setEnviando(true);
    return enviarComando(texto)
      .then((respuesta) => {
        marcarCorridaActiva(respuesta.runId);
        setComando("");
      })
      .catch(manejarError)
      .finally(() => setEnviando(false));
  };

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

  return (
    <Panel tabId="global" panelId="consola" titulo="Consola" disposicionPorDefecto={{ x: 0, y: 0, w: 100, h: 100, z: 10 }}>
      <div className="flex h-full flex-col gap-2">
        <ul ref={listaRef} className="flex-1 overflow-auto">
          {eventos.length === 0 ? (
            <p className="text-text-dim">Sin eventos todavía: escribe un comando.</p>
          ) : (
            eventos.map((evento, indice) => <LineaEvento key={`${evento.runId}-${String(indice)}`} evento={evento} />)
          )}
        </ul>
        {corridaActiva &&
          (() => {
            const ultimo = eventos[eventos.length - 1];
            if (ultimo && (esEventoTerminal(ultimo.type) || ultimo.type === "agente.pregunta")) return null;
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
        {error && <p className="text-xs text-danger">{error}</p>}
        {corridaActiva && <p className="text-2xs text-text-dim">se enviará al terminar el paso actual</p>}
        <div className="flex flex-wrap gap-1.5">
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
            className="min-w-[120px] flex-1 rounded-7 border border-border-soft bg-bg-sunken px-2.5 py-1.5 text-sm text-text-bright disabled:opacity-50"
          />
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
        </div>
      </div>
    </Panel>
  );
}
