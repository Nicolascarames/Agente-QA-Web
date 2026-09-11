import { useEffect, useState } from "react";
import { BarraLanzamientoDeshabilitada } from "./AccionDeshabilitada";
import { Panel } from "./Panel";
import { aplicarGenerado, descartarGenerado, enviarComando, obtenerDiffGenerado, obtenerTestsRojos } from "./api";
import type { EventoNdjson, ResultadoTestRojo, Sugerencia } from "../shared/tipos";

// Bloque 7: misma geometría que dejó el Bloque 6 — izquierda 25 %, centro 46 % (arranca en 26.5 %),
// derecha 26 % (arranca en 74 %), los tres a 100 % de alto — con la lista de rojos real
// (`GET /api/tests/rojos`) y el diff real de `/api/generados/*` (contrato del Bloque 6, en otro
// worktree en paralelo — hasta que se integre, esas tres rutas responden 404, esperado). El agente
// reparador en sí (clasificar y corregir) todavía no existe como proceso automático: se pide por el
// chat, igual que hoy; por eso la barra inferior se queda igual que en el placeholder.
const MOTIVO_REPARADOR =
  "El agente reparador no existe todavía: no hay ningún proceso que diagnostique un test en rojo ni proponga un diff de corrección.";

const ETIQUETA_SUGERENCIA: Record<Sugerencia, string> = {
  "fallo-test": "fallo del test",
  "fallo-aplicacion": "fallo de la aplicación",
  desconocido: "sin clasificar",
};

const COLOR_SUGERENCIA: Record<Sugerencia, string> = {
  "fallo-test": "text-info",
  "fallo-aplicacion": "text-danger",
  desconocido: "text-text-dim",
};

export interface RepararProps {
  corridaActiva: string | null;
  eventos: EventoNdjson[];
  marcarCorridaActiva: (etiqueta: string | null) => void;
}

