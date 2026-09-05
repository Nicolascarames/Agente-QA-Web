import { useCallback, useEffect, useState } from "react";
import { ejecutarInit, obtenerActividad, obtenerEstado, type ActividadDisponible, type ActividadNoDisponible } from "./api";
import { Panel } from "./Panel";
import type { EstadoProyecto } from "../shared/tipos";

type CargaEstado = { estado: "cargando" } | { estado: "error"; mensaje: string } | { estado: "listo"; datos: EstadoProyecto };

type CargaActividad =
  | { estado: "cargando" }
  | { estado: "listo"; datos: ActividadDisponible | ActividadNoDisponible };

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

  return (
    <div className="relative h-full w-full">
      <Panel
        tabId="dashboard"
        panelId="estado"
        titulo="Estado del proyecto"
        disposicionPorDefecto={{ x: 16, y: 16, width: 440, height: 300 }}
      >
        {estado.estado === "cargando" && <p>Cargando…</p>}
        {estado.estado === "error" && <p className="text-warning">Error: {estado.mensaje}</p>}
        {estado.estado === "listo" && (
          <EstadoProyectoResumen datos={estado.datos} onEjecutarInit={lanzarInit} ejecutandoInit={ejecutandoInit} />
        )}
      </Panel>

      <Panel
        tabId="dashboard"
        panelId="actividad"
        titulo="Actividad reciente"
        disposicionPorDefecto={{ x: 480, y: 16, width: 420, height: 260 }}
      >
        {actividad.estado === "cargando" && <p>Cargando…</p>}
        {actividad.estado === "listo" && !actividad.datos.disponible && (
          <p className="text-warning">{actividad.datos.motivo}</p>
        )}
        {actividad.estado === "listo" && actividad.datos.disponible && <p>{actividad.datos.eventos.length} eventos.</p>}
      </Panel>
    </div>
  );
}

function EstadoProyectoResumen({
  datos,
  onEjecutarInit,
  ejecutandoInit,
}: {
  datos: EstadoProyecto;
  onEjecutarInit: () => void;
  ejecutandoInit: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      {!datos.agenteQaInicializado && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-warning/50 bg-warning/10 px-3 py-2">
          <span className="text-warning">No hay .agente-qa/ en este proyecto.</span>
          <button
            type="button"
            onClick={onEjecutarInit}
            disabled={ejecutandoInit}
            className="rounded-md border border-accent/60 px-3 py-1 text-accent disabled:opacity-50"
          >
            {ejecutandoInit ? "ejecutando init…" : "ejecutar init"}
          </button>
        </div>
      )}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
        <dt className="text-text/60">Proyecto</dt>
        <dd className="truncate" title={datos.proyecto}>
          {datos.proyecto}
        </dd>

        <dt className="text-text/60">Pantallas</dt>
        <dd>{datos.mapa.pantallas}</dd>

        <dt className="text-text/60">Localizadores</dt>
        <dd>{datos.mapa.localizadores}</dd>

        <dt className="text-text/60">Candidatos de escenario</dt>
        <dd>{datos.mapa.candidatosEscenario}</dd>

        <dt className="text-text/60">Features</dt>
        <dd>
          {datos.features.estado} ({datos.features.ficheros})
        </dd>

        <dt className="text-text/60">e2e</dt>
        <dd>
          {datos.e2e.estado} ({datos.e2e.ficheros})
        </dd>

        <dt className="text-text/60">Informe</dt>
        <dd>{datos.reporte.estado}</dd>
      </dl>
    </div>
  );
}
