import { AccionDeshabilitada, BarraLanzamientoDeshabilitada } from "./AccionDeshabilitada";
import { Panel } from "./Panel";

// Bloque 5: misma geometría que `panels.generar` del mockup (design/mockup-design.js) —
// izquierda 25 %, centro 46 % (arranca en 26.5 %), derecha 26 % (arranca en 74 %) — pero los tres
// paneles quedan vacíos: el agente `generador` no existe todavía (ver ESTADO.md de
// Agente-QA-MCP), así que no hay escenarios listos, Page Object ni spec que enseñar.
const MOTIVO_GENERADOR =
  "El agente generador no existe todavía: no hay ningún proceso que convierta ficheros .feature en tests Playwright en TypeScript.";

export function Generar() {
  return (
    <div className="flex h-full flex-col gap-2.5 p-4">
      <div className="relative flex-1" data-canvas="true">
        <Panel
          tabId="generar"
          panelId="lista"
          titulo="Escenarios listos"
          disposicionPorDefecto={{ x: 0, y: 0, w: 25, h: 100, z: 1 }}
        >
          <AccionDeshabilitada motivo={MOTIVO_GENERADOR} />
        </Panel>

        <Panel
          tabId="generar"
          panelId="detalle"
          titulo="Page Object y spec"
          disposicionPorDefecto={{ x: 26.5, y: 0, w: 46, h: 100, z: 1 }}
        >
          <div className="flex h-full flex-col gap-2">
            <SubpestanasDeshabilitadas />
            <div className="flex-1">
              <AccionDeshabilitada motivo={MOTIVO_GENERADOR} />
            </div>
          </div>
        </Panel>

        <Panel
          tabId="generar"
          panelId="chat"
          titulo="Hablar con el agente"
          disposicionPorDefecto={{ x: 74, y: 0, w: 26, h: 100, z: 1 }}
        >
          <AccionDeshabilitada motivo={MOTIVO_GENERADOR} />
        </Panel>
      </div>

      <BarraLanzamientoDeshabilitada motivo={MOTIVO_GENERADOR} etiquetaBoton="▶️ Generar" />
    </div>
  );
}

// Subpestañas `go-po` del mockup (Page Object / spec): no hay nada que alternar todavía, así que
// las dos quedan deshabilitadas en vez de fingir que una está activa con datos que no existen.
function SubpestanasDeshabilitadas() {
  return (
    <div className="flex gap-1.5">
      {["Page Object", "Spec"].map((etiqueta) => (
        <button
          key={etiqueta}
          type="button"
          disabled
          className="cursor-not-allowed rounded-6 border border-border-soft bg-bg-sunken px-2.5 py-1 text-xs text-text-ghost"
        >
          {etiqueta}
        </button>
      ))}
    </div>
  );
}
