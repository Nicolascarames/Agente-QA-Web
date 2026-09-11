import { useCallback, useEffect, useState } from "react";
import { ejecutarInit, obtenerActividad, obtenerEstado, type ActividadDisponible, type ActividadNoDisponible } from "./api";
import { Panel, type DisposicionPanel } from "./Panel";
import type { EstadoProyecto } from "../shared/tipos";

type CargaEstado = { estado: "cargando" } | { estado: "error"; mensaje: string } | { estado: "listo"; datos: EstadoProyecto };

type CargaActividad =
  | { estado: "cargando" }
  | { estado: "listo"; datos: ActividadDisponible | ActividadNoDisponible };

// Geometría EXACTA de `panels.dashboard` en design/mockup-design.js, recortada a las tres cajas
// que quedan tras el Bloque 2: las otras tres ("Pantallas"/"Locators"/"Candidatos") contaban
// `map.json` del mapeador antiguo, que se borró entero con él — vuelven con datos reales cuando
// el Bloque 8 (Reports/Dashboard) exista.
const GEOMETRIA_STATS: DisposicionPanel[] = [0, 16.8, 33.6].map((x) => ({ x, y: 0, w: 15.3, h: 15, z: 1 }));
const GEOMETRIA_CUR: DisposicionPanel = { x: 0, y: 20, w: 48, h: 78, z: 1 };
const GEOMETRIA_ACT: DisposicionPanel = { x: 51, y: 20, w: 49, h: 78, z: 1 };

// Etiquetas de las cajas, en el mismo orden que GEOMETRIA_STATS.
const ETIQUETAS = ["Features", "e2e", "Informe"];

export function Dashboard() {
  const [estado, setEstado] = useState<CargaEstado>({ estado: "cargando" });
  const [actividad, setActividad] = useState<CargaActividad>({ estado: "cargando" });
  const [ejecutandoInit, setEjecutandoInit] = useState(false);

  const recargarEstado = useCallback(() => {
    return obtenerEstado()
      .then((datos) => {
        setEstado({ estado: "listo", datos });
      })
      .catch((err: unknown) => {
        setEstado({ estado: "error", mensaje: err instanceof Error ? err.message : String(err) });
      });
  }, []);

  useEffect(() => {
    void recargarEstado();
    void obtenerActividad()
      .then((datos) => {
        setActividad({ estado: "listo", datos });
      })
      .catch(() => {
        setActividad({ estado: "listo", datos: { disponible: false, motivo: "no se pudo consultar /api/actividad" } });
      });
  }, [recargarEstado]);

  const lanzarInit = useCallback(() => {
    setEjecutandoInit(true);
    void ejecutarInit()
      .then(() => recargarEstado())
      .catch(() => undefined)
      .finally(() => setEjecutandoInit(false));
  }, [recargarEstado]);

  // statBoxes[i] corresponde a ETIQUETAS[i]/GEOMETRIA_STATS[i]. Vacío mientras
  // carga o si /api/estado falló: las cajas igual se pintan (con el hueco
  // "Cargando…"), solo cambia lo que enseñan dentro.
  const statBoxes =
    estado.estado === "listo"
      ? [
          { valor: estado.datos.features.ficheros, subtitulo: estado.datos.features.estado, destacado: estado.datos.features.estado === "listo" },
          { valor: estado.datos.e2e.ficheros, subtitulo: estado.datos.e2e.estado, destacado: estado.datos.e2e.estado === "listo" },
          { valor: estado.datos.reporte.estado, destacado: estado.datos.reporte.estado === "listo" },
        ]
      : [];

  return (
    <div className="flex h-full w-full flex-col overflow-auto p-4">
      {estado.estado === "error" ? (
        <p className="text-accent">Error: {estado.mensaje}</p>
      ) : (
        <div className="relative flex-1" data-canvas="true">
          {GEOMETRIA_STATS.map((geometria, i) => (
            <CajaEstadistica
              key={`s${String(i)}`}
              panelId={`s${String(i)}`}
              disposicion={geometria}
              etiqueta={ETIQUETAS[i]}
              cargando={estado.estado === "cargando"}
              valor={statBoxes[i]?.valor}
              subtitulo={statBoxes[i]?.subtitulo}
              destacado={statBoxes[i]?.destacado}
            />
          ))}

          <Panel tabId="dashboard" panelId="cur" titulo="En curso ahora" disposicionPorDefecto={GEOMETRIA_CUR}>
            {estado.estado === "cargando" && <p className="text-text-dim">Cargando…</p>}
            {estado.estado === "listo" && !estado.datos.agenteQaInicializado && (
              <div className="flex items-center justify-between gap-3 rounded-8 border border-border-strong bg-accent-bg px-3 py-2">
                <span className="text-accent-soft">No hay .agente-qa/ en este proyecto.</span>
                <button
                  type="button"
                  onClick={lanzarInit}
                  disabled={ejecutandoInit}
                  className="rounded-6 border border-border-strong bg-bg-sunken px-3 py-1 text-accent-soft disabled:opacity-50"
                >
                  {ejecutandoInit ? "ejecutando init…" : "ejecutar init"}
                </button>
              </div>
            )}
            {estado.estado === "listo" && estado.datos.agenteQaInicializado && (
              <p className="text-text-dim">Sin corrida en curso — el indicador llega con la consola conectada al agente (Bloque 4).</p>
            )}
          </Panel>

          <Panel tabId="dashboard" panelId="act" titulo="Actividad reciente" disposicionPorDefecto={GEOMETRIA_ACT}>
            {actividad.estado === "cargando" && <p className="text-text-dim">Cargando…</p>}
            {actividad.estado === "listo" && !actividad.datos.disponible && <p className="text-accent">{actividad.datos.motivo}</p>}
            {actividad.estado === "listo" && actividad.datos.disponible && <p className="text-text">{actividad.datos.eventos.length} eventos.</p>}
          </Panel>
        </div>
      )}
    </div>
  );
}

function CajaEstadistica({
  panelId,
  disposicion,
  etiqueta,
  cargando,
  valor,
  subtitulo,
  destacado,
}: {
  panelId: string;
  disposicion: DisposicionPanel;
  etiqueta: string;
  cargando: boolean;
  valor: number | string | undefined;
  subtitulo?: string;
  destacado?: boolean;
}) {
  return (
    <Panel tabId="dashboard" panelId={panelId} titulo={etiqueta} disposicionPorDefecto={disposicion}>
      <div className="flex h-full items-center">
        {cargando ? (
          <div
            className="h-[22px] w-[70%] animate-shimmer rounded-6 bg-[length:400px_100%]"
            style={{ backgroundImage: "linear-gradient(90deg, var(--bg-elev) 25%, var(--border) 37%, var(--bg-elev) 63%)" }}
          />
        ) : (
          <div>
            <div className={`animate-fade-in text-3xl font-extrabold ${destacado ? "text-ok" : "text-text-bright"}`}>{valor}</div>
            {subtitulo && <div className="mt-0.5 text-2xs text-text-faint">{subtitulo}</div>}
          </div>
        )}
      </div>
    </Panel>
  );
}
