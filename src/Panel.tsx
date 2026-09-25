import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Rnd } from "react-rnd";
import { usePreferenciasUI } from "./preferenciasUI";

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
//
// Configuración → Apariencia (src/preferenciasUI.ts) añade un segundo modo:
// "fijos" pinta un div plano en la geometría de mockup, sin Rnd ni
// localStorage — la mitad de este fichero (medir, arrastrar, redimensionar)
// no corre en ese modo. "movibles" es el comportamiento de siempre, pero
// ahora sobre TODA la banda (pestaña + consola, `[data-lienzo-global]` en
// App.tsx) en vez de solo el canvas local del panel.

export interface DisposicionPanel {
  /** Los cuatro, en % del contenedor `[data-canvas]` (modo fijos) o de la banda completa
   *  `[data-lienzo-global]` una vez guardados (modo movibles — ver `convertirLocalABanda`). */
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

// v3: modo movibles pasa de guardar % del canvas local a % de la banda completa (pestaña + consola,
// `[data-lienzo-global]`) — un panel ahora puede quedar a medias sobre la consola, algo que un % de
// canvas local no puede representar. Las disposiciones guardadas en v2 no se pueden reinterpretar
// sin remedir, así que se descartan sin más, igual que v1 (píxeles) se descartó al pasar a v2 (%).
const PREFIJO_STORAGE_V3 = "agente-qa-web:panel:v3:";
function claveStorage(tabId: string, panelId: string): string {
  return `${PREFIJO_STORAGE_V3}${tabId}:${panelId}`;
}

function leerDisposicionGuardada(tabId: string, panelId: string): DisposicionPanel | null {
  try {
    const bruto = window.localStorage.getItem(claveStorage(tabId, panelId));
    if (!bruto) return null;
    const guardada = JSON.parse(bruto) as Partial<DisposicionPanel>;
    if (
      typeof guardada.x !== "number" ||
      typeof guardada.y !== "number" ||
      typeof guardada.w !== "number" ||
      typeof guardada.h !== "number" ||
      typeof guardada.z !== "number"
    ) {
      return null;
    }
    return { x: guardada.x, y: guardada.y, w: guardada.w, h: guardada.h, z: guardada.z };
  } catch {
    return null;
  }
}

// Botón "Restablecer posiciones" de Configuración → Apariencia: borra toda disposición guardada
// (versión actual del storage) y avisa a los paneles montados para que vuelvan a su geometría de
// mockup sin recargar la página — cada `<Panel>` escucha este evento y descarta su estado local.
const EVENTO_RESTABLECER = "agente-qa-web:panel:restablecer";

export function restablecerDisposicionesGuardadas(): void {
  try {
    const claves: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const clave = window.localStorage.key(i);
      if (clave?.startsWith(PREFIJO_STORAGE_V3)) claves.push(clave);
    }
    for (const clave of claves) window.localStorage.removeItem(clave);
  } catch {
    // No es crítico: si falla, las disposiciones antiguas se quedan hasta la próxima limpieza.
  }
  window.dispatchEvent(new Event(EVENTO_RESTABLECER));
}

// Marca cada raíz de <Rnd> para poder recorrerlas todas al subir el z de una — ver `calcularSiguienteZ`.
const CLASE_PANEL_MOVIBLE = "qa-panel-movible";

/** El "quién sube por encima de quién" no puede ser un contador de módulo (`let contadorZ = 10`,
 *  como tenía v2): ese contador nace a 10 en cada recarga de página, pero las disposiciones
 *  guardadas en localStorage no — un panel tocado en una sesión anterior puede seguir teniendo
 *  z=46 guardado, y el contador de la sesión nueva nunca lo alcanza aunque el usuario toque diez
 *  paneles distintos. En su lugar: en cada subida, se lee el z-index YA PINTADO de cada panel de la
 *  banda (`getComputedStyle`, no el estado de React de cada uno, que este componente no comparte)
 *  y se coloca uno por encima del más alto de todos — incluida la consola, que es un panel más
 *  dentro de la misma banda. */
