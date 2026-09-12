import { useEffect, useState } from "react";
import { Panel } from "./Panel";
import { obtenerTests } from "./api";
import type { ResultadoTest } from "../shared/tipos";

// Bloque 7: mismos tres paneles que el Bloque 6 dejó vacíos (misma geometría — izquierda 25 %,
// centro 46 % arrancando en 26.5 %, derecha 26 % arrancando en 74 %, los tres a 100 % de alto —
// ver git blame de este fichero), ahora con datos reales del último `GET /api/tests`: no hay
// runner de Playwright en el servidor (fuera de alcance), así que esta pestaña solo LEE el reporte
// que ya exista en disco (`server/reporter.ts`), nunca lo lanza.

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

export function Ejecutar({}: object) {
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
          disposicionPorDefecto={{ x: 0, y: 0, w: 30, h: 100, z: 1 }}
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
          disposicionPorDefecto={{ x: 31.5, y: 0, w: 67.5, h: 100, z: 1 }}
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
      </div>
    </div>
  );
}
