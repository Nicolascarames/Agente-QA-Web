import { AccionDeshabilitada, BarraLanzamientoDeshabilitada } from "./AccionDeshabilitada";
import { Panel } from "./Panel";

// Bloque 6: misma geometría que `panels.ejecutar` del mockup (design/mockup-design.js) —
// izquierda 25 %, centro 46 % (arranca en 26.5 %), derecha 26 % (arranca en 74 %), los tres a
// 100 % de alto — pero vacíos: el agente ejecutor no existe todavía (ver ESTADO.md de
// Agente-QA-MCP). Diferencia real frente a Redactar/Generar/Explorar (regla de fidelidad 4): el
// mockup no le pone fila "🤖 Agente" a la barra de esta pestaña porque, cuando exista, correrá
// tests Playwright deterministas — no hay puerta que elegir ni LLM que pagar — así que
// `sinAgente` la oculta y `coste` fija `$0,00 · sin llamadas LLM`: es un hecho estructural, no un
// dato inventado.
const MOTIVO_EJECUTOR =
  "El agente ejecutor no existe todavía: no hay ningún proceso que corra los tests Playwright generados ni guarde su evidencia.";

export function Ejecutar() {
  return (
    <div className="flex h-full flex-col gap-2.5 p-4">
      <div className="relative flex-1" data-canvas="true">
        <Panel
          tabId="ejecutar"
          panelId="lista"
          titulo="Tests con spec compilada"
          disposicionPorDefecto={{ x: 0, y: 0, w: 25, h: 100, z: 1 }}
        >
          <AccionDeshabilitada motivo={MOTIVO_EJECUTOR} />
        </Panel>

        <Panel
          tabId="ejecutar"
          panelId="detalle"
          titulo="Pasos de este test (en vivo) y evidencia"
          disposicionPorDefecto={{ x: 26.5, y: 0, w: 46, h: 100, z: 1 }}
        >
          <AccionDeshabilitada motivo={MOTIVO_EJECUTOR} />
        </Panel>

        <Panel
          tabId="ejecutar"
          panelId="chat"
          titulo="Hablar con el agente"
          disposicionPorDefecto={{ x: 74, y: 0, w: 26, h: 100, z: 1 }}
        >
          <AccionDeshabilitada motivo={MOTIVO_EJECUTOR} />
        </Panel>
      </div>

      <BarraLanzamientoDeshabilitada
        motivo={MOTIVO_EJECUTOR}
        etiquetaBoton="▶️ Ejecutar"
        sinAgente
        coste="$0,00 · sin llamadas LLM"
      />
    </div>
  );
}
