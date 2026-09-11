import { useCallback, useEffect, useState } from "react";
import {
  obtenerActividad,
  obtenerEstado,
  obtenerFragiles,
  obtenerHistorial,
  obtenerTests,
  obtenerTrazabilidad,
  type ActividadDisponible,
  type ActividadNoDisponible,
} from "./api";
import { Panel, type DisposicionPanel } from "./Panel";
import type { CoberturaEscenario, ElementoFragil, EstadoProyecto, RegistroEjecucion, ResultadoTest } from "../shared/tipos";

type CargaEstado = { estado: "cargando" } | { estado: "error"; mensaje: string } | { estado: "listo"; datos: EstadoProyecto };

type CargaActividad =
  | { estado: "cargando" }
  | { estado: "listo"; datos: ActividadDisponible | ActividadNoDisponible };

// Cada una de las seis cajas del Bloque 8 depende de un endpoint distinto: si uno falla, solo esa
// caja se queda en guion, el resto de la vista sigue viva (criterio defensivo ya usado con
// `obtenerActividad` más abajo).
type CargaBloque<T> = { estado: "cargando" } | { estado: "error" } | { estado: "listo"; datos: T };

// Geometría de las seis cajas de estadística (Bloque 8), en dos filas de tres sobre el mismo ancho
// de columna que usaba `panels.dashboard` en el mockup. Debajo, "En curso ahora"/"Actividad
// reciente" ocupan lo que queda hasta el 98 % (mismo margen que el Bloque 2).
const GEOMETRIA_STATS: DisposicionPanel[] = [0, 1, 2, 0, 1, 2].map((col, i) => ({
  x: [0, 16.8, 33.6][col],
  y: i < 3 ? 0 : 16,
  w: 15.3,
  h: 14,
  z: 1,
}));
const GEOMETRIA_CUR: DisposicionPanel = { x: 0, y: 34, w: 48, h: 64, z: 1 };
const GEOMETRIA_ACT: DisposicionPanel = { x: 51, y: 34, w: 49, h: 64, z: 1 };

// Etiquetas de las cajas, en el mismo orden que GEOMETRIA_STATS.
const ETIQUETAS = ["Escenarios cubiertos", "Tests en verde", "Tests en rojo", "Última ejecución", "Coste acumulado", "Elementos frágiles"];

export function Dashboard() {
  const [estado, setEstado] = useState<CargaEstado>({ estado: "cargando" });
  const [actividad, setActividad] = useState<CargaActividad>({ estado: "cargando" });
  const [trazabilidad, setTrazabilidad] = useState<CargaBloque<CoberturaEscenario[]>>({ estado: "cargando" });
  const [tests, setTests] = useState<CargaBloque<ResultadoTest[]>>({ estado: "cargando" });
  const [historial, setHistorial] = useState<CargaBloque<RegistroEjecucion[]>>({ estado: "cargando" });
  const [fragiles, setFragiles] = useState<CargaBloque<ElementoFragil[]>>({ estado: "cargando" });

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
    void obtenerTrazabilidad()
      .then((datos) => {
        setTrazabilidad({ estado: "listo", datos });
      })
      .catch(() => {
        setTrazabilidad({ estado: "error" });
      });
    void obtenerTests()
      .then((datos) => {
        setTests({ estado: "listo", datos });
      })
      .catch(() => {
        setTests({ estado: "error" });
      });
    void obtenerHistorial()
      .then((datos) => {
        setHistorial({ estado: "listo", datos });
      })
      .catch(() => {
        setHistorial({ estado: "error" });
      });
    void obtenerFragiles()
      .then((datos) => {
        setFragiles({ estado: "listo", datos });
      })
      .catch(() => {
        setFragiles({ estado: "error" });
      });
  }, [recargarEstado]);

  // statBoxes[i] corresponde a ETIQUETAS[i]/GEOMETRIA_STATS[i]. Cada caja depende de su propio
  // endpoint (Bloque 8): mientras carga muestra el shimmer, y si el endpoint falló muestra un
  // guion en vez de tirar del hueco "Cargando…" para siempre.
  interface DatosCaja {
    valor: number | string | undefined;
    subtitulo?: string;
    destacado?: boolean;
  }

  const cajaCubiertos: DatosCaja =
    trazabilidad.estado === "listo"
      ? { valor: `${String(trazabilidad.datos.filter((c) => c.estado === "cubierto").length)}/${String(trazabilidad.datos.length)}`, subtitulo: "cubiertos" }
      : { valor: trazabilidad.estado === "error" ? "-" : undefined };

  const cajaVerdes: DatosCaja =
    tests.estado === "listo"
      ? { valor: tests.datos.filter((t) => t.estado === "passed").length, subtitulo: "passed", destacado: true }
      : { valor: tests.estado === "error" ? "-" : undefined };

  const cajaRojos: DatosCaja =
    tests.estado === "listo"
      ? { valor: tests.datos.filter((t) => t.estado === "failed" || t.estado === "timedOut").length, subtitulo: "failed / timedOut" }
      : { valor: tests.estado === "error" ? "-" : undefined };

  const ultimaEjecucion =
    historial.estado === "listo" && historial.datos.length > 0
      ? [...historial.datos].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
      : undefined;
  const cajaUltimaEjecucion: DatosCaja =
    historial.estado === "listo"
      ? { valor: ultimaEjecucion ? new Date(ultimaEjecucion.timestamp).toLocaleString() : "Sin ejecuciones todavía" }
      : { valor: historial.estado === "error" ? "-" : undefined };

  const cajaCoste: DatosCaja =
    historial.estado === "listo"
      ? { valor: `$${historial.datos.reduce((suma, r) => suma + r.costeUsd, 0).toFixed(4)}`, subtitulo: "acumulado" }
      : { valor: historial.estado === "error" ? "-" : undefined };

  const cajaFragiles: DatosCaja =
    fragiles.estado === "listo"
      ? { valor: fragiles.datos.length, subtitulo: "detectados" }
      : { valor: fragiles.estado === "error" ? "-" : undefined };

  const statBoxes = [cajaCubiertos, cajaVerdes, cajaRojos, cajaUltimaEjecucion, cajaCoste, cajaFragiles];
  const statCargando = [
    trazabilidad.estado === "cargando",
    tests.estado === "cargando",
    tests.estado === "cargando",
    historial.estado === "cargando",
    historial.estado === "cargando",
    fragiles.estado === "cargando",
  ];

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
              cargando={statCargando[i]}
              valor={statBoxes[i]?.valor}
              subtitulo={statBoxes[i]?.subtitulo}
              destacado={statBoxes[i]?.destacado}
            />
          ))}

          <Panel tabId="dashboard" panelId="cur" titulo="En curso ahora" disposicionPorDefecto={GEOMETRIA_CUR}>
            {estado.estado === "cargando" && <p className="text-text-dim">Cargando…</p>}
            {estado.estado === "listo" && !estado.datos.agenteQaInicializado && (
              <p className="text-accent-soft">No hay .agente-qa/ en este proyecto todavía.</p>
            )}
            {estado.estado === "listo" && estado.datos.agenteQaInicializado && (
              <p className="text-text-dim">Sin ejecución en curso.</p>
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
