import { useEffect, useRef, useState } from "react";
import { Panel } from "./Panel";
import { EditorCodigo } from "./EditorCodigo";
import { commitGenerados, descartarGenerados, guardarContenidoGenerado, obtenerContenidoGenerado, obtenerDiffGenerado, obtenerGenerados } from "./api";
import { rutaUltimoFicheroEscrito } from "./ConsolaGlobal";
import { pestanaParaRuta } from "./pestanaParaRuta";
import type { EventoNdjson } from "../shared/tipos";

// GAP=1.5 entre lista y detalle, mismo patrón que Dashboard/Reports (ver ESTADO.md): un tercio para
// la lista, dos tercios para el detalle, sin dejar hueco ni sobrar ancho.
const GAP = 1.5;
const ANCHO_LISTA = (100 - GAP) / 3;
const ANCHO_DETALLE = ANCHO_LISTA * 2;
//
// La `BarraLanzamientoDeshabilitada` del Bloque 5 desaparece por el mismo motivo que en
// Redactar.tsx: el agente ya existe y se lanza desde el chat de la derecha, no desde una barra de
// "🎯 Ámbito / 🤖 Agente / 💰 coste" que nunca tuvo datos reales que mostrar.

interface FicheroGenerado {
  tipo: "pages" | "specs";
  nombre: string;
  ruta: string;
}

export function Generar({ corridaActiva, eventos }: { corridaActiva?: string | null; eventos?: EventoNdjson[] }) {
  const [ficheros, setFicheros] = useState<FicheroGenerado[]>([]);
  const [seleccionado, setSeleccionado] = useState<FicheroGenerado | null>(null);
  const [diff, setDiff] = useState<string>("");
  const [errorDiff, setErrorDiff] = useState<string | null>(null);
  const [sinControlDeVersiones, setSinControlDeVersiones] = useState<string | null>(null);
  const [contenido, setContenido] = useState<string>("");
  const [cargando, setCargando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
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

  // Mismo fix que Redactar.tsx: la pregunta de confirmación de una puerta llega a media corrida, y
  // el salto de pestaña de `ConsolaGlobal` no remonta este componente si ya se estaba en Generar —
  // recargar aquí también en cuanto llega la pregunta, si el fichero que la motivó es de esta pestaña.
  const requestIdVisto = useRef<unknown>(undefined);
  useEffect(() => {
    if (!eventos) return;
    const ultimo = eventos[eventos.length - 1];
    if (ultimo?.type !== "agente.pregunta") return;
    const requestId = (ultimo.data as { requestId?: unknown } | undefined)?.requestId;
    if (requestId === requestIdVisto.current) return;
    requestIdVisto.current = requestId;
    const ruta = rutaUltimoFicheroEscrito(eventos);
    if (ruta && pestanaParaRuta(ruta) === "Generar") cargarLista();
  }, [eventos]);

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
    setSinControlDeVersiones(null);
    obtenerDiffGenerado(fichero.ruta)
      .then((respuesta) => {
        setDiff(respuesta.diff);
        setSinControlDeVersiones(respuesta.sinControlDeVersiones ?? null);
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
    setGuardado(false);
  }, [seleccionado]);

  const guardar = () => {
    if (!seleccionado) return;
    setGuardando(true);
    setGuardado(false);
    setError(null);
    guardarContenidoGenerado(seleccionado.ruta, contenido)
      .then(() => {
        cargarDetalle(seleccionado);
        setGuardado(true);
        setTimeout(() => setGuardado(false), 2000);
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
        <Panel tabId="generar" panelId="lista" titulo="Escenarios listos" disposicionPorDefecto={{ x: 0, y: 0, w: ANCHO_LISTA, h: 100, z: 1 }}>
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
                    title={fichero.nombre}
                    className={`flex w-full items-center gap-1.5 rounded-6 px-2 py-1.5 text-left text-xs ${
                      fichero.ruta === seleccionado?.ruta ? "bg-accent-bg font-semibold text-accent-soft" : "text-text-muted hover:text-text"
                    }`}
                  >
                    <span className="shrink-0 text-2xs uppercase text-text-faint">{fichero.tipo === "pages" ? "PO" : "spec"}</span>
                    {/* `min-w-0` + `truncate`: sin ellos, un nombre de fichero largo no se recorta
                        (min-width:auto de un item flex no baja del ancho del texto) y desborda la
                        fila con scroll horizontal en vez de un ellipsis. */}
                    <span className="min-w-0 flex-1 truncate">{fichero.nombre}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          tabId="generar"
          panelId="detalle"
          titulo="Page Object y spec"
          disposicionPorDefecto={{ x: ANCHO_LISTA + GAP, y: 0, w: ANCHO_DETALLE, h: 100, z: 1 }}
        >
          <div className="flex h-full flex-col gap-2 p-2">
            {!seleccionado ? (
              <p className="p-2 text-xs text-text-dim">Elige un fichero de la lista.</p>
            ) : cargando ? (
              <p className="p-2 text-xs text-text-dim">Cargando…</p>
            ) : (
              <>
                <EditorCodigo lenguaje="typescript" valor={contenido} onCambio={setContenido} />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={guardar}
                    disabled={guardando}
                    className="rounded-7 border border-accent bg-accent px-3 py-1.5 text-xs font-bold text-on-accent disabled:opacity-50"
                  >
                    {guardando ? "Guardando…" : guardado ? "Guardado ✓" : "Guardar"}
                  </button>
                  {error && <p className="text-xs text-danger">{error}</p>}
                </div>
                {errorDiff ? (
                  <p className="p-2 text-xs text-danger">No se pudo calcular el diff: {errorDiff}</p>
                ) : sinControlDeVersiones ? (
                  <p className="p-2 text-xs text-text-dim">{sinControlDeVersiones}</p>
                ) : diff.trim() === "" ? (
                  <p className="p-2 text-xs text-text-dim">Sin cambios pendientes que mostrar: {seleccionado.nombre} coincide con el commit.</p>
                ) : (
                  <>
                    <EditorCodigo lenguaje="diff" valor={diff} soloLectura />
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
