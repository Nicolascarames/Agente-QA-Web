import { AccionDeshabilitada, BarraLanzamientoDeshabilitada } from "./AccionDeshabilitada";
import { Panel } from "./Panel";

// Bloque 6: misma geometría que `panels.reparar` del mockup (design/mockup-design.js) —
// izquierda 25 %, centro 46 % (arranca en 26.5 %), derecha 26 % (arranca en 74 %), los tres a
// 100 % de alto — pero vacíos: el agente reparador no existe todavía (ver ESTADO.md de
// Agente-QA-MCP). Igual que Ejecutar, su barra tampoco trae fila "🤖 Agente" en el mockup
// (`sinAgente`); a diferencia de Ejecutar, su coste sí depende de un LLM que hoy no existe, así
// que se queda en el marcador neutro en vez de fijar un importe.
const MOTIVO_REPARADOR =
  "El agente reparador no existe todavía: no hay ningún proceso que diagnostique un test en rojo ni proponga un diff de corrección.";

export function Reparar() {
  return (
    <div className="flex h-full flex-col gap-2.5 p-4">
      <div className="relative flex-1" data-canvas="true">
        <Panel
          tabId="reparar"
          panelId="lista"
          titulo="Tests en rojo"
          disposicionPorDefecto={{ x: 0, y: 0, w: 25, h: 100, z: 1 }}
        >
          <AccionDeshabilitada motivo={MOTIVO_REPARADOR} />
        </Panel>

        <Panel
          tabId="reparar"
          panelId="detalle"
          titulo="Diagnóstico y propuesta"
          disposicionPorDefecto={{ x: 26.5, y: 0, w: 46, h: 100, z: 1 }}
        >
          <div className="flex h-full flex-col gap-2">
            <PropuestaDeshabilitada motivo={MOTIVO_REPARADOR} />
            <div className="flex-1">
              <AccionDeshabilitada motivo={MOTIVO_REPARADOR} />
            </div>
          </div>
        </Panel>

        <Panel
          tabId="reparar"
          panelId="chat"
          titulo="Hablar con el agente"
          disposicionPorDefecto={{ x: 74, y: 0, w: 26, h: 100, z: 1 }}
        >
          <AccionDeshabilitada motivo={MOTIVO_REPARADOR} />
        </Panel>
      </div>

      <BarraLanzamientoDeshabilitada motivo={MOTIVO_REPARADOR} etiquetaBoton="▶️ Reparar" sinAgente />
    </div>
  );
}

// Cabecera de la propuesta de diff del mockup (mid panel de `panels.reparar`): sin diagnóstico
// real no hay línea "-"/"+" que enseñar (regla de fidelidad 5, nada de atrezo del mockup como
// `getByText("Create")`), pero el par de colores sí es real — `--danger` para lo que se retira,
// `--ok` para lo que se propone — así que se deja aquí, sobre el hueco honesto en vez de sobre
// código inventado. Los dos botones del mockup (`✅ Aplicar y reejecutar` / `✖️ Rechazar`) quedan
// deshabilitados de verdad, con el motivo en su `title`.
function PropuestaDeshabilitada({ motivo }: { motivo: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-8 border border-border-soft bg-bg-sunken p-3 text-xs text-text-ghost">
      <div>
        <span className="text-danger">−</span> sin diagnóstico todavía
      </div>
      <div>
        <span className="text-ok">+</span> sin propuesta todavía
      </div>
      <div className="mt-1.5 flex gap-1.5">
        <button
          type="button"
          disabled
          title={motivo}
          className="cursor-not-allowed rounded-7 border border-border-soft bg-bg-sunken px-2.5 py-1.5 text-xs font-bold text-text-ghost"
        >
          ✅ Aplicar y reejecutar
        </button>
        <button
          type="button"
          disabled
          title={motivo}
          className="cursor-not-allowed rounded-7 border border-border-soft bg-bg-sunken px-2.5 py-1.5 text-xs text-text-ghost"
        >
          ✖️ Rechazar
        </button>
      </div>
    </div>
  );
}