function calcularSiguienteZ(banda: HTMLElement): number {
  let maxZ = 0;
  for (const nodo of banda.querySelectorAll<HTMLElement>(`.${CLASE_PANEL_MOVIBLE}`)) {
    const z = Number(window.getComputedStyle(nodo).zIndex);
    if (Number.isFinite(z)) maxZ = Math.max(maxZ, z);
  }
  return maxZ + 1;
}

/** Convierte una geometría en % del canvas local a % de la banda completa, usando los rects
 *  medidos de ambos — es la disposición de partida de un panel en modo movibles que nunca se ha
 *  guardado: así su primera aparición coincide exactamente con el modo fijos. */
function convertirLocalABanda(local: DisposicionPanel, rectLocal: DOMRect, rectBanda: DOMRect): DisposicionPanel {
  const xPx = rectLocal.left - rectBanda.left + (local.x / 100) * rectLocal.width;
  const yPx = rectLocal.top - rectBanda.top + (local.y / 100) * rectLocal.height;
  const wPx = (local.w / 100) * rectLocal.width;
  const hPx = (local.h / 100) * rectLocal.height;
  return {
    x: rectBanda.width > 0 ? (xPx / rectBanda.width) * 100 : 0,
    y: rectBanda.height > 0 ? (yPx / rectBanda.height) * 100 : 0,
    w: rectBanda.width > 0 ? (wPx / rectBanda.width) * 100 : 0,
    h: rectBanda.height > 0 ? (hPx / rectBanda.height) * 100 : 0,
    z: local.z,
  };
}

/** Si la ventana se ha encogido después de guardar la disposición, un panel con mínimos en px
 *  (160×100, ver `minWidth`/`minHeight` más abajo) puede quedar en % fuera de la banda — clampa
 *  posición y tamaño para que siempre quede dentro de 0/100 en ambos ejes. */
function clampDisposicion(d: DisposicionPanel): DisposicionPanel {
  const w = Math.min(d.w, 100);
  const h = Math.min(d.h, 100);
  const x = Math.min(Math.max(d.x, 0), 100 - w);
  const y = Math.min(Math.max(d.y, 0), 100 - h);
  return { x, y, w, h, z: d.z };
}

// Sin `overflow-hidden` aquí (vivía en esta constante antes): en movibles ese `overflow-hidden`
// caía sobre la raíz de `<Rnd>`, que es también donde react-rnd cuelga sus tiradores de
// redimensionado — los de los bordes/esquinas sin tirador propio (todos menos bottomRight) los
// coloca ligeramente FUERA de la caja, y quedaban recortados/imposibles de agarrar. El recorte a
// un rectángulo (por si el contenido se desborda) se hace en el div interior (mismo tamaño, sin
// tiradores dentro) en los dos modos — fijos no necesita el `overflow-hidden` de la raíz tampoco,
// así que se deja igual en ambos por consistencia.
const CLASE_MARCO = "rounded-10 border border-border bg-bg-panel text-text";
const CLASE_CUERPO = "min-h-0 min-w-0 flex-1 overflow-auto p-3 text-sm";

function Cabecera({ titulo, arrastrable }: { titulo: string; arrastrable: boolean }) {
  return (
    <div
      className={`flex items-center gap-1.5 px-3 py-2.5 text-xs uppercase tracking-[.06em] text-accent-soft ${
        arrastrable ? "panel-drag-handle cursor-move select-none" : ""
      }`}
    >
      <span>⠿</span>
      <span>{titulo}</span>
    </div>
  );
}

export function Panel({ tabId, panelId, titulo, disposicionPorDefecto, children }: PanelProps) {
  const { modoPaneles } = usePreferenciasUI();

  if (modoPaneles === "fijos") {
    // Div plano en la geometría de mockup, en % — no lee ni escribe localStorage, no hay Rnd. El
    // cuerpo sigue siendo `flex-1 overflow-auto`: el contenido nunca se recorta en silencio, solo
    // gana scroll si no cabe.
    return (
      <div
        className={`absolute ${CLASE_MARCO}`}
        style={{
          left: `${String(disposicionPorDefecto.x)}%`,
          top: `${String(disposicionPorDefecto.y)}%`,
          width: `${String(disposicionPorDefecto.w)}%`,
          height: `${String(disposicionPorDefecto.h)}%`,
          zIndex: disposicionPorDefecto.z,
        }}
      >
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <Cabecera titulo={titulo} arrastrable={false} />
          <div className={CLASE_CUERPO}>{children}</div>
        </div>
      </div>
    );
  }

  return (
    <PanelMovible tabId={tabId} panelId={panelId} titulo={titulo} disposicionPorDefecto={disposicionPorDefecto}>
      {children}
    </PanelMovible>
  );
}

