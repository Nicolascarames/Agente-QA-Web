import { Panel } from "./Panel";
import { ContenidoReferencia } from "./Motor";
import { SECCION_INSTALAR } from "./catalogo/secciones";

// Segunda pestaña de "Referencia" (Bloque 6): reutiliza el mismo renderer de `Motor.tsx`
// (`ContenidoReferencia`) sobre datos distintos (`catalogo/secciones.ts`). Sin guía al pie: no
// tiene comandos propios en `catalogo/comandos.ts` (Instalar no ejecuta nada, solo documenta).
export function Instalar() {
  return (
    <div className="flex h-full w-full flex-col overflow-auto p-4">
      <div className="relative flex-1" data-canvas="true">
        <Panel tabId="instalar" panelId="contenido" titulo="📦 Instalar" disposicionPorDefecto={{ x: 0, y: 0, w: 100, h: 100, z: 1 }}>
          <ContenidoReferencia pagina={SECCION_INSTALAR} />
        </Panel>
      </div>
    </div>
  );
}
