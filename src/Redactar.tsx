import { useEffect, useState } from "react";
import { Panel } from "./Panel";
import {
  enviarComando,
  guardarEscenario,
  interrumpirCorrida,
  obtenerEscenario,
  obtenerEscenarios,
  obtenerTrazabilidad,
  pararCorrida,
  responderPregunta,
} from "./api";
import type { CoberturaEscenario, EventoNdjson } from "../shared/tipos";

// Badge de cobertura por fichero .feature (Bloque 8), junto al nombre en la lista de la izquierda:
// resume todos los `Escenario:` de ese fichero en un único estado, por prioridad — un fichero con
// algo sin cubrir importa más que uno cubierto pero en rojo, y un rojo importa más que uno verde.
type BadgeCobertura = "no-cubierto" | "desincronizado" | "rojo" | "verde" | "pendiente";

const ETIQUETA_COBERTURA: Record<BadgeCobertura, string> = {
  "no-cubierto": "no cubierto",
  desincronizado: "desincronizado",
  rojo: "rojo",
  verde: "verde",
  pendiente: "pendiente",
};

const COLOR_COBERTURA: Record<BadgeCobertura, string> = {
  "no-cubierto": "text-danger",
  desincronizado: "text-accent-soft",
  rojo: "text-danger",
  verde: "text-ok",
  pendiente: "text-text-dim",
};

function badgeDeFichero(escenarios: CoberturaEscenario[]): BadgeCobertura {
  if (escenarios.some((e) => e.estado === "no-cubierto")) return "no-cubierto";
  if (escenarios.some((e) => e.estado === "desincronizado")) return "desincronizado";
  if (escenarios.some((e) => e.resultado === "failed" || e.resultado === "timedOut")) return "rojo";
  if (escenarios.every((e) => e.resultado === "passed")) return "verde";
  return "pendiente";
}

// Bloque 6: misma geometría que `panels.redactar` del mockup (design/mockup-design.js) —
// izquierda 25 %, centro 46 % (arranca en 26.5 %), derecha 26 % (arranca en 74 %), los tres a
// 100 % de alto — pero ahora con datos reales de `tests/features/*.feature` bajo el proyecto
// activo, en vez de los tres paneles vacíos del Bloque 5.
//
// La `BarraLanzamientoDeshabilitada` del Bloque 5 desaparece: era un `🎯 Ámbito / 🤖 Agente / 💰
// coste` de mentira para un agente que no existía. Ahora el agente existe y se lanza escribiendo
// en el chat de la derecha — una segunda barra de "lanzar" sería redundante con esa caja de texto.

interface OpcionPregunta {
  label: string;
  description: string;
}

interface PreguntaAgente {
  questions: { question: string; header: string; options: OpcionPregunta[] }[];
}

export interface ChatAgenteProps {
  corridaActiva: string | null;
  eventos: EventoNdjson[];
  marcarCorridaActiva: (etiqueta: string | null) => void;
}

/**
 * `ConsolaGlobal` no sirve aquí tal cual: se envuelve en su propio `<Panel tabId="global"
 * panelId="consola">`, así que montarla otra vez dentro del panel "chat" de esta pestaña
 * duplicaría esa clave global de `Panel` (misma entrada de `localStorage`). Este es el mismo
 * chat — mismos endpoints de `api.ts`, misma lógica de `agente.pregunta` — sin el envoltorio de
 * `Panel`, porque el de esta pestaña ya lo pone el `<Panel panelId="chat">` que lo contiene.
 */
