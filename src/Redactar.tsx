import { AccionDeshabilitada, BarraLanzamientoDeshabilitada } from "./AccionDeshabilitada";
import { Panel } from "./Panel";

// Bloque 5: misma geometría que `panels.redactar` del mockup (design/mockup-design.js) —
// izquierda 25 %, centro 46 % (arranca en 26.5 %), derecha 26 % (arranca en 74 %), los tres a
// 100 % de alto — pero los tres paneles quedan vacíos: el agente `redactor` no existe todavía en
// este ecosistema (ver ESTADO.md de Agente-QA-MCP), así que no hay candidatos verificados ni
// Gherkin que enseñar, ni nadie al otro lado del chat.
const MOTIVO_REDACTOR =
  "El agente redactor no existe todavía: no hay ningún proceso que convierta candidatos de escenario verificados en ficheros .feature.";

export function Redactar() {
  return (
    <div className="flex h-full flex-col gap-2.5 p-4">
      <div className="relative flex-1" data-canvas="true">
        <Panel
          tabId="redactar"
          panelId="lista"
          titulo="Features y escenarios"
          disposicionPorDefecto={{ x: 0, y: 0, w: 25, h: 100, z: 1 }}
        >
          <AccionDeshabilitada motivo={MOTIVO_REDACTOR} />
        </Panel>

        <Panel
          tabId="redactar"
          panelId="detalle"
          titulo="Detalle del escenario"
          disposicionPorDefecto={{ x: 26.5, y: 0, w: 46, h: 100, z: 1 }}
        >
          <AccionDeshabilitada motivo={MOTIVO_REDACTOR} />
        </Panel>

        <Panel
          tabId="redactar"
          panelId="chat"
          titulo="Hablar con el agente"
          disposicionPorDefecto={{ x: 74, y: 0, w: 26, h: 100, z: 1 }}
        >
          <AccionDeshabilitada motivo={MOTIVO_REDACTOR} />
        </Panel>
      </div>

      <BarraLanzamientoDeshabilitada motivo={MOTIVO_REDACTOR} etiquetaBoton="▶️ Redactar" />
    </div>
  );
}