function PanelMovible({ tabId, panelId, titulo, disposicionPorDefecto, children }: PanelProps) {
  // null mientras no hay nada guardado y todavía no se ha medido la banda para calcular el punto de
  // partida (ver el efecto de abajo) — `dispBanda` (más abajo) cae a una geometría de tamaño 0
  // durante ese primer instante, el mismo parpadeo inicial que ya tenía el modo único de antes.
  const [disposicionBanda, setDisposicionBanda] = useState<DisposicionPanel | null>(() => leerDisposicionGuardada(tabId, panelId));
  const rndRef = useRef<Rnd | null>(null);
  const [rects, setRects] = useState<{ local: DOMRect; banda: DOMRect } | null>(null);

  const medir = useCallback(() => {
    const nodo = rndRef.current?.resizableElement.current;
    const local = nodo?.closest<HTMLElement>("[data-canvas]");
    const banda = nodo?.closest<HTMLElement>("[data-lienzo-global]");
    if (!local || !banda) return;
    setRects({ local: local.getBoundingClientRect(), banda: banda.getBoundingClientRect() });
  }, []);

  useLayoutEffect(() => {
    medir();
    window.addEventListener("resize", medir);
    // La banda cambia de tamaño con la topbar (el aviso "en curso" cambia su alto) o con el ajuste
    // de texto (Configuración → Apariencia): ninguno de los dos dispara un resize de ventana.
    const nodoBanda = rndRef.current?.resizableElement.current?.closest<HTMLElement>("[data-lienzo-global]");
    const observador = nodoBanda ? new ResizeObserver(medir) : null;
    if (nodoBanda && observador) observador.observe(nodoBanda);
    return () => {
      window.removeEventListener("resize", medir);
      observador?.disconnect();
    };
  }, [medir]);

  // Sin disposición guardada: en cuanto se puede medir, la geometría de partida es la de mockup
  // (en % del canvas local) convertida a % de banda — así la primera aparición en movibles coincide
  // con fijos, pixel a pixel.
  useEffect(() => {
    if (disposicionBanda !== null || !rects) return;
    setDisposicionBanda(convertirLocalABanda(disposicionPorDefecto, rects.local, rects.banda));
    // disposicionPorDefecto no entra en las deps a propósito: es un objeto literal nuevo en cada
    // render del padre, y una vez `disposicionBanda` deja de ser null el guard de arriba ya no
    // vuelve a ejecutar el cuerpo del efecto.
  }, [disposicionBanda, rects]);

  useEffect(() => {
    const escuchar = () => {
      setDisposicionBanda(null);
    };
    window.addEventListener(EVENTO_RESTABLECER, escuchar);
    return () => {
      window.removeEventListener(EVENTO_RESTABLECER, escuchar);
    };
  }, []);

  const asignarRef = useCallback((instancia: Rnd | null) => {
    rndRef.current = instancia;
  }, []);

  // `calcular` recibe la disposición MÁS RECIENTE (la de la función de actualización de React), no
  // la de cualquier cierre capturado en el último render — antes `onDragStop`/`onResizeStop` partían
  // de `dispBanda` (una variable local del render en que se creó ese manejador) y, si `subirZ` había
  // subido el z entre ese render y el `mouseup`, el guardado final pisaba ese z más alto con el
  // viejo: el panel se soltaba encima a la vista, pero el siguiente render lo devolvía detrás.
  const guardar = useCallback(
    (calcular: (actual: DisposicionPanel) => DisposicionPanel) => {
      setDisposicionBanda((actual) => {
        if (!actual) return actual;
        const siguiente = calcular(actual);
        try {
          window.localStorage.setItem(claveStorage(tabId, panelId), JSON.stringify(siguiente));
        } catch {
          // No es crítico: la posición vive en memoria hasta la próxima recarga.
        }
        return siguiente;
      });
    },
    [tabId, panelId]
  );

  const subirZ = useCallback(() => {
    const banda = rndRef.current?.resizableElement.current?.closest<HTMLElement>("[data-lienzo-global]");
    if (!banda) return;
    const z = calcularSiguienteZ(banda);
    guardar((actual) => ({ ...actual, z }));
  }, [guardar]);

  const dispBanda = clampDisposicion(disposicionBanda ?? { x: 0, y: 0, w: 0, h: 0, z: disposicionPorDefecto.z });
  const anchoBanda = rects?.banda.width ?? 0;
  const altoBanda = rects?.banda.height ?? 0;
  // La posición/tamaño que entiende <Rnd> son px relativos a su offsetParent real (el canvas local
  // — la geometría en % de banda es solo para el storage), así que hay que restar el desplazamiento
  // del canvas local dentro de la banda.
  const desplazX = rects ? rects.local.left - rects.banda.left : 0;
  const desplazY = rects ? rects.local.top - rects.banda.top : 0;

  return (
    <Rnd
      ref={asignarRef}
      className={`${CLASE_MARCO} ${CLASE_PANEL_MOVIBLE}`}
      style={{ zIndex: dispBanda.z }}
      size={{ width: (dispBanda.w / 100) * anchoBanda, height: (dispBanda.h / 100) * altoBanda }}
      position={{ x: (dispBanda.x / 100) * anchoBanda - desplazX, y: (dispBanda.y / 100) * altoBanda - desplazY }}
      bounds="[data-lienzo-global]"
      dragHandleClassName="panel-drag-handle"
      onMouseDown={subirZ}
      enableResizing
      minWidth={160}
      minHeight={100}
      resizeHandleComponent={{
        bottomRight: (
          <div className="flex h-4 w-4 items-end justify-end p-0.5 text-sm text-text-ghost">◢</div>
        ),
      }}
      onDragStop={(_e, d) => {
        const local = d.node.closest<HTMLElement>("[data-canvas]");
        const banda = d.node.closest<HTMLElement>("[data-lienzo-global]");
        if (!local || !banda) return;
        const rectLocal = local.getBoundingClientRect();
        const rectBanda = banda.getBoundingClientRect();
        const xPx = d.x + (rectLocal.left - rectBanda.left);
        const yPx = d.y + (rectLocal.top - rectBanda.top);
        guardar((actual) => ({ ...actual, x: (xPx / rectBanda.width) * 100, y: (yPx / rectBanda.height) * 100 }));
      }}
      onResizeStop={(_e, _dir, ref, _delta, pos) => {
        const local = ref.closest<HTMLElement>("[data-canvas]");
        const banda = ref.closest<HTMLElement>("[data-lienzo-global]");
        if (!local || !banda) return;
        const rectLocal = local.getBoundingClientRect();
        const rectBanda = banda.getBoundingClientRect();
        const xPx = pos.x + (rectLocal.left - rectBanda.left);
        const yPx = pos.y + (rectLocal.top - rectBanda.top);
        guardar((actual) => ({
          ...actual,
          x: (xPx / rectBanda.width) * 100,
          y: (yPx / rectBanda.height) * 100,
          w: (ref.offsetWidth / rectBanda.width) * 100,
          h: (ref.offsetHeight / rectBanda.height) * 100,
        }));
      }}
    >
      {/* react-rnd pone `display: inline-block` inline en la raíz (pisa cualquier
          clase `flex` que le pongamos ahí, un estilo inline siempre gana a una
          clase). Por eso el flex real vive en este div interior, no en <Rnd>:
          sin él, el cuerpo de abajo no tiene una altura acotada, `overflow-auto`
          nunca se activa y el sobrante se recorta en silencio sin scroll. */}
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <Cabecera titulo={titulo} arrastrable />
        <div className={CLASE_CUERPO}>{children}</div>
      </div>
    </Rnd>
  );
}
