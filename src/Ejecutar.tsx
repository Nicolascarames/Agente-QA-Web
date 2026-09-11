import { useEffect, useState } from "react";
import { BarraLanzamientoDeshabilitada } from "./AccionDeshabilitada";
import { Panel } from "./Panel";
import { enviarComando, obtenerTests } from "./api";
import type { EventoNdjson, ResultadoTest } from "../shared/tipos";

// Bloque 7: mismos tres paneles que el Bloque 6 dejó vacíos (misma geometría — izquierda 25 %,
// centro 46 % arrancando en 26.5 %, derecha 26 % arrancando en 74 %, los tres a 100 % de alto —
// ver git blame de este fichero), ahora con datos reales del último `GET /api/tests`: no hay
// runner de Playwright en el servidor (fuera de alcance), así que esta pestaña solo LEE el reporte
// que ya exista en disco (`server/reporter.ts`), nunca lo lanza. Por eso la barra inferior se queda
// igual que en el placeholder: sin fila "🤖 Agente" (`sinAgente`) y con el coste real conocido de
// antemano (`coste="coste: $0,00 — sin llamadas LLM"`, un hecho estructural, no un dato inventado).
const MOTIVO_EJECUTOR =
  "El agente ejecutor no existe todavía: no hay ningún proceso que corra los tests Playwright generados ni guarde su evidencia.";

const ICONO_ESTADO: Record<ResultadoTest["estado"], string> = {
  passed: "✅",
  failed: "❌",
  timedOut: "⏱️",
  skipped: "⏭️",
};

const COLOR_ESTADO: Record<ResultadoTest["estado"], string> = {
  passed: "text-ok",
  failed: "text-danger",
  timedOut: "text-danger",
  skipped: "text-text-dim",
};

const COLOR_PASO: Record<"passed" | "failed" | "skipped", string> = {
  passed: "text-ok",
  failed: "text-danger",
  skipped: "text-text-dim",
};

export interface EjecutarProps {
  corridaActiva: string | null;
  eventos: EventoNdjson[];
  marcarCorridaActiva: (etiqueta: string | null) => void;
}

export function Ejecutar({ corridaActiva, eventos, marcarCorridaActiva }: EjecutarProps) {
  const [tests, setTests] = useState<ResultadoTest[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seleccionado, setSeleccionado] = useState<number | null>(null);

  useEffect(() => {
    obtenerTests()
      .then((datos) => {
        setTests(datos);
        setSeleccionado(datos.length > 0 ? 0 : null);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        setCargando(false);
      });
  }, []);

  const testSeleccionado = seleccionado !== null ? tests[seleccionado] : undefined;

  return (
    <div className="flex h-full flex-col gap-2.5 p-4">
      <div className="relative flex-1" data-canvas="true">
        <Panel
          tabId="ejecutar"
          panelId="lista"
          titulo="Tests con spec compilada"
          disposicionPorDefecto={{ x: 0, y: 0, w: 25, h: 100, z: 1 }}
        >
          {cargando ? (
            <p className="text-xs text-text-dim">Cargando…</p>
          ) : error ? (
            <p className="text-xs text-danger">{error}</p>
          ) : tests.length === 0 ? (
            <p className="text-xs text-text-dim">Sin reporte todavía: ejecuta `npx playwright test` en el proyecto.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {tests.map((test, indice) => (
                <li key={`${test.ficheroSpec}-${test.nombre}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setSeleccionado(indice);
                    }}
                    className={`flex w-full flex-col gap-0.5 rounded-7 border px-2.5 py-1.5 text-left text-xs ${
                      indice === seleccionado ? "border-accent bg-accent-bg" : "border-border-soft bg-bg-sunken"
                    }`}
                  >
                    <span className={`font-semibold ${COLOR_ESTADO[test.estado]}`}>
                      {ICONO_ESTADO[test.estado]} {test.nombre}
                    </span>
                    <span className="truncate text-2xs text-text-faint">{test.ficheroSpec}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          tabId="ejecutar"
          panelId="detalle"
          titulo="Pasos de este test (en vivo) y evidencia"
          disposicionPorDefecto={{ x: 26.5, y: 0, w: 46, h: 100, z: 1 }}
        >
          {!testSeleccionado ? (
            <p className="text-xs text-text-dim">Selecciona un test de la lista.</p>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-text-faint">
                {testSeleccionado.duracionMs} ms · {testSeleccionado.reintentos} reintento(s)
              </p>
              {testSeleccionado.mensajeError && (
                <pre className="whitespace-pre-wrap break-all rounded-7 border border-border-soft bg-bg-sunken p-2 text-2xs text-danger">
                  {testSeleccionado.mensajeError}
                </pre>
              )}
              <ul className="flex flex-col gap-1">
                {testSeleccionado.pasos.map((paso, indice) => (
                  <li key={`${paso.titulo}-${String(indice)}`} className={`text-xs ${COLOR_PASO[paso.estado]}`}>
                    {paso.estado === "passed" ? "✓" : paso.estado === "failed" ? "✗" : "…"} {paso.titulo}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>

        <Panel
          tabId="ejecutar"
          panelId="chat"
          titulo="Hablar con el agente"
          disposicionPorDefecto={{ x: 74, y: 0, w: 26, h: 100, z: 1 }}
        >
          <ChatCorrida corridaActiva={corridaActiva} eventos={eventos} marcarCorridaActiva={marcarCorridaActiva} />
        </Panel>
      </div>

      <BarraLanzamientoDeshabilitada
        motivo={MOTIVO_EJECUTOR}
        etiquetaBoton="▶️ Ejecutar"
        sinAgente
        coste="coste: $0,00 — sin llamadas LLM"
      />
    </div>
  );
}

/**
 * Versión ligera del chat de `ConsolaGlobal.tsx`: esa pieza trae su propio `<Panel
 * tabId="global" panelId="consola">` fijo, así que montarla aquí dentro de otro `<Panel>`
 * duplicaría esa clave de posición/tamaño en `localStorage` y anidaría dos cromos de panel
 * arrastrable. En su lugar, este componente reutiliza el mismo estado (`corridaActiva`/`eventos`/
 * `marcarCorridaActiva`, ya vive en `App.tsx`) y las mismas funciones de `api.ts`, pero sin volver
 * a envolver en `<Panel>` — el control completo (preguntas, Parar, Interrumpir) se queda en la
 * consola global de la banda 2, un scroll más abajo.
 */
function ChatCorrida({ corridaActiva, eventos, marcarCorridaActiva }: EjecutarProps) {
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