export function Reparar({ corridaActiva, eventos, marcarCorridaActiva }: RepararProps) {
  const [rojos, setRojos] = useState<ResultadoTestRojo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seleccionado, setSeleccionado] = useState<number | null>(null);

  const recargar = () => {
    setCargando(true);
    obtenerTestsRojos()
      .then((datos) => {
        setRojos(datos);
        setSeleccionado((actual) => (actual !== null && actual < datos.length ? actual : datos.length > 0 ? 0 : null));
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        setCargando(false);
      });
  };

  useEffect(recargar, []);

  const rojoSeleccionado = seleccionado !== null ? rojos[seleccionado] : undefined;

  return (
    <div className="flex h-full flex-col gap-2.5 p-4">
      <div className="relative flex-1" data-canvas="true">
        <Panel tabId="reparar" panelId="lista" titulo="Tests en rojo" disposicionPorDefecto={{ x: 0, y: 0, w: 25, h: 100, z: 1 }}>
          {cargando ? (
            <p className="text-xs text-text-dim">Cargando…</p>
          ) : error ? (
            <p className="text-xs text-danger">{error}</p>
          ) : rojos.length === 0 ? (
            <p className="text-xs text-text-dim">Ningún test en rojo en el último reporte.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {rojos.map((rojo, indice) => (
                <li key={`${rojo.ficheroSpec}-${rojo.nombre}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setSeleccionado(indice);
                    }}
                    className={`flex w-full flex-col gap-0.5 rounded-7 border px-2.5 py-1.5 text-left text-xs ${
                      indice === seleccionado ? "border-accent bg-accent-bg" : "border-border-soft bg-bg-sunken"
                    }`}
                  >
                    <span className="font-semibold text-danger">❌ {rojo.nombre}</span>
                    <span className="truncate text-2xs text-text-faint">{rojo.ficheroSpec}</span>
                    <span
                      title="sugerencia automática, no definitiva"
                      className={`w-fit rounded-6 border border-border-soft px-1.5 py-0.5 text-2xs uppercase tracking-[.04em] ${COLOR_SUGERENCIA[rojo.sugerencia]}`}
                    >
                      {ETIQUETA_SUGERENCIA[rojo.sugerencia]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          tabId="reparar"
          panelId="detalle"
          titulo="Diagnóstico y propuesta"
          disposicionPorDefecto={{ x: 26.5, y: 0, w: 46, h: 100, z: 1 }}
        >
          {!rojoSeleccionado ? (
            <p className="text-xs text-text-dim">Selecciona un test en rojo de la lista.</p>
          ) : (
            <PropuestaDiff test={rojoSeleccionado} onCambio={recargar} />
          )}
        </Panel>

        <Panel
          tabId="reparar"
          panelId="chat"
          titulo="Hablar con el agente"
          disposicionPorDefecto={{ x: 74, y: 0, w: 26, h: 100, z: 1 }}
        >
          <ChatCorrida corridaActiva={corridaActiva} eventos={eventos} marcarCorridaActiva={marcarCorridaActiva} />
        </Panel>
      </div>

      <BarraLanzamientoDeshabilitada motivo={MOTIVO_REPARADOR} etiquetaBoton="▶️ Reparar" sinAgente />
    </div>
  );
}

/** Diagnóstico (mensaje de Playwright) + diff propuesto de `/api/generados/diff` (contrato del
 *  Bloque 6). `onCambio` recarga la lista de rojos tras aplicar/rechazar — un test reparado deja
 *  de estar en rojo, uno rechazado se queda igual pero el diff propuesto ya no existe. */
function PropuestaDiff({ test, onCambio }: { test: ResultadoTestRojo; onCambio: () => void }) {
  const [diff, setDiff] = useState<string | null>(null);
  const [errorDiff, setErrorDiff] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    setDiff(null);
    setErrorDiff(null);
    obtenerDiffGenerado(test.ficheroSpec)
      .then((respuesta) => {
        setDiff(respuesta.diff);
      })
      .catch((err: unknown) => {
        setErrorDiff(err instanceof Error ? err.message : String(err));
      });
  }, [test.ficheroSpec]);

  const aplicar = () => {
    setProcesando(true);
    aplicarGenerado(test.ficheroSpec)
      .then(onCambio)
      .catch((err: unknown) => {
        setErrorDiff(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        setProcesando(false);
      });
  };

  const rechazar = () => {
    setProcesando(true);
    descartarGenerado(test.ficheroSpec)
      .then(onCambio)
      .catch((err: unknown) => {
        setErrorDiff(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        setProcesando(false);
      });
  };

  return (
    <div className="flex h-full flex-col gap-2">
      {test.mensajeError && (
        <pre className="whitespace-pre-wrap break-all rounded-7 border border-border-soft bg-bg-sunken p-2 text-2xs text-danger">
          {test.mensajeError}
        </pre>
      )}
      <div className="flex-1 overflow-auto rounded-8 border border-border-soft bg-bg-sunken p-2">
        {errorDiff ? (
          <p className="text-xs text-danger">{errorDiff}</p>
        ) : diff === null ? (
          <p className="text-xs text-text-dim">Cargando diff…</p>
        ) : diff === "" ? (
          <p className="text-xs text-text-dim">Sin diff propuesto todavía.</p>
        ) : (
          <pre className="whitespace-pre-wrap break-all text-2xs">
            {diff.split("\n").map((linea, indice) => (
              <div
                key={String(indice)}
                className={linea.startsWith("-") ? "text-danger" : linea.startsWith("+") ? "text-ok" : "text-text-dim"}
              >
                {linea}
              </div>
            ))}
          </pre>
        )}
      </div>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={aplicar}
          disabled={procesando || !diff}
          title={!diff ? "sin diff propuesto todavía" : undefined}
          className="rounded-7 border border-border-soft bg-bg-sunken px-2.5 py-1.5 text-xs font-bold text-text-bright disabled:cursor-not-allowed disabled:opacity-50"
        >
          ✅ Aplicar y reejecutar
        </button>
        <button
          type="button"
          onClick={rechazar}
          disabled={procesando}
          className="rounded-7 border border-border-soft bg-bg-sunken px-2.5 py-1.5 text-xs text-text-bright disabled:cursor-not-allowed disabled:opacity-50"
        >
          ✖️ Rechazar
        </button>
      </div>
    </div>
  );
}

/**
 * Igual que el `ChatCorrida` de `Ejecutar.tsx` (ver su comentario): versión ligera del chat de
 * `ConsolaGlobal.tsx` sin volver a envolver en `<Panel tabId="global" panelId="consola">`, para no
 * duplicar esa clave de `localStorage`. El control completo sigue en la consola global (banda 2).
 */
function ChatCorrida({ corridaActiva, eventos, marcarCorridaActiva }: RepararProps) {
  const [comando, setComando] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = () => {
    const texto = comando.trim();
    if (!texto) return;
    setError(null);
    setEnviando(true);
    enviarComando(texto)
      .then((respuesta) => {
        marcarCorridaActiva(respuesta.runId);
        setComando("");
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        setEnviando(false);
      });
  };

  return (
    <div className="flex h-full flex-col gap-2">
      <ul className="flex-1 overflow-auto">
        {eventos.length === 0 ? (
          <p className="text-2xs text-text-dim">Sin eventos todavía — escribe aquí o baja a la consola global (↓).</p>
        ) : (
          eventos.slice(-30).map((evento, indice) => (
            <li key={`${evento.runId}-${String(indice)}`} className="truncate text-2xs text-text-faint">
              <span className="text-accent-soft">{evento.type}</span>
            </li>
          ))
        )}
      </ul>
      {error && <p className="text-2xs text-danger">{error}</p>}
      {corridaActiva && (
        <p className="text-2xs text-text-dim">
          corrida activa: {corridaActiva} — preguntas y control completo en la consola global (↓ Consola)
        </p>
      )}
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
  );
}
