import { useEffect, useState } from "react";
import { Panel } from "./Panel";
import { obtenerHistorial, obtenerInformes, obtenerTests, obtenerTestsRojos } from "./api";
import type { FilaTest, RegistroEjecucion, ResultadoTest, ResultadoTestRojo, ResumenInforme } from "../shared/tipos";

// Tres filas a todo el ancho y alto del contenedor, separación uniforme de 1.5 (GAP): tres cajas de
// estadística arriba, "Fallos agrupados"/"Historial" repartiendo la fila siguiente en dos columnas,
// y "Ejecuciones" (spec 2026-09-26) a todo el ancho debajo.
// El panel "Filtros" (banda vacía sin ningún control real que mostrar) se retiró — ver ESTADO.md —
// y la fila inferior creció para ocupar el hueco que dejaba, llegando igual que antes hasta el
// borde inferior sin sobrante.
const GAP = 1.5;
const COL_W = (100 - 2 * GAP) / 3;
const MITAD = (100 - GAP) / 2;
// Tres filas (antes dos): la nueva fila "Ejecuciones" (informes visuales, spec 2026-09-26) necesita
// su propio espacio a todo el ancho, debajo de "Fallos agrupados"/"Historial".
const FILA_STATS_H = 27;
const FILA_INF_Y = FILA_STATS_H + GAP;
const FILA_INF_H = 45;
const FILA_EJEC_Y = FILA_INF_Y + FILA_INF_H + GAP;
const FILA_EJEC_H = 100 - FILA_EJEC_Y;

const ETIQUETAS_STATS = ["Pass rate", "Flaky tests", "Fallos abiertos"];
const GEOMETRIA_STATS = [0, 1, 2].map((col) => ({ x: col * (COL_W + GAP), y: 0, w: COL_W, h: FILA_STATS_H, z: 1 }));
const GEOMETRIA_CAUSES = { x: 0, y: FILA_INF_Y, w: MITAD, h: FILA_INF_H, z: 1 };
const GEOMETRIA_HIST = { x: MITAD + GAP, y: FILA_INF_Y, w: MITAD, h: FILA_INF_H, z: 1 };

/** Verde=passed, rojo=failed+timedOut: mismo criterio que Dashboard.tsx y `server/reporter.ts`
 *  (que trata "interrupted" como fallo). */
function esRojo(estado: ResultadoTest["estado"]): boolean {
  return estado === "failed" || estado === "timedOut";
}

function contarVerdesRojos(resultados: { estado: ResultadoTest["estado"] }[]): { verdes: number; rojos: number } {
  return resultados.reduce(
    (acc, r) => ({
      verdes: acc.verdes + (r.estado === "passed" ? 1 : 0),
      rojos: acc.rojos + (esRojo(r.estado) ? 1 : 0),
    }),
    { verdes: 0, rojos: 0 },
  );
}

/** Cuenta tests inestables entre las últimas `n` entradas del historial: un test es flaky si, entre
 *  esas ejecuciones, aparece tanto en verde como en rojo. Se identifica por nombre+ficheroSpec. */
function contarFlaky(historial: RegistroEjecucion[]): number {
  // `historial` llega ordenado de más antigua a más reciente (server/costes.ts) — las últimas
  // por fecha son el final del array, no el principio.
  const ultimas = historial.slice(-5);
  const vistos = new Map<string, { verde: boolean; rojo: boolean }>();
  for (const registro of ultimas) {
    for (const resultado of registro.resultados) {
      const clave = `${resultado.ficheroSpec}::${resultado.nombre}`;
      const marca = vistos.get(clave) ?? { verde: false, rojo: false };
      if (resultado.estado === "passed") marca.verde = true;
      if (esRojo(resultado.estado)) marca.rojo = true;
      vistos.set(clave, marca);
    }
  }
  return [...vistos.values()].filter((m) => m.verde && m.rojo).length;
}