export function ChatAgente({ corridaActiva, eventos, marcarCorridaActiva }: ChatAgenteProps) {
  const [comando, setComando] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [preguntaPendiente, setPreguntaPendiente] = useState<PreguntaAgente | null>(null);

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

  const interrumpir = () => {
    void enviar().then(() => interrumpirCorrida().catch(manejarError));
  };

  return (
    <div className="flex h-full flex-col gap-2">
      <ul className="flex-1 overflow-auto">
        {eventos.length === 0 ? (
          <p className="text-text-dim">Sin eventos todavía: escribe un comando.</p>
        ) : (
          eventos.map((evento, indice) => (
            <li key={`${evento.runId}-${String(indice)}`} className="border-b border-border pb-1.5 text-2xs text-text-faint">
              <span className="text-accent-soft">{evento.type}</span>
            </li>
          ))
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
  );
}

export interface RedactarProps {
  corridaActiva: string | null;
  eventos: EventoNdjson[];
  marcarCorridaActiva: (etiqueta: string | null) => void;
}

export function Redactar({ corridaActiva, eventos, marcarCorridaActiva }: RedactarProps) {
  const [escenarios, setEscenarios] = useState<string[]>([]);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [contenido, setContenido] = useState("");
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coberturaPorFichero, setCoberturaPorFichero] = useState<Map<string, CoberturaEscenario[]> | null>(null);

  useEffect(() => {
    void obtenerEscenarios()
      .then(setEscenarios)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      });
  }, []);

  useEffect(() => {
    void obtenerTrazabilidad()
      .then((datos) => {
        const mapa = new Map<string, CoberturaEscenario[]>();
        for (const cobertura of datos) {
          const lista = mapa.get(cobertura.featureFichero) ?? [];
          lista.push(cobertura);
          mapa.set(cobertura.featureFichero, lista);
        }
        setCoberturaPorFichero(mapa);
      })
      .catch(() => {
        setCoberturaPorFichero(null);
      });
  }, []);

  useEffect(() => {
    if (!seleccionado) {
      setContenido("");
      return;
    }
    setCargando(true);
    setError(null);
    obtenerEscenario(seleccionado)
      .then((respuesta) => {
        setContenido(respuesta.contenido);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setCargando(false));
  }, [seleccionado]);

  const guardar = () => {
    if (!seleccionado) return;
    setGuardando(true);
    setError(null);
    guardarEscenario(seleccionado, contenido)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setGuardando(false));
  };

  return (
    <div className="flex h-full flex-col gap-2.5 p-4">
      <div className="relative flex-1" data-canvas="true">
        <Panel tabId="redactar" panelId="lista" titulo="Features y escenarios" disposicionPorDefecto={{ x: 0, y: 0, w: 25, h: 100, z: 1 }}>
          {escenarios.length === 0 ? (
            <p className="p-3 text-xs text-text-dim">Sin ficheros .feature todavía en tests/features/.</p>
          ) : (
            <ul className="flex flex-col gap-0.5 overflow-auto p-1.5">
              {escenarios.map((nombre) => {
                const cobertura = coberturaPorFichero?.get(nombre);
                const badge = cobertura ? badgeDeFichero(cobertura) : undefined;
                return (
                  <li key={nombre}>
                    <button
                      type="button"
                      onClick={() => {
                        setSeleccionado(nombre);
                      }}
                      className={`flex w-full items-center justify-between gap-2 rounded-6 px-2 py-1.5 text-left text-xs ${
                        nombre === seleccionado ? "bg-accent-bg font-semibold text-accent-soft" : "text-text-muted hover:text-text"
                      }`}
                    >
                      <span className="truncate">{nombre}</span>
                      {badge && <span className={`shrink-0 text-2xs ${COLOR_COBERTURA[badge]}`}>{ETIQUETA_COBERTURA[badge]}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel tabId="redactar" panelId="detalle" titulo="Detalle del escenario" disposicionPorDefecto={{ x: 26.5, y: 0, w: 46, h: 100, z: 1 }}>
          <div className="flex h-full flex-col gap-2 p-2">
            {!seleccionado ? (
              <p className="p-2 text-xs text-text-dim">Elige un escenario de la lista.</p>
            ) : (
              <>
                <textarea
                  value={contenido}
                  onChange={(e) => {
                    setContenido(e.target.value);
                  }}
                  disabled={cargando}
                  spellCheck={false}
                  className="flex-1 resize-none rounded-7 border border-border-soft bg-bg-sunken p-2.5 font-mono text-xs text-text-bright disabled:opacity-50"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={guardar}
                    disabled={guardando || cargando}
                    className="rounded-7 border border-accent bg-accent px-3 py-1.5 text-xs font-bold text-on-accent disabled:opacity-50"
                  >
                    {guardando ? "Guardando…" : "Guardar"}
                  </button>
                  {error && <p className="text-xs text-danger">{error}</p>}
                </div>
              </>
            )}
          </div>
        </Panel>

        <Panel tabId="redactar" panelId="chat" titulo="Hablar con el agente" disposicionPorDefecto={{ x: 74, y: 0, w: 26, h: 100, z: 1 }}>
          <ChatAgente corridaActiva={corridaActiva} eventos={eventos} marcarCorridaActiva={marcarCorridaActiva} />
        </Panel>
      </div>
    </div>
  );
}
