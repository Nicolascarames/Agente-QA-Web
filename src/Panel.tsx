import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Rnd } from "react-rnd";

// Componente compartido de las 8 pestañas: arrastrar, redimensionar, límites
// dentro del contenedor y persistencia por pestaña + panel en localStorage.
// Librería elegida: react-rnd (mantenida, sin dependencias propias más allá de
// React) — junta arrastre y redimensionado en un único componente en vez de
// combinar dos librerías sueltas.
//
// La geometría vive en % del contenedor (`data-canvas`), como en el mockup
// (`design/mockup-design.js`, `mk(x, y, w, h)`): así los paneles se reparten
// en proporción al redimensionar la ventana en vez de quedarse clavados en
// píxeles. react-rnd solo entiende posición/tamaño en px, así que cada panel
// mide su contenedor (`closest('[data-canvas]')`, igual que `startDrag`/
// `startResize` del mockup) y convierte % ⇄ px al pintar y al soltar.

export interface DisposicionPanel {
  /** Los cuatro, en % del contenedor `[data-canvas]`. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** z-index; sube al enfocar/arrastrar/redimensionar el panel. */
  z: number;
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

// v2: la geometría pasa de píxeles a % del contenedor. Las disposiciones
// guardadas en v1 (píxeles) no se pueden reinterpretar como %, así que se
// descartan sin más — no hay migración posible.
function claveStorage(tabId: string, panelId: string): string {
  return `agente-qa-web:panel:v2:${tabId}:${panelId}`;
}

function leerDisposicionGuardada(tabId: string, panelId: string, porDefecto: DisposicionPanel): DisposicionPanel {
  try {
    const bruto = window.localStorage.getItem(claveStorage(tabId, panelId));
    if (!bruto) return porDefecto;
    const guardada = JSON.parse(bruto) as Partial<DisposicionPanel>;
    return {
      x: guardada.x ?? porDefecto.x,
      y: guardada.y ?? porDefecto.y,
      w: guardada.w ?? porDefecto.w,
      h: guardada.h ?? porDefecto.h,
      z: guardada.z ?? porDefecto.z,
    };
  } catch {
    return porDefecto;
  }
}

// Contador de z-index compartido por toda la sesión, igual que `this.zCounter`
// en el mockup (una única cuenta, no una por pestaña): solo importa que el
// último panel tocado quede por encima de los demás de su misma pestaña.
let contadorZ = 10;

export function Panel({ tabId, panelId, titulo, disposicionPorDefecto, children }: PanelProps) {
  const [disposicion, setDisposicion] = useState<DisposicionPanel>(() =>
    leerDisposicionGuardada(tabId, panelId, disposicionPorDefecto)
  );
  const rndRef = useRef<Rnd | null>(null);
  const [tamContenedor, setTamContenedor] = useState<{ width: number; height: number } | null>(null);

  const medirContenedor = useCallback(() => {
    const contenedor = rndRef.current?.resizableElement.current?.closest<HTMLElement>("[data-canvas]");
    if (!contenedor) return;
    const rect = contenedor.getBoundingClientRect();
    setTamContenedor({ width: rect.width, height: rect.height });
  }, []);

  useLayoutEffect(() => {
    medirContenedor();
    window.addEventListener("resize", medirContenedor);
    return () => {
      window.removeEventListener("resize", medirContenedor);
    };
  }, [medirContenedor]);

  const asignarRef = useCallback((instancia: Rnd | null) => {
    rndRef.current = instancia;
  }, []);

  const guardar = useCallback(
    (siguiente: DisposicionPanel) => {
      setDisposicion(siguiente);
      window.localStorage.setItem(claveStorage(tabId, panelId), JSON.stringify(siguiente));
    },
    [tabId, panelId]
  );

  // Sube el panel al frente al enfocarlo, arrastrarlo o redimensionarlo — los
  // tres pasan por un mousedown en algún punto del panel, así que un único
  // manejador basta (el mockup los distingue porque `startDrag`/`startResize`
  // son manejadores nativos separados; en React no hace falta).
  const subirZ = useCallback(() => {
    contadorZ += 1;
    const z = contadorZ;
    setDisposicion((actual) => {
      const siguiente = { ...actual, z };
      window.localStorage.setItem(claveStorage(tabId, panelId), JSON.stringify(siguiente));
      return siguiente;
    });
  }, [tabId, panelId]);

  const ancho = tamContenedor?.width ?? 0;
  const alto = tamContenedor?.height ?? 0;

  return (
    <Rnd
      ref={asignarRef}
      className="overflow-hidden rounded-10 border border-border bg-bg-panel text-text"
      style={{ zIndex: disposicion.z }}
      size={{ width: (disposicion.w / 100) * ancho, height: (disposicion.h / 100) * alto }}
      position={{ x: (disposicion.x / 100) * ancho, y: (disposicion.y / 100) * alto }}
      bounds="parent"
      dragHandleClassName="panel-drag-handle"
      onMouseDown={subirZ}
      enableResizing={{ bottomRight: true }}
      resizeHandleComponent={{
        bottomRight: (
          <div className="flex h-4 w-4 items-end justify-end p-0.5 text-sm text-text-ghost">◢</div>
        ),
      }}
      onDragStop={(_e, d) => {
        const contenedor = d.node.closest<HTMLElement>("[data-canvas]");
        if (!contenedor) return;
        const rect = contenedor.getBoundingClientRect();
        guardar({ ...disposicion, x: (d.x / rect.width) * 100, y: (d.y / rect.height) * 100 });
      }}
      onResizeStop={(_e, _dir, ref, _delta, pos) => {
        const contenedor = ref.closest<HTMLElement>("[data-canvas]");
        if (!contenedor) return;
        const rect = contenedor.getBoundingClientRect();
        guardar({
          x: (pos.x / rect.width) * 100,
          y: (pos.y / rect.height) * 100,
          w: (ref.offsetWidth / rect.width) * 100,
          h: (ref.offsetHeight / rect.height) * 100,
          z: disposicion.z,
        });
      }}
    >
      {/* react-rnd pone `display: inline-block` inline en la raíz (pisa cualquier
          clase `flex` que le pongamos ahí, un estilo inline siempre gana a una
          clase). Por eso el flex real vive en este div interior, no en <Rnd>:
          sin él, el cuerpo de abajo no tiene una altura acotada, `overflow-auto`
          nunca se activa y el sobrante se recorta en silencio sin scroll. */}
      <div className="flex h-full flex-col overflow-hidden">
        <div className="panel-drag-handle flex cursor-move select-none items-center gap-1.5 px-3 py-2.5 text-xs uppercase tracking-[.06em] text-accent-soft">
          <span>⠿</span>
          <span>{titulo}</span>
        </div>
        <div className="flex-1 overflow-auto p-3 text-sm">{children}</div>
      </div>
    </Rnd>
  );
}
