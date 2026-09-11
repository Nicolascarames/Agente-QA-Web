import { useEffect, useState } from "react";
import { Panel } from "./Panel";
import { enviarComando, interrumpirCorrida, pararCorrida, responderPregunta } from "./api";
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

function LineaEvento({ evento }: { evento: EventoNdjson }) {
  if (evento.type === "raw.stdout") {
    const datos = evento.data as { linea?: unknown };
    const linea = typeof datos?.linea === "string" ? datos.linea : serializarDatos(evento.data);
    return <li className="text-xs text-text-dim">{linea}</li>;
  }
  return (
    <li className="border-b border-border pb-1.5 text-xs text-text-faint">
      <span className="text-text-ghost">{evento.ts}</span> <span className="text-accent-soft">{evento.type}</span>{" "}
      <span className="text-text-faint">[{evento.agent}]</span>
      <pre className="whitespace-pre-wrap break-all text-2xs text-text-dim">{serializarDatos(evento.data)}</pre>
    </li>
  );
}

export interface ConsolaGlobalProps {
  corridaActiva: string | null;
  eventos: EventoNdjson[];
  marcarCorridaActiva: (etiqueta: string | null) => void;
}

/**
 * Bloque 4: la caja de texto lanza el agente de verdad vía el SDK. Enviar ya no bloquea si hay una
 * corrida activa — encola en la misma sesión (el CLI la atiende al terminar el turno en curso).
 */
export function ConsolaGlobal({ corridaActiva, eventos, marcarCorridaActiva }: ConsolaGlobalProps) {
  const [comando, setComando] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [preguntaPendiente, setPreguntaPendiente] = useState<PreguntaAgente | null>(null);

  // La última pregunta sin responder, si la hay: el propio `canUseTool` del agente queda bloqueado
  // hasta que se llame a `responderPregunta`, así que basta con quedarse con la más reciente.
  useEffect(() => {
    const ultimo = eventos[eventos.length - 1];
    if (ultimo?.type === "agente.pregunta") {
      setPreguntaPendiente(ultimo.data as PreguntaAgente);
    }
  }, [eventos]);

  useEffect(() => {
    if (!corridaActiva) setPreguntaPendiente(null);
  }, [corridaActiva]);

  const manejarError = (err: unknown) => {
    setError(err instanceof Error ? err.message : String(err));
  };

  const enviar = (): Promise<void> => {
    const texto = comando.trim();
    if (!texto) return Promise.resolve();
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
    <Panel tabId="global" panelId="consola" titulo="Consola" disposicionPorDefecto={{ x: 2, y: 4, w: 96, h: 90, z: 10 }}>
      <div className="flex h-full flex-col gap-2">
        <ul className="flex-1 overflow-auto">
          {eventos.length === 0 ? (
            <p className="text-text-dim">Sin eventos todavía: escribe un comando.</p>
          ) : (
            eventos.map((evento, indice) => <LineaEvento key={`${evento.runId}-${String(indice)}`} evento={evento} />)
          )}
        </ul>
        {preguntaPendiente && (
          <div className="flex flex-col gap-1.5 rounded-7 border border-border-soft p-2">
            {preguntaPendiente.questions.map((pregunta, indice) => (
              <div key={`${pregunta.header}-${String(indice)}`} className="flex flex-col gap-1">
                <p className="text-xs font-bold text-text-bright">
                  {pregunta.header}: {pregunta.question}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {pregunta.options.map((opcion) => (
                    <button
                      key={opcion.label}
                      type="button"
                      title={opcion.description}
                      disabled={enviando}
                      onClick={() => {
                        responder({ opcionesElegidas: [opcion.label] });
                      }}
                      className="rounded-7 border border-border-soft bg-bg-sunken px-2 py-1 text-2xs text-text-bright disabled:opacity-50"
                    >
                      {opcion.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {error && <p className="text-xs text-danger">{error}</p>}
        {corridaActiva && <p className="text-2xs text-text-dim">se enviará al terminar el paso actual</p>}
        <div className="flex gap-1.5">
          <input
            value={comando}
            onChange={(e) => {
              setComando(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") enviarOResponder();
            }}
            disabled={enviando}
            placeholder={preguntaPendiente ? "Responde por texto libre…" : "Escribe un comando…"}
            className="flex-1 rounded-7 border border-border-soft bg-bg-sunken px-2.5 py-1.5 text-sm text-text-bright disabled:opacity-50"
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
