import { Panel } from "./Panel";
import { InsigniasEjes } from "./InsigniasEjes";
import { fichasDePestana, idFicha } from "./catalogo/porPestana";
import type { FichaResuelta } from "./catalogo/catalogo";

// Guía de la pestaña activa: un panel flotante más (banda 3, `src/App.tsx`) con la ficha plegada
// de cada comando de esa pestaña. La ficha plegada es completa por sí misma (nombre, resumen,
// insignias y opciones reales del CLI): el cajón con el resto de la plantilla es el Bloque 4,
// pulsar la ficha todavía no hace nada.
export interface GuiaPestanaProps {
  pestana: string;
}

function FichaPlegada({ resuelta }: { resuelta: FichaResuelta }) {
  const { ficha } = resuelta;
  const opciones = resuelta.tipo === "comando" ? resuelta.cli.opciones : [];
  return (
    <div className="rounded-8 border border-border-soft bg-bg-panel p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <code className="text-sm font-bold text-accent-soft">{ficha.ruta.join(" ")}</code>
        <InsigniasEjes ejes={ficha.ejes} />
      </div>
      <p className="mt-1 text-xs text-text-muted">{ficha.unaLinea}</p>
      {opciones.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1 border-t border-border-soft pt-2">
          {opciones.map((opcion) => (
            <li key={opcion.flags} className="text-2xs text-text-dim">
              <code className="text-text-faint">{opcion.flags}</code> — {opcion.descripcion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function GuiaPestana({ pestana }: GuiaPestanaProps) {
  const fichas = fichasDePestana(pestana);
  return (
    <Panel tabId={pestana} panelId="guia" titulo="Guía" disposicionPorDefecto={{ x: 2, y: 4, w: 96, h: 90, z: 10 }}>
      <div className="flex flex-col gap-2">
        {fichas.length === 0 ? (
          <p className="text-text-dim">Esta pestaña no tiene fichas todavía.</p>
        ) : (
          fichas.map((resuelta) => <FichaPlegada key={idFicha(resuelta.ficha)} resuelta={resuelta} />)
        )}
      </div>
    </Panel>
  );
}
