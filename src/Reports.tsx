import { AccionDeshabilitada } from "./AccionDeshabilitada";
import { Panel } from "./Panel";

// Bloque 7: misma geometría que `panels.reports` del mockup (design/mockup-design.js) — tres
// cajas de estadística en fila (32×34 cada una), `filt` a ancho completo debajo (100×15) y
// `causes`/`hist` repartiendo el resto (48/49 % de ancho, 41 % de alto) — pero todo vacío: Reports
// consulta `test_results`, y ese dato solo lo llenaría un agente ejecutor que todavía no existe
// (ver ESTADO.md de Agente-QA-MCP). Diferencia real frente a las otras siete pestañas (regla de
// fidelidad 4): el mockup ya la deja "sin chat, sin agente — no es una operación", así que aquí no
// hay ni `Chat.tsx` ni `BarraLanzamiento`/`BarraLanzamientoDeshabilitada`, a diferencia de las seis
// pestañas de operación.
const MOTIVO_REPORTS =
  "No hay test_results que consultar: el agente ejecutor no existe todavía, así que ninguna corrida ha guardado resultados.";

// Etiquetas reales de `reportStatDefs` en el mockup (Pass rate / Flaky tests / Fallos abiertos):
// son categorías estructurales de un informe de tests, no atrezo — se conservan como título de
// cada caja. Lo que sí es atrezo y se descarta (regla de fidelidad 5) son sus valores fijos
// (86 %, 7, 15) y los colores por caja: sin test_results no hay pass rate que calcular.
const ETIQUETAS_STATS = ["Pass rate", "Flaky tests", "Fallos abiertos"];
const GEOMETRIA_STATS = [0, 34, 68].map((x) => ({ x, y: 0, w: 32, h: 34, z: 1 }));
const GEOMETRIA_FILT = { x: 0, y: 38, w: 100, h: 15, z: 1 };
const GEOMETRIA_CAUSES = { x: 0, y: 57, w: 48, h: 41, z: 1 };
const GEOMETRIA_HIST = { x: 51, y: 57, w: 49, h: 41, z: 1 };

export function Reports() {
  return (
    <div className="relative h-full p-4" data-canvas="true">
      {GEOMETRIA_STATS.map((geometria, i) => (
        <Panel key={`s${String(i)}`} tabId="reports" panelId={`s${String(i)}`} titulo={ETIQUETAS_STATS[i]} disposicionPorDefecto={geometria}>
          <AccionDeshabilitada motivo={MOTIVO_REPORTS} />
        </Panel>
      ))}

      <Panel tabId="reports" panelId="filt" titulo="🔎 Filtros" disposicionPorDefecto={GEOMETRIA_FILT}>
        <AccionDeshabilitada motivo={MOTIVO_REPORTS} />
      </Panel>

      <Panel tabId="reports" panelId="causes" titulo="Fallos agrupados por causa" disposicionPorDefecto={GEOMETRIA_CAUSES}>
        <AccionDeshabilitada motivo={MOTIVO_REPORTS} />
      </Panel>

      <Panel tabId="reports" panelId="hist" titulo="Historial de ejecuciones" disposicionPorDefecto={GEOMETRIA_HIST}>
        <div className="flex h-full flex-col gap-2">
          <button
            type="button"
            disabled
            title={MOTIVO_REPORTS}
            className="cursor-not-allowed self-end rounded-6 border border-border-soft bg-bg-sunken px-2.5 py-1.5 text-2xs text-text-ghost"
          >
            ⬇️ Exportar
          </button>
          <div className="flex-1">
            <AccionDeshabilitada motivo={MOTIVO_REPORTS} />
          </div>
        </div>
      </Panel>
    </div>
  );
}
