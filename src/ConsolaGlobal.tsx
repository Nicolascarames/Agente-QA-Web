import { useState } from "react";
import { Panel } from "./Panel";
import { enviarComando } from "./api";
import type { EventoNdjson } from "../shared/tipos";

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
 * Bloque 2: vaciada del autocompletado, la validación en vivo y el resumen final (todos atados al
 * catálogo del CLI antiguo, ya borrado). Se queda la caja de texto y el pintado de líneas — el
 * Bloque 4 la conecta al agente de verdad.
 */
export function ConsolaGlobal({ corridaActiva, eventos, marcarCorridaActiva }: ConsolaGlobalProps) {
  const [comando, setComando] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = () => {
    const texto = comando.trim();
    if (!texto) return;
    if (corridaActiva) {
      setError("Ya hay una corrida activa. Detenla antes de lanzar otra.");
      return;
    }
    setError(null);
    setEnviando(true);
    enviarComando(texto)
      .then(() => {
        marcarCorridaActiva(texto);
        setComando("");
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setEnviando(false));
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
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex gap-1.5">
          <input
            value={comando}
            onChange={(e) => {
              setComando(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") enviar();
            }}
            disabled={enviando}
            placeholder="Escribe un comando…"
            className="flex-1 rounded-7 border border-border-soft bg-bg-sunken px-2.5 py-1.5 text-sm text-text-bright disabled:opacity-50"
          />
          <button
            type="button"
            onClick={enviar}
            disabled={enviando}
            className="rounded-7 border border-accent bg-accent px-3 py-1 text-xs font-bold text-on-accent disabled:opacity-50"
          >
            ▶️
          </button>
        </div>
      </div>
    </Panel>
  );
}
