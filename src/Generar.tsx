import { useEffect, useState } from "react";
import { Panel } from "./Panel";
import {
  commitGenerados,
  descartarGenerados,
  enviarComando,
  interrumpirCorrida,
  obtenerDiffGenerado,
  obtenerGenerados,
  pararCorrida,
  responderPregunta,
} from "./api";
import type { EventoNdjson } from "../shared/tipos";

// Bloque 6: misma geometría que `panels.generar` del mockup (design/mockup-design.js) —
// izquierda 25 %, centro 46 % (arranca en 26.5 %), derecha 26 % (arranca en 74 %) — pero ahora
// con datos reales de `tests/pages/*.page.ts` y `tests/specs/*.spec.ts`, en vez de los tres
// paneles vacíos del Bloque 5.
//
// La `BarraLanzamientoDeshabilitada` del Bloque 5 desaparece por el mismo motivo que en
// Redactar.tsx: el agente ya existe y se lanza desde el chat de la derecha, no desde una barra de
// "🎯 Ámbito / 🤖 Agente / 💰 coste" que nunca tuvo datos reales que mostrar.

interface OpcionPregunta {
  label: string;
  description: string;
}

interface PreguntaAgente {
  questions: { question: string; header: string; options: OpcionPregunta[] }[];
}

interface ChatAgenteProps {
  corridaActiva: string | null;
  eventos: EventoNdjson[];
  marcarCorridaActiva: (etiqueta: string | null) => void;
}

/**
 * Igual que en `Redactar.tsx`: `ConsolaGlobal` trae su propio `<Panel tabId="global"
 * panelId="consola">`, así que no se reutiliza aquí (duplicaría esa clave global) — es la misma
 * lógica sobre `api.ts`, sin el envoltorio de `Panel` que ya pone el panel "chat" que lo contiene.
 */
function ChatAgente({ corridaActiva, eventos, marcarCorridaActiva }: ChatAgenteProps) {
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

interface FicheroGenerado {
  tipo: "pages" | "specs";
  nombre: string;
  ruta: string;
}

export interface GenerarProps {
  corridaActiva: string | null;
  eventos: EventoNdjson[];
  marcarCorridaActiva: (etiqueta: string | null) => void;
}

export function Generar({ corridaActiva, eventos, marcarCorridaActiva }: GenerarProps) {
  const [ficheros, setFicheros] = useState<FicheroGenerado[]>([]);
  const [seleccionado, setSeleccionado] = useState<FicheroGenerado | null>(null);
  const [diff, setDiff] = useState<string>("");
  const [cargando, setCargando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void obtenerGenerados()
      .then((generados) => {
        setFicheros([
          ...generados.pages.map((nombre): FicheroGenerado => ({ tipo: "pages", nombre, ruta: `tests/pages/${nombre}` })),
          ...generados.specs.map((nombre): FicheroGenerado => ({ tipo: "specs", nombre, ruta: `tests/specs/${nombre}` })),
        ]);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      });
  }, []);

  useEffect(() => {
    if (!seleccionado) {
      setDiff("");
      return;
    }
    setCargando(true);
    setError(null);
    obtenerDiffGenerado(seleccionado.ruta)
      .then((respuesta) => {
        setDiff(respuesta.diff);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setCargando(false));
  }, [seleccionado]);

  const aceptar = () => {
    if (!seleccionado) return;
    setProcesando(true);
    setError(null);
    commitGenerados([seleccionado.ruta], `test: genera ${seleccionado.nombre}`)
      .then(() => {
        setDiff("");
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setProcesando(false));
  };

  const descartar = () => {
    if (!seleccionado) return;
    setProcesando(true);
    setError(null);
    descartarGenerados([seleccionado.ruta])
      .then(() => {
        setDiff("");
        setFicheros((actual) => actual.filter((f) => f.ruta !== seleccionado.ruta));
        setSeleccionado(null);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setProcesando(false));
  };

  return (
    <div className="flex h-full flex-col gap-2.5 p-4">
      <div className="relative flex-1" data-canvas="true">
        <Panel tabId="generar" panelId="lista" titulo="Escenarios listos" disposicionPorDefecto={{ x: 0, y: 0, w: 25, h: 100, z: 1 }}>
          {ficheros.length === 0 ? (
            <p className="p-3 text-xs text-text-dim">Sin Page Objects ni specs todavía en tests/pages/ y tests/specs/.</p>
          ) : (
            <ul className="flex flex-col gap-0.5 overflow-auto p-1.5">
              {ficheros.map((fichero) => (
                <li key={fichero.ruta}>
                  <button
                    type="button"
                    onClick={() => {
                      setSeleccionado(fichero);
                    }}
                    className={`flex w-full items-center gap-1.5 rounded-6 px-2 py-1.5 text-left text-xs ${
                      fichero.ruta === seleccionado?.ruta ? "bg-accent-bg font-semibold text-accent-soft" : "text-text-muted hover:text-text"
                    }`}
                  >
                    <span className="text-2xs uppercase text-text-faint">{fichero.tipo === "pages" ? "PO" : "spec"}</span>
                    {fichero.nombre}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel tabId="generar" panelId="detalle" titulo="Page Object y spec" disposicionPorDefecto={{ x: 26.5, y: 0, w: 46, h: 100, z: 1 }}>
          <div className="flex h-full flex-col gap-2 p-2">
            {!seleccionado ? (
              <p className="p-2 text-xs text-text-dim">Elige un fichero de la lista.</p>
            ) : cargando ? (
              <p className="p-2 text-xs text-text-dim">Cargando…</p>
            ) : diff.trim() === "" ? (
              <p className="p-2 text-xs text-text-dim">Sin cambios pendientes que mostrar: {seleccionado.nombre} coincide con el commit.</p>
            ) : (
              <>
                <pre className="flex-1 overflow-auto whitespace-pre rounded-7 border border-border-soft bg-bg-sunken p-2.5 font-mono text-2xs text-text-bright">
                  {diff}
                </pre>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={aceptar}
                    disabled={procesando}
                    className="rounded-7 border border-accent bg-accent px-3 py-1.5 text-xs font-bold text-on-accent disabled:opacity-50"
                  >
                    Aceptar
                  </button>
                  <button
                    type="button"
                    onClick={descartar}
                    disabled={procesando}
                    className="rounded-7 border border-border-soft bg-bg-sunken px-3 py-1.5 text-xs font-bold text-text-bright disabled:opacity-50"
                  >
                    Descartar
                  </button>
                  {error && <p className="text-xs text-danger">{error}</p>}
                </div>
              </>
            )}
          </div>
        </Panel>

        <Panel tabId="generar" panelId="chat" titulo="Hablar con el agente" disposicionPorDefecto={{ x: 74, y: 0, w: 26, h: 100, z: 1 }}>
          <ChatAgente corridaActiva={corridaActiva} eventos={eventos} marcarCorridaActiva={marcarCorridaActiva} />
        </Panel>
      </div>
    </div>
  );
}
