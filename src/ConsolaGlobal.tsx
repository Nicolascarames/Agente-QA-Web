import { useState } from "react";
import { Panel } from "./Panel";
import { enviarComando } from "./api";
import type { EventoNdjson } from "../shared/tipos";
import type { ResumenFinalCorrida } from "./useCorridaGlobal";

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

function TarjetaResumen({ resumen }: { resumen: ResumenFinalCorrida }) {
  const exito = resumen.evento.type === "operation.completed";
  const { pantallasNuevas, localizadoresNuevos, escenariosNuevos } = resumen.diff;
  const sinNovedades = pantallasNuevas.length === 0 && localizadoresNuevos.length === 0 && escenariosNuevos.length === 0;

  return (
    <div
      className={`rounded-8 border p-2.5 text-sm ${
        exito ? "border-success bg-success-bg text-success" : "border-danger bg-danger-bg text-danger"
      }`}
    >
      <div className="font-bold">{exito ? "✔ Corrida terminada" : `✖ ${resumen.evento.type}`}</div>
      {pantallasNuevas.length > 0 && <div>Pantallas nuevas: {pantallasNuevas.map((pantalla) => pantalla.name).join(", ")}</div>}
      {localizadoresNuevos.length > 0 && (
        <div>Localizadores nuevos: {localizadoresNuevos.map((item) => `${item.screenName}.${item.locator.name}`).join(", ")}</div>
      )}
      {escenariosNuevos.length > 0 && <div>Escenarios nuevos: {escenariosNuevos.map((escenario) => escenario.title).join(", ")}</div>}
      {sinNovedades && <div>Sin novedades en el mapa.</div>}
    </div>
  );
}

export interface ConsolaGlobalProps {
  corridaActiva: string | null;
  eventos: EventoNdjson[];
  resumenFinal: ResumenFinalCorrida | null;
  marcarCorridaActiva: (etiqueta: string | null) => void;
}

export function ConsolaGlobal({ corridaActiva, eventos, resumenFinal, marcarCorridaActiva }: ConsolaGlobalProps) {
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
            <p className="text-text-dim">Sin eventos todavía: lanza una puerta o escribe un comando.</p>
          ) : (
            eventos.map((evento, indice) => <LineaEvento key={`${evento.runId}-${String(indice)}`} evento={evento} />)
          )}
        </ul>
        {resumenFinal && <TarjetaResumen resumen={resumenFinal} />}
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex gap-1.5">
          <input
            value={comando}
            onChange={(evento) => setComando(evento.target.value)}
            onKeyDown={(evento) => {
              if (evento.key === "Enter") enviar();
            }}
            disabled={enviando}
            placeholder="record --headed <url>"
            className="flex-1 rounded-6 border border-border-strong bg-bg-panel px-2 py-1 text-sm text-text-strong"
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
