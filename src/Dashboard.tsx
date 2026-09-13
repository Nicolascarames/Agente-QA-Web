import { useCallback, useEffect, useState } from "react";
import { obtenerEstado, obtenerFragiles, obtenerHistorial, obtenerTests, obtenerTrazabilidad } from "./api";
import { Panel, type DisposicionPanel } from "./Panel";
import type { CoberturaEscenario, ElementoFragil, EstadoProyecto, RegistroEjecucion, ResultadoTest } from "../shared/tipos";

type CargaEstado = { estado: "cargando" } | { estado: "error"; mensaje: string } | { estado: "listo"; datos: EstadoProyecto };

// Cada una de las seis cajas del Bloque 8 depende de un endpoint distinto: si uno falla, solo esa
// caja se queda en guion, el resto de la vista sigue viva.
type CargaBloque<T> = { estado: "cargando" } | { estado: "error" } | { estado: "listo"; datos: T };

// Geometría de las seis cajas de estadística (Bloque 8), en dos filas de tres a todo el ancho y
// alto del contenedor. "En curso ahora"/"Actividad reciente" (paneles del sistema de configuración
// anterior, `.agente-qa/` y `agente-qa-mcp metrics`, ninguno de los dos vuelve — ver ESTADO.md) se
// retiraron: las seis cajas ocupan ahora las dos filas completas. Separación uniforme de 1.5 (GAP)
// en horizontal y vertical, sin dejar sobrante: cada fila/columna llega hasta el borde del
// contenedor.
const GAP = 1.5;
const COL_W = (100 - 2 * GAP) / 3;
const FILA_H = (100 - GAP) / 2;
const GEOMETRIA_STATS: DisposicionPanel[] = [0, 1, 2, 0, 1, 2].map((col, i) => ({
  x: col * (COL_W + GAP),
  y: i < 3 ? 0 : FILA_H + GAP,
  w: COL_W,
  h: FILA_H,
  z: 1,
}));

// Etiquetas de las cajas, en el mismo orden que GEOMETRIA_STATS.
const ETIQUETAS = ["Escenarios cubiertos", "Tests en verde", "Tests en rojo", "Última ejecución", "Coste acumulado", "Elementos frágiles"];

export function Dashboard() {
  const [estado, setEstado] = useState<CargaEstado>({ estado: "cargando" });
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
