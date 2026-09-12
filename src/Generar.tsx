import { useEffect, useRef, useState } from "react";
import { Panel } from "./Panel";
import { commitGenerados, descartarGenerados, guardarContenidoGenerado, obtenerContenidoGenerado, obtenerDiffGenerado, obtenerGenerados } from "./api";

// Bloque 6: misma geometría que `panels.generar` del mockup (design/mockup-design.js) —
// izquierda 25 %, centro 46 % (arranca en 26.5 %), derecha 26 % (arranca en 74 %) — pero ahora
// con datos reales de `tests/pages/*.page.ts` y `tests/specs/*.spec.ts`, en vez de los tres
// paneles vacíos del Bloque 5.
//
// La `BarraLanzamientoDeshabilitada` del Bloque 5 desaparece por el mismo motivo que en
// Redactar.tsx: el agente ya existe y se lanza desde el chat de la derecha, no desde una barra de
// "🎯 Ámbito / 🤖 Agente / 💰 coste" que nunca tuvo datos reales que mostrar.

interface FicheroGenerado {
  tipo: "pages" | "specs";
  nombre: string;
  ruta: string;
}

export function Generar({ corridaActiva }: { corridaActiva?: string | null }) {
  const [ficheros, setFicheros] = useState<FicheroGenerado[]>([]);
  const [seleccionado, setSeleccionado] = useState<FicheroGenerado | null>(null);
  const [diff, setDiff] = useState<string>("");
  const [errorDiff, setErrorDiff] = useState<string | null>(null);
  const [contenido, setContenido] = useState<string>("");
  const [cargando, setCargando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargarLista = () => {
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
  };

  useEffect(cargarLista, []);

  // Mismo fix que Redactar.tsx: el agente escribe .page.ts/.spec.ts directo en disco, así que la
  // lista de la izquierda necesita recargarse cuando termina un turno, no solo al montar la pestaña.
  const corridaActivaAnterior = useRef(corridaActiva ?? null);
  useEffect(() => {
    if (corridaActivaAnterior.current && !corridaActiva) {
      cargarLista();
    }
    corridaActivaAnterior.current = corridaActiva ?? null;
  }, [corridaActiva]);

  // El contenido crudo (fs.readFile) y el diff (comando `git`) se piden por separado a propósito:
  // un repo destino sin `git` utilizable (p.ej. `pruebas/sauce`, fuera de git a propósito, ver
  // ESTADO.md) no debe impedir ver ni editar el fichero, solo la sección de diff.
  const cargarContenido = (fichero: FicheroGenerado) => {
    setCargando(true);
    setError(null);
    obtenerContenidoGenerado(fichero.ruta)
      .then((respuesta) => {
        setContenido(respuesta.contenido);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setCargando(false));
  };

  const cargarDiff = (fichero: FicheroGenerado) => {
    setErrorDiff(null);
    obtenerDiffGenerado(fichero.ruta)
      .then((respuesta) => {
        setDiff(respuesta.diff);
      })
      .catch((err: unknown) => {
        setDiff("");
        setErrorDiff(err instanceof Error ? err.message : String(err));
      });
  };

  const cargarDetalle = (fichero: FicheroGenerado) => {
    cargarContenido(fichero);
    cargarDiff(fichero);
  };

  useEffect(() => {
    if (!seleccionado) {
      setDiff("");
      setErrorDiff(null);
      setContenido("");
      return;
    }
    cargarDetalle(seleccionado);
  }, [seleccionado]);

  const guardar = () => {
    if (!seleccionado) return;
    setGuardando(true);
    setError(null);
    guardarContenidoGenerado(seleccionado.ruta, contenido)
      .then(() => {
        cargarDetalle(seleccionado);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setGuardando(false));
  };

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
        <Panel tabId="generar" panelId="lista" titulo="Escenarios listos" disposicionPorDefecto={{ x: 0, y: 0, w: 30, h: 100, z: 1 }}>
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

        <Panel tabId="generar" panelId="detalle" titulo="Page Object y spec" disposicionPorDefecto={{ x: 31.5, y: 0, w: 68.5, h: 100, z: 1 }}>
          <div className="flex h-full flex-col gap-2 p-2">
            {!seleccionado ? (
              <p className="p-2 text-xs text-text-dim">Elige un fichero de la lista.</p>
            ) : cargando ? (
              <p className="p-2 text-xs text-text-dim">Cargando…</p>
            ) : (
              <>
                <textarea
                  value={contenido}
                  onChange={(e) => {
                    setContenido(e.target.value);
                  }}
                  spellCheck={false}
                  className="flex-1 resize-none rounded-7 border border-border-soft bg-bg-sunken p-2.5 font-mono text-2xs text-text-bright"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={guardar}
                    disabled={guardando}
                    className="rounded-7 border border-accent bg-accent px-3 py-1.5 text-xs font-bold text-on-accent disabled:opacity-50"
                  >
                    {guardando ? "Guardando…" : "Guardar"}
                  </button>
                  {error && <p className="text-xs text-danger">{error}</p>}
                </div>
                {errorDiff ? (
                  <p className="p-2 text-xs text-danger">No se pudo calcular el diff: {errorDiff}</p>
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
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
