import { useCallback, useState, type ReactNode } from "react";
import { Rnd } from "react-rnd";

// Componente compartido de las 8 pestañas: arrastrar, redimensionar, límites
// dentro del contenedor y persistencia por pestaña + panel en localStorage.
// Librería elegida: react-rnd (mantenida, sin dependencias propias más allá de
// React) — junta arrastre y redimensionado en un único componente en vez de
// combinar dos librerías sueltas.

export interface DisposicionPanel {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PanelProps {
  /** Pestaña dueña del panel: forma parte de la clave de localStorage. */
  tabId: string;
  /** Identificador del panel dentro de la pestaña. */
  panelId: string;
  titulo: string;
  disposicionPorDefecto: DisposicionPanel;
  children: ReactNode;
}

function claveStorage(tabId: string, panelId: string): string {
  return `agente-qa-web:panel:${tabId}:${panelId}`;
}

function leerDisposicionGuardada(tabId: string, panelId: string, porDefecto: DisposicionPanel): DisposicionPanel {
  try {
    const bruto = window.localStorage.getItem(claveStorage(tabId, panelId));
    if (!bruto) return porDefecto;
    const guardada = JSON.parse(bruto) as Partial<DisposicionPanel>;
    return {
      x: guardada.x ?? porDefecto.x,
      y: guardada.y ?? porDefecto.y,
      width: guardada.width ?? porDefecto.width,
      height: guardada.height ?? porDefecto.height,
    };
  } catch {
    return porDefecto;
  }
}

export function Panel({ tabId, panelId, titulo, disposicionPorDefecto, children }: PanelProps) {
  const [disposicion, setDisposicion] = useState<DisposicionPanel>(() =>
    leerDisposicionGuardada(tabId, panelId, disposicionPorDefecto)
  );

  const guardar = useCallback(
    (siguiente: DisposicionPanel) => {
      setDisposicion(siguiente);
      window.localStorage.setItem(claveStorage(tabId, panelId), JSON.stringify(siguiente));
    },
    [tabId, panelId]
  );

  const restaurar = useCallback(() => {
    window.localStorage.removeItem(claveStorage(tabId, panelId));
    setDisposicion(disposicionPorDefecto);
  }, [tabId, panelId, disposicionPorDefecto]);

  return (
    <Rnd
      className="flex flex-col rounded-md border border-accent/40 bg-panel text-text shadow-lg"
      size={{ width: disposicion.width, height: disposicion.height }}
      position={{ x: disposicion.x, y: disposicion.y }}
      bounds="parent"
      dragHandleClassName="panel-drag-handle"
      onDragStop={(_e, d) => {
        guardar({ ...disposicion, x: d.x, y: d.y });
      }}
      onResizeStop={(_e, _dir, ref, _delta, pos) => {
        guardar({ x: pos.x, y: pos.y, width: ref.offsetWidth, height: ref.offsetHeight });
      }}
    >
      <div className="panel-drag-handle flex cursor-move select-none items-center justify-between border-b border-accent/30 px-3 py-1.5 text-sm">
        <span>{titulo}</span>
        <button type="button" onClick={restaurar} className="text-xs text-accent hover:underline">
          restaurar disposición
        </button>
      </div>
      <div className="flex-1 overflow-auto p-3 text-sm">{children}</div>
    </Rnd>
  );
}
