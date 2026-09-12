import { useEffect, useState } from "react";
import { Panel } from "./Panel";
import { ejecutarTests, obtenerContenidoGenerado, obtenerTests } from "./api";
import type { ResultadoTest } from "../shared/tipos";

// Bloque 7: mismos tres paneles que el Bloque 6 dejó vacíos (misma geometría — izquierda 25 %,
// centro 46 % arrancando en 26.5 %, derecha 26 % arrancando en 74 %, los tres a 100 % de alto —
// ver git blame de este fichero), ahora con datos reales del último `GET /api/tests`.
//
// Después del plan: el Bloque 7 decidió que esta pestaña solo LEÍA el reporte (`server/reporter.ts`)
// porque "no hay runner de Playwright en el servidor" — el usuario pidió poder lanzar los tests
// desde aquí, así que ese runner existe ahora (`server/ejecutorTests.ts`, botón por fila y "Ejecutar
// todos"). Sigue sin haber progreso en vivo paso a paso: `ejecutarTests` espera a que el proceso
// termine y esta pestaña recarga `/api/tests` con el reporte ya escrito, igual que si se hubiera
// lanzado a mano desde una terminal.

/** Nombre de fichero suelto a partir de lo que reporte Playwright en `ficheroSpec` (puede venir con
 *  ruta completa según el `testDir` del repo destino): la convención de esta app (Bloque 8,
 *  trazabilidad) es que el `.spec.ts` vive siempre en `tests/specs/<nombre>`, así que reconstruir la
 *  ruta por el nombre base es más fiable que confiar en el formato exacto que reportó Playwright. */
function rutaSpecDesdeFichero(ficheroSpec: string): string {
  const nombre = ficheroSpec.split(/[\\/]/).pop() ?? ficheroSpec;
  return `tests/specs/${nombre}`;
}

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
  // `null` = nada en marcha; "" = "Ejecutar todos"; cualquier otra cosa = la ruta de ese spec suelto.
  const [ejecutando, setEjecutando] = useState<string | null>(null);
  const [salidaEjecucion, setSalidaEjecucion] = useState<string | null>(null);
  const [codigoSpec, setCodigoSpec] = useState<string | null>(null);
  const [cargandoCodigo, setCargandoCodigo] = useState(false);

  const cargarTests = () => {
    setCargando(true);
    obtenerTests()
      .then((datos) => {
        setTests(datos);
        setSeleccionado((actual) => actual ?? (datos.length > 0 ? 0 : null));
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        setCargando(false);
      });
  };

  useEffect(cargarTests, []);

  const testSeleccionado = seleccionado !== null ? tests[seleccionado] : undefined;

  useEffect(() => {
    if (!testSeleccionado) {
      setCodigoSpec(null);
      return;
    }
    setCargandoCodigo(true);
    setCodigoSpec(null);
    obtenerContenidoGenerado(rutaSpecDesdeFichero(testSeleccionado.ficheroSpec))
      .then((respuesta) => {
        setCodigoSpec(respuesta.contenido);
      })
      .catch(() => {
        setCodigoSpec(null);
      })
      .finally(() => setCargandoCodigo(false));
  }, [testSeleccionado?.ficheroSpec]);

  const ejecutar = (ruta?: string) => {
    setEjecutando(ruta ?? "");
    setError(null);
    setSalidaEjecucion(null);
    ejecutarTests(ruta)
      .then((resultado) => {
        if (!resultado.ok) setSalidaEjecucion(resultado.salida);
        cargarTests();
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setEjecutando(null));
  };

  return (
    <div className="flex h-full flex-col gap-2.5 p-4">
      <div className="relative flex-1" data-canvas="true">
        <Panel
          tabId="ejecutar"
          panelId="lista"
          titulo="Tests con spec compilada"
          disposicionPorDefecto={{ x: 0, y: 0, w: 30, h: 100, z: 1 }}
        >
          <div className="flex h-full flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                ejecutar();
              }}
              disabled={ejecutando !== null}
              className="rounded-7 border border-accent bg-accent px-2.5 py-1.5 text-xs font-bold text-on-accent disabled:opacity-50"
            >
              {ejecutando === "" ? "Ejecutando toda la suite…" : "▶ Ejecutar todos"}
            </button>
            {cargando ? (
              <p className="text-xs text-text-dim">Cargando…</p>
            ) : error ? (
              <p className="text-xs text-danger">{error}</p>
            ) : tests.length === 0 ? (
              <p className="text-xs text-text-dim">Sin reporte todavía: pulsa "Ejecutar todos" o corre `npx playwright test` en el proyecto.</p>
            ) : (
              <ul className="flex flex-col gap-1 overflow-auto">
                {tests.map((test, indice) => {
                  const rutaSpec = rutaSpecDesdeFichero(test.ficheroSpec);
                  const ejecutandoEste = ejecutando === rutaSpec;
                  return (
                    <li key={`${test.ficheroSpec}-${test.nombre}`} className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSeleccionado(indice);
                        }}
                        className={`flex flex-1 flex-col gap-0.5 rounded-7 border px-2.5 py-1.5 text-left text-xs ${
                          indice === seleccionado ? "border-accent bg-accent-bg" : "border-border-soft bg-bg-sunken"
                        }`}
                      >
                        <span className={`font-semibold ${COLOR_ESTADO[test.estado]}`}>
                          {ICONO_ESTADO[test.estado]} {test.nombre}
                        </span>
                        <span className="truncate text-2xs text-text-faint">{test.ficheroSpec}</span>
                      </button>
                      <button
                        type="button"
                        title={`Ejecutar solo ${test.ficheroSpec}`}
                        onClick={() => {
                          ejecutar(rutaSpec);
                        }}
                        disabled={ejecutando !== null}
                        className="shrink-0 rounded-7 border border-border-soft bg-bg-sunken px-2 py-1.5 text-xs disabled:opacity-50"
                      >
                        {ejecutandoEste ? "…" : "▶"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Panel>

        <Panel
          tabId="ejecutar"
          panelId="detalle"
          titulo={testSeleccionado ? testSeleccionado.ficheroSpec : "Pasos y código de este test"}
          disposicionPorDefecto={{ x: 31.5, y: 0, w: 68.5, h: 100, z: 1 }}
        >
          {!testSeleccionado ? (
            <p className="text-xs text-text-dim">Selecciona un test de la lista.</p>
          ) : (
            <div className="flex h-full flex-col gap-2">
              <p className="text-xs text-text-faint">
                {testSeleccionado.duracionMs} ms · {testSeleccionado.reintentos} reintento(s)
              </p>
              {salidaEjecucion && (
                <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-all rounded-7 border border-danger bg-bg-sunken p-2 text-2xs text-danger">
                  {salidaEjecucion}
                </pre>
              )}
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
              <p className="text-2xs uppercase tracking-[.05em] text-text-faint">{testSeleccionado.ficheroSpec}</p>
              {cargandoCodigo ? (
                <p className="text-xs text-text-dim">Cargando código…</p>
              ) : codigoSpec === null ? (
                <p className="text-xs text-text-dim">No se pudo cargar el código de este spec.</p>
              ) : (
                <pre className="flex-1 overflow-auto whitespace-pre rounded-7 border border-border-soft bg-bg-sunken p-2.5 font-mono text-2xs text-text-bright">
                  {codigoSpec}
                </pre>
              )}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
