import { AccionDeshabilitada } from "./AccionDeshabilitada";
import { Panel } from "./Panel";

const MOTIVO_CONFIGURACION =
  "El sistema de configuración se reconstruye desde cero en el Bloque 3 (agente-qa.config.json en la raíz del repo, gestionado por `npx agente-qa`). La interfaz web para editarlo todavía no existe.";

export function Configuracion() {
  return (
    <div className="flex h-full w-full flex-col overflow-auto p-4">
      <div className="relative flex-1" data-canvas="true">
        <Panel tabId="configuracion" panelId="proyecto" titulo="📁 Este proyecto" disposicionPorDefecto={{ x: 0, y: 0, w: 48, h: 100, z: 1 }}>
          <AccionDeshabilitada motivo={MOTIVO_CONFIGURACION} />
        </Panel>
        <Panel tabId="configuracion" panelId="global" titulo="🌍 Global" disposicionPorDefecto={{ x: 51, y: 0, w: 49, h: 100, z: 1 }}>
          <AccionDeshabilitada motivo={MOTIVO_CONFIGURACION} />
        </Panel>
      </div>
    </div>
  );
}
