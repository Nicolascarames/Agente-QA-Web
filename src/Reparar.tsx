import { useEffect, useState } from "react";
import { Panel } from "./Panel";
import { commitGenerados, descartarGenerados, guardarContenidoGenerado, obtenerContenidoGenerado, obtenerDiffGenerado, obtenerTestsRojos } from "./api";
import type { ResultadoTestRojo, Sugerencia } from "../shared/tipos";

// Bloque 7: misma geometría que dejó el Bloque 6 — izquierda 25 %, centro 46 % (arranca en 26.5 %),
// derecha 26 % (arranca en 74 %), los tres a 100 % de alto — con la lista de rojos real
// (`GET /api/tests/rojos`) y el diff real de `/api/generados/*` (contrato del Bloque 6, en otro
// worktree en paralelo — hasta que se integre, esas tres rutas responden 404, esperado).

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

export function Reparar({}: object) {
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
        <Panel tabId="reparar" panelId="lista" titulo="Tests en rojo" disposicionPorDefecto={{ x: 0, y: 0, w: 30, h: 100, z: 1 }}>
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
          disposicionPorDefecto={{ x: 31.5, y: 0, w: 68.5, h: 100, z: 1 }}
        >
          {!rojoSeleccionado ? (
            <p className="text-xs text-text-dim">Selecciona un test en rojo de la lista.</p>
          ) : (
            <PropuestaDiff test={rojoSeleccionado} onCambio={recargar} />
          )}
        </Panel>
      </div>
    </div>
  );
}

/** Diagnóstico (mensaje de Playwright) + diff propuesto de `/api/generados/diff` (contrato del
 *  Bloque 6). `onCambio` recarga la lista de rojos tras aplicar/rechazar — un test reparado deja
 *  de estar en rojo, uno rechazado se queda igual pero el diff propuesto ya no existe. */
function PropuestaDiff({ test, onCambio }: { test: ResultadoTestRojo; onCambio: () => void }) {
  const [diff, setDiff] = useState<string | null>(null);
  const [errorDiff, setErrorDiff] = useState<string | null>(null);
  const [contenido, setContenido] = useState("");
  const [cargandoContenido, setCargandoContenido] = useState(true);
  const [errorContenido, setErrorContenido] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Por separado a propósito, igual que en Generar.tsx: un repo destino sin `git` utilizable no
  // debe impedir ver ni editar el contenido crudo, solo la sección de diff propuesto.
  const cargarContenido = () => {
    setCargandoContenido(true);
    setErrorContenido(null);
    obtenerContenidoGenerado(test.ficheroSpec)
      .then((respuesta) => {
        setContenido(respuesta.contenido);
      })
      .catch((err: unknown) => {
        setErrorContenido(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        setCargandoContenido(false);
      });
  };

  const cargarDiff = () => {
    setDiff(null);
    setErrorDiff(null);
    obtenerDiffGenerado(test.ficheroSpec)
      .then((respuesta) => {
        setDiff(respuesta.diff);
      })
      .catch((err: unknown) => {
        setDiff("");
        setErrorDiff(err instanceof Error ? err.message : String(err));
      });
  };

  const cargar = () => {
    cargarContenido();
    cargarDiff();
  };

  useEffect(cargar, [test.ficheroSpec]);

  const guardar = () => {
    setGuardando(true);
    guardarContenidoGenerado(test.ficheroSpec, contenido)
      .then(cargar)
      .catch((err: unknown) => {
        setErrorContenido(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        setGuardando(false);
      });
  };

  const aplicar = () => {
    setProcesando(true);
    commitGenerados([test.ficheroSpec], `Aplica la reparación de ${test.ficheroSpec}`)
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
    descartarGenerados([test.ficheroSpec])
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
      <textarea
        value={contenido}
        onChange={(e) => {
          setContenido(e.target.value);
        }}
        disabled={cargandoContenido}
        spellCheck={false}
        className="h-40 resize-none rounded-7 border border-border-soft bg-bg-sunken p-2.5 font-mono text-2xs text-text-bright disabled:opacity-50"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={guardar}
          disabled={guardando || cargandoContenido}
          className="rounded-7 border border-accent bg-accent px-2.5 py-1.5 text-xs font-bold text-on-accent disabled:opacity-50"
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
        {errorContenido && <p className="text-xs text-danger">{errorContenido}</p>}
      </div>
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