/** Pieza 5 de la spec de capturas (2026-09-26): lista de ejecuciones archivadas
 *  (`agente-qa-informes/`, distinto del "Historial de ejecuciones" de arriba, que es
 *  `agente-qa.historial.json` con coste/turnos del agente) con su informe embebido en un iframe. */
function PanelEjecuciones({
  informeAAbrir = null,
  onInformeAbierto = () => {},
}: {
  informeAAbrir?: string | null;
  onInformeAbierto?: () => void;
} = {}) {
  const [informes, setInformes] = useState<ResumenInforme[] | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);

  useEffect(() => {
    obtenerInformes()
      .then(setInformes)
      .catch(() => {
        setInformes([]);
      });
  }, []);

  useEffect(() => {
    if (!informeAAbrir) return;
    setAbierto(informeAAbrir);
    onInformeAbierto();
  }, [informeAAbrir, onInformeAbierto]);

  return (
    <div className="flex h-full gap-2">
      <div className="flex w-64 shrink-0 flex-col gap-1 overflow-auto">
        {!informes ? (
          <p className="p-2 text-xs text-text-dim">Cargando…</p>
        ) : informes.length === 0 ? (
          <p className="p-2 text-xs text-text-dim">Sin ejecuciones archivadas todavía.</p>
        ) : (
          informes.map((informe) => (
            <button
              key={informe.id}
              type="button"
              onClick={() => {
                setAbierto(informe.id);
              }}
              className={`flex flex-col gap-0.5 rounded-7 border px-2.5 py-1.5 text-left text-2xs ${
                abierto === informe.id ? "border-accent bg-accent-bg" : "border-border-soft bg-bg-sunken"
              }`}
            >
              <span className="text-text-bright">{new Date(informe.fecha).toLocaleString()}</span>
              <span className="text-text-faint">
                <span className="text-ok">{informe.verdes} verdes</span> · <span className="text-danger">{informe.rojos} rojos</span> ·{" "}
                {(informe.duracionMs / 1000).toFixed(1)}s
              </span>
            </button>
          ))
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        {!abierto ? (
          <p className="p-2 text-xs text-text-dim">Selecciona una ejecución.</p>
        ) : (
          <>
            <div className="flex gap-2">
              <a
                href={`/informes/${abierto}/playwright/index.html`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-6 border border-border-soft bg-bg-sunken px-2 py-1 text-2xs text-text-bright"
              >
                Abrir informe de Playwright
              </a>
              <a
                href={`/informes/${abierto}/informe.html`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-6 border border-border-soft bg-bg-sunken px-2 py-1 text-2xs text-text-bright"
              >
                Abrir HTML suelto
              </a>
            </div>
            <iframe title="Informe de la ejecución" src={`/informes/${abierto}/informe.html`} className="flex-1 rounded-7 border border-border-soft bg-white" />
          </>
        )}
      </div>
    </div>
  );
}

export function Reports({
  informeAAbrir = null,
  onInformeAbierto = () => {},
}: {
  informeAAbrir?: string | null;
  onInformeAbierto?: () => void;
} = {}) {
  const [tests, setTests] = useState<FilaTest[] | null>(null);
  const [rojos, setRojos] = useState<ResultadoTestRojo[] | null>(null);
  const [historial, setHistorial] = useState<RegistroEjecucion[] | null>(null);

  useEffect(() => {
    obtenerTests()
      .then(setTests)
      .catch(() => {
        setTests(null);
      });
    obtenerTestsRojos()
      .then(setRojos)
      .catch(() => {
        setRojos(null);
      });
    obtenerHistorial()
      .then(setHistorial)
      .catch(() => {
        setHistorial(null);
      });
  }, []);

  const passRate = tests && tests.length > 0 ? `${String(Math.round((tests.filter((t) => t.estado === "passed").length / tests.length) * 100))}%` : "Sin datos";
  const flaky = historial ? contarFlaky(historial) : undefined;
  const fallosAbiertos = rojos?.length;

  const causas =
    rojos &&
    [...rojos.reduce((mapa, r) => {
      const clave = r.mensajeError ?? "Sin mensaje de error";
      mapa.set(clave, (mapa.get(clave) ?? 0) + 1);
      return mapa;
    }, new Map<string, number>())].sort((a, b) => b[1] - a[1]);

  const historialOrdenado = historial ? [...historial].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) : undefined;

  return (
    <div className="flex h-full flex-col p-4">
      <div className="relative flex-1" data-canvas="true">
        <Panel tabId="reports" panelId="s0" titulo={ETIQUETAS_STATS[0]} disposicionPorDefecto={GEOMETRIA_STATS[0]}>
          <div className="flex h-full items-center justify-center text-3xl font-extrabold text-text-bright">{passRate}</div>
        </Panel>

        <Panel tabId="reports" panelId="s1" titulo={ETIQUETAS_STATS[1]} disposicionPorDefecto={GEOMETRIA_STATS[1]}>
          <div className="flex h-full items-center justify-center text-3xl font-extrabold text-text-bright">{flaky ?? "-"}</div>
        </Panel>

        <Panel tabId="reports" panelId="s2" titulo={ETIQUETAS_STATS[2]} disposicionPorDefecto={GEOMETRIA_STATS[2]}>
          <div className="flex h-full items-center justify-center text-3xl font-extrabold text-text-bright">{fallosAbiertos ?? "-"}</div>
        </Panel>

        <Panel tabId="reports" panelId="causes" titulo="Fallos agrupados por causa" disposicionPorDefecto={GEOMETRIA_CAUSES}>
          {!causas ? (
            <p className="p-3 text-xs text-text-dim">Cargando…</p>
          ) : causas.length === 0 ? (
            <p className="p-3 text-xs text-text-dim">Sin fallos abiertos.</p>
          ) : (
            <ul className="flex flex-col gap-1 overflow-auto p-2.5">
              {causas.map(([mensaje, conteo]) => (
                <li key={mensaje} className="flex items-start justify-between gap-2 border-b border-border pb-1 text-xs">
                  <span className="text-text-muted">{mensaje}</span>
                  <span className="shrink-0 font-bold text-danger">{conteo}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel tabId="reports" panelId="hist" titulo="Historial de ejecuciones" disposicionPorDefecto={GEOMETRIA_HIST}>
          <div className="flex h-full flex-col gap-2">
            <button
              type="button"
              disabled
              title="Exportar llega más adelante."
              className="cursor-not-allowed self-end rounded-6 border border-border-soft bg-bg-sunken px-2.5 py-1.5 text-2xs text-text-ghost"
            >
              ⬇️ Exportar
            </button>
            <div className="flex-1 overflow-auto">
              {!historialOrdenado ? (
                <p className="p-3 text-xs text-text-dim">Cargando…</p>
              ) : historialOrdenado.length === 0 ? (
                <p className="p-3 text-xs text-text-dim">Sin ejecuciones todavía.</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {historialOrdenado.map((registro) => {
                    const { verdes, rojos: numRojos } = contarVerdesRojos(registro.resultados);
                    return (
                      <li key={registro.timestamp} className="flex flex-col gap-0.5 border-b border-border pb-1.5 text-2xs">
                        <span className="text-text-bright">{new Date(registro.timestamp).toLocaleString()}</span>
                        <span className="text-text-faint">
                          <span className="text-ok">{verdes} verdes</span> · <span className="text-danger">{numRojos} rojos</span> · $
                          {registro.costeUsd.toFixed(4)} · {(registro.duracionMs / 1000).toFixed(1)}s
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </Panel>

        <Panel
          tabId="reports"
          panelId="ejecuciones"
          titulo="Ejecuciones"
          disposicionPorDefecto={{ x: 0, y: FILA_EJEC_Y, w: 100, h: FILA_EJEC_H, z: 1 }}
        >
          <PanelEjecuciones informeAAbrir={informeAAbrir} onInformeAbierto={onInformeAbierto} />
        </Panel>
      </div>
    </div>
  );
}
